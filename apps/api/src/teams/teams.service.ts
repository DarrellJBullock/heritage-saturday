import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { PlayerDto, TeamDetailDto, TeamSummaryDto } from '@heritage-saturday/shared';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full team detail for the team page. Ownership is enforced by TeamOwnershipGuard on the
   * route; this is only reached for the caller's own team. */
  async getDetail(teamId: string): Promise<TeamDetailDto> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { players: { orderBy: { jerseyNumber: 'asc' } } },
    });
    if (!team) {
      throw new DomainException(404, 'NOT_FOUND', 'Team not found');
    }
    return {
      id: team.id,
      externalTeamId: team.externalTeamId,
      teamName: team.teamName,
      abbreviation: team.abbreviation,
      city: team.city,
      state: team.state,
      conference: team.conference,
      division: team.division,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      coachName: team.coachName,
      players: team.players.map(toPlayerDto),
    };
  }

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
    return players.map(toPlayerDto);
  }
}

/** The summary shape of a Player, shared by the roster list and the team page. */
function toPlayerDto(p: {
  id: string;
  externalPlayerId: string;
  firstName: string;
  lastName: string;
  position: PlayerDto['position'];
  jerseyNumber: number;
  overallRating: number;
  archetype: string | null;
}): PlayerDto {
  return {
    id: p.id,
    externalPlayerId: p.externalPlayerId,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    jerseyNumber: p.jerseyNumber,
    overallRating: p.overallRating,
    archetype: p.archetype,
  };
}
