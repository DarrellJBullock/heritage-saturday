import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { RosterDetailDto, RosterListItemDto, Visibility } from '@heritage-saturday/shared';

@Injectable()
export class RostersService {
  constructor(private readonly prisma: PrismaService) {}

  /** The owner's active (non-archived) rosters. */
  async listForOwner(ownerId: string): Promise<RosterListItemDto[]> {
    const rosters = await this.prisma.roster.findMany({
      where: { ownerId, archivedAt: null },
      include: { _count: { select: { teams: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rosters.map((r) => this.toListItem(r));
  }

  // Access is enforced by RosterReadAccessGuard on the route (owner, or member of the league
  // when LEAGUE-visible), so this fetches by id without re-filtering on owner.
  async getDetail(rosterId: string): Promise<RosterDetailDto> {
    const roster = await this.prisma.roster.findUnique({
      where: { id: rosterId },
      include: { teams: true },
    });
    if (!roster) {
      throw new DomainException(404, 'NOT_FOUND', 'Roster not found');
    }

    return {
      id: roster.id,
      name: roster.name,
      teamCount: roster.teams.length,
      createdAt: roster.createdAt.toISOString(),
      visibility: roster.visibility,
      archived: roster.archivedAt !== null,
      teams: roster.teams.map((t) => ({
        id: t.id,
        externalTeamId: t.externalTeamId,
        teamName: t.teamName,
        abbreviation: t.abbreviation,
        city: t.city,
        state: t.state,
        conference: t.conference,
        division: t.division,
      })),
    };
  }

  /**
   * Set a roster's visibility. Gated by the `roster:visibility` capability on the route.
   * Promoting to LEAGUE lets every member of the league read this roster and its teams/players.
   */
  async setVisibility(rosterId: string, visibility: Visibility): Promise<RosterListItemDto> {
    const roster = await this.prisma.roster.update({
      where: { id: rosterId },
      data: { visibility },
      include: { _count: { select: { teams: true } } },
    });
    return this.toListItem(roster);
  }

  async archive(rosterId: string): Promise<RosterListItemDto> {
    const roster = await this.prisma.roster.update({
      where: { id: rosterId },
      data: { archivedAt: new Date() },
      include: { _count: { select: { teams: true } } },
    });
    return this.toListItem(roster);
  }

  async restore(rosterId: string): Promise<RosterListItemDto> {
    const roster = await this.prisma.roster.update({
      where: { id: rosterId },
      data: { archivedAt: null },
      include: { _count: { select: { teams: true } } },
    });
    return this.toListItem(roster);
  }

  /** Permanently delete a roster. Blocked (409) if any of its teams have played games — archive
   *  instead — since deleting would orphan game history/standings. */
  async deleteRoster(rosterId: string): Promise<void> {
    const roster = await this.prisma.roster.findUnique({ where: { id: rosterId }, select: { id: true } });
    if (!roster) {
      throw new DomainException(404, 'NOT_FOUND', 'Roster not found');
    }
    if (await this.rosterHasGames(rosterId)) {
      throw new DomainException(409, 'ROSTER_HAS_GAMES', 'This roster has games; archive it instead of deleting');
    }
    await this.prisma.$transaction((tx) => this.deleteRosterCascade(tx, rosterId));
  }

  /** True if any game references a team in this roster (home or away). */
  async rosterHasGames(rosterId: string): Promise<boolean> {
    const count = await this.prisma.game.count({
      where: { OR: [{ homeTeam: { rosterId } }, { awayTeam: { rosterId } }] },
    });
    return count > 0;
  }

  /**
   * Delete a roster and everything it owns, in FK-safe order (all relations are RESTRICT).
   * Only valid when the roster has no games — the caller must check `rosterHasGames` first.
   * Shared by DELETE /rosters/:id and import rollback.
   */
  async deleteRosterCascade(tx: Prisma.TransactionClient, rosterId: string): Promise<void> {
    await tx.depthChartEntry.deleteMany({ where: { depthChart: { team: { rosterId } } } });
    await tx.depthChart.deleteMany({ where: { team: { rosterId } } });
    await tx.coach.deleteMany({ where: { team: { rosterId } } });
    await tx.player.deleteMany({ where: { team: { rosterId } } });
    await tx.team.deleteMany({ where: { rosterId } });
    await tx.roster.delete({ where: { id: rosterId } });
  }

  private toListItem(r: {
    id: string;
    name: string;
    createdAt: Date;
    visibility: Visibility;
    archivedAt: Date | null;
    _count: { teams: number };
  }): RosterListItemDto {
    return {
      id: r.id,
      name: r.name,
      teamCount: r._count.teams,
      createdAt: r.createdAt.toISOString(),
      visibility: r.visibility,
      archived: r.archivedAt !== null,
    };
  }
}
