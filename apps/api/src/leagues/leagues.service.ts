import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateLeagueRequestDto,
  LeagueDetailDto,
  LeagueListItemDto,
} from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a league. In this phase it is always empty — rosters are added by import. Template
   * generation (writing teams/players) is wired in a later phase; `templateKey` is accepted and
   * stored now so the create contract does not change when generation lands.
   */
  async create(dto: CreateLeagueRequestDto, ownerId: string): Promise<LeagueListItemDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new DomainException(400, 'BAD_REQUEST', 'League name is required');
    }

    const league = await this.prisma.league.create({
      data: {
        ownerId,
        name,
        size: dto.size,
        templateKey: dto.templateKey ?? null,
        // Always stored so a league is reproducible even before generation exists.
        seed: dto.seed ?? randomUUID(),
      },
    });

    return this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, 0);
  }

  async listForOwner(ownerId: string): Promise<LeagueListItemDto[]> {
    const leagues = await this.prisma.league.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { rosters: true } }, rosters: { select: { _count: { select: { teams: true } } } } },
    });

    return leagues.map((l) =>
      this.toListItem(
        l.id,
        l.name,
        l.size,
        l.templateKey,
        l.createdAt,
        l.rosters.reduce((sum, r) => sum + r._count.teams, 0),
      ),
    );
  }

  /**
   * League detail. Ownership is enforced by LeagueOwnershipGuard on the route, so this is only
   * reached for the caller's own league; the extra `ownerId` filter is defence in depth.
   */
  async getDetail(leagueId: string, ownerId: string): Promise<LeagueDetailDto> {
    const league = await this.prisma.league.findFirst({
      where: { id: leagueId, ownerId },
      include: {
        rosters: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { teams: true } } },
        },
      },
    });
    if (!league) {
      throw new DomainException(404, 'NOT_FOUND', 'League not found');
    }

    const teamCount = league.rosters.reduce((sum, r) => sum + r._count.teams, 0);
    return {
      ...this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, teamCount),
      rosters: league.rosters.map((r) => ({
        id: r.id,
        name: r.name,
        teamCount: r._count.teams,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private toListItem(
    id: string,
    name: string,
    size: number,
    templateKey: string | null,
    createdAt: Date,
    teamCount: number,
  ): LeagueListItemDto {
    return { id, name, size, templateKey, teamCount, createdAt: createdAt.toISOString() };
  }
}
