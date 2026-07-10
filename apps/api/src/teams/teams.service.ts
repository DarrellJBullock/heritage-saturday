import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { PlayerDto, TeamSummaryDto } from '@heritage-saturday/shared';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRoster(rosterId: string, ownerId: string): Promise<TeamSummaryDto[]> {
    // Ownership enforced here (query param, not a route param the guard can see):
    // first predicate is always roster.ownerId per architecture.md §3.
    const roster = await this.prisma.roster.findFirst({ where: { id: rosterId, ownerId } });
    if (!roster) {
      throw new DomainException(404, 'NOT_FOUND', 'Roster not found');
    }

    // Unique per roster (@@unique([rosterId, externalTeamId])), so this is a total order.
    // Without it the list order follows the query plan and can change between reads.
    const teams = await this.prisma.team.findMany({
      where: { rosterId },
      orderBy: { externalTeamId: 'asc' },
    });
    return teams.map((t) => ({
      id: t.id,
      externalTeamId: t.externalTeamId,
      teamName: t.teamName,
      abbreviation: t.abbreviation,
      city: t.city,
      state: t.state,
      conference: t.conference,
      division: t.division,
    }));
  }

  async listPlayers(teamId: string): Promise<PlayerDto[]> {
    // Ownership already enforced by TeamOwnershipGuard at the controller boundary.
    const players = await this.prisma.player.findMany({ where: { teamId }, orderBy: { jerseyNumber: 'asc' } });
    return players.map((p) => ({
      id: p.id,
      externalPlayerId: p.externalPlayerId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      overallRating: p.overallRating,
      archetype: p.archetype,
    }));
  }
}
