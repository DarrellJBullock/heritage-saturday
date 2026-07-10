import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { RosterDetailDto, RosterListItemDto, Visibility } from '@heritage-saturday/shared';

@Injectable()
export class RostersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOwner(ownerId: string): Promise<RosterListItemDto[]> {
    const rosters = await this.prisma.roster.findMany({
      where: { ownerId },
      include: { _count: { select: { teams: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rosters.map((r) => ({
      id: r.id,
      name: r.name,
      teamCount: r._count.teams,
      createdAt: r.createdAt.toISOString(),
      visibility: r.visibility,
    }));
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
   * Set a roster's visibility. Owner-only — enforced by RosterOwnershipGuard on the route.
   * Promoting to LEAGUE lets every member of the league read this roster and its teams/players.
   */
  async setVisibility(rosterId: string, visibility: Visibility): Promise<RosterListItemDto> {
    const roster = await this.prisma.roster.update({
      where: { id: rosterId },
      data: { visibility },
      include: { _count: { select: { teams: true } } },
    });
    return {
      id: roster.id,
      name: roster.name,
      teamCount: roster._count.teams,
      createdAt: roster.createdAt.toISOString(),
      visibility: roster.visibility,
    };
  }
}
