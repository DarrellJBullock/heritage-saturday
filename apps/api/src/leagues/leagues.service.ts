import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateLeagueRequestDto,
  LeagueDetailDto,
  LeagueListItemDto,
  LeagueRole,
  RosterListItemDto,
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
    return this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, 0, 'OWNER');
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

    return this.toListItem(league.id, league.name, league.size, league.templateKey, league.createdAt, size, 'OWNER');
  }

  /** Leagues the user owns OR is a member of, each tagged with the caller's role. */
  async listForUser(userId: string): Promise<LeagueListItemDto[]> {
    const leagues = await this.prisma.league.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: 'desc' },
      include: {
        rosters: { select: { _count: { select: { teams: true } } } },
        members: { where: { userId }, select: { role: true } },
      },
    });

    return leagues.map((l) =>
      this.toListItem(
        l.id,
        l.name,
        l.size,
        l.templateKey,
        l.createdAt,
        l.rosters.reduce((sum, r) => sum + r._count.teams, 0),
        l.ownerId === userId ? 'OWNER' : (l.members[0]?.role ?? 'VIEWER'),
      ),
    );
  }

  /**
   * League detail. Access is enforced by LeagueReadAccessGuard on the route (owner or member).
   * The owner sees every roster; a member sees only LEAGUE-visible ones. teamCount always
   * reflects the rosters the caller can actually see.
   */
  async getDetail(leagueId: string, userId: string): Promise<LeagueDetailDto> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { teams: true } } },
        },
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!league) {
      throw new DomainException(404, 'NOT_FOUND', 'League not found');
    }

    const isOwner = league.ownerId === userId;
    const role = isOwner ? 'OWNER' : (league.members[0]?.role ?? 'VIEWER');
    // The guard already admitted the caller; a non-owner here is necessarily a member.
    // The owner sees all rosters (archived ones flagged, so the UI can offer restore/delete);
    // a member sees only active LEAGUE-visible rosters (archived = put away, hidden from them).
    const visibleRosters = isOwner
      ? league.rosters
      : league.rosters.filter((r) => r.visibility === 'LEAGUE' && r.archivedAt === null);

    // teamCount reflects the ACTIVE league — archived rosters' teams are not counted.
    const teamCount = visibleRosters
      .filter((r) => r.archivedAt === null)
      .reduce((sum, r) => sum + r._count.teams, 0);
    const rosters: RosterListItemDto[] = visibleRosters.map((r) => ({
      id: r.id,
      name: r.name,
      teamCount: r._count.teams,
      createdAt: r.createdAt.toISOString(),
      visibility: r.visibility,
      archived: r.archivedAt !== null,
    }));

    return {
      ...this.toListItem(
        league.id,
        league.name,
        league.size,
        league.templateKey,
        league.createdAt,
        teamCount,
        role,
      ),
      rosters,
    };
  }

  private toListItem(
    id: string,
    name: string,
    size: number,
    templateKey: string | null,
    createdAt: Date,
    teamCount: number,
    role: LeagueRole,
  ): LeagueListItemDto {
    return { id, name, size, templateKey, teamCount, createdAt: createdAt.toISOString(), role };
  }
}
