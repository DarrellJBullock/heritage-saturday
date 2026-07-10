import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateLeagueRequestDto,
  LeagueDetailDto,
  LeagueListItemDto,
} from '@heritage-saturday/shared';
import { generateLeague } from '@heritage-saturday/league-generator';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a league. With a `templateKey`, teams and rated players are generated so the league
   * is immediately playable; without one, the league starts empty and rosters are added by
   * import. Either way the seed is stored so the league is reproducible.
   */
  async create(dto: CreateLeagueRequestDto, ownerId: string): Promise<LeagueListItemDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new DomainException(400, 'BAD_REQUEST', 'League name is required');
    }
    const seed = dto.seed ?? randomUUID();

    if (dto.templateKey) {
      return this.createFromTemplate(name, dto.size, dto.templateKey, seed, ownerId);
    }

    const league = await this.prisma.league.create({
      data: { ownerId, name, size: dto.size, templateKey: null, seed },
    });
    return this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, 0);
  }

  /**
   * Generate a full, playable league from a template. All generated teams live under one system
   * roster in the league; depth charts are NOT written — DepthChartsService auto-generates them
   * (legally, since every team covers the required starting positions) on first read, exactly as
   * for an imported roster.
   */
  private async createFromTemplate(
    name: string,
    size: number,
    templateKey: string,
    seed: string,
    ownerId: string,
  ): Promise<LeagueListItemDto> {
    let generated;
    try {
      generated = generateLeague({ templateKey, size, seed });
    } catch (err) {
      throw new DomainException(400, 'BAD_REQUEST', `Cannot generate league: ${(err as Error).message}`);
    }

    const league = await this.prisma.$transaction(async (tx) => {
      const created = await tx.league.create({
        data: { ownerId, name, size, templateKey, seed },
      });
      const roster = await tx.roster.create({
        data: { ownerId, leagueId: created.id, name: `${name} (generated)`, visibility: 'PRIVATE' },
      });

      for (let i = 0; i < generated.teams.length; i++) {
        const t = generated.teams[i];
        const team = await tx.team.create({
          data: {
            rosterId: roster.id,
            externalTeamId: `T${i + 1}`,
            teamName: t.name,
            abbreviation: t.abbreviation,
            city: t.city,
            conference: t.conference,
            division: t.division,
            primaryColor: t.primaryColor,
            secondaryColor: t.secondaryColor,
          },
        });
        await tx.player.createMany({
          data: t.players.map((p, j) => ({
            teamId: team.id,
            externalPlayerId: `T${i + 1}-P${j + 1}`,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position as never,
            jerseyNumber: p.jerseyNumber,
            overallRating: p.overallRating,
            throwPower: p.throwPower ?? null,
            throwAccuracy: p.throwAccuracy ?? null,
            carry: p.carry ?? null,
            trucking: p.trucking ?? null,
            catching: p.catching ?? null,
            routeRunning: p.routeRunning ?? null,
            tackle: p.tackle ?? null,
            coverage: p.coverage ?? null,
            kickPower: p.kickPower ?? null,
            kickAccuracy: p.kickAccuracy ?? null,
          })),
        });
      }
      return created;
    });

    return this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, size);
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
