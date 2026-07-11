import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { PlayerDto, RosterPlayerDto, TeamDetailDto, TeamSummaryDto } from '@heritage-saturday/shared';
import { Player } from '@prisma/client';
import { isLeagueMember } from '../common/guards/base-read-access.guard';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full team detail for the team page. Ownership is enforced by TeamOwnershipGuard on the
   * route; this is only reached for the caller's own team. */
  async getDetail(teamId: string): Promise<TeamDetailDto> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: { orderBy: { jerseyNumber: 'asc' } },
        band: true,
        rival: { select: { id: true, teamName: true } },
      },
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
      players: team.players.map(toRosterPlayerDto),
      band: team.band
        ? { name: team.band.name, style: team.band.style, chant: team.band.chant, tradition: team.band.tradition }
        : null,
      rival: team.rival
        ? { teamId: team.rival.id, teamName: team.rival.teamName, classicGameName: team.classicGameName }
        : null,
    };
  }

  async listForRoster(rosterId: string, userId: string): Promise<TeamSummaryDto[]> {
    // Access enforced here (rosterId is a query param, not a route param a guard can see):
    // the owner always, or a member of the league when the roster is LEAGUE-visible. 404 (not
    // 403) on denial, matching the ownership/read-access guards.
    const roster = await this.prisma.roster.findUnique({
      where: { id: rosterId },
      select: { ownerId: true, leagueId: true, visibility: true },
    });
    const allowed =
      roster &&
      (roster.ownerId === userId ||
        (roster.visibility === 'LEAGUE' && (await isLeagueMember(this.prisma, roster.leagueId, userId))));
    if (!allowed) {
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
  headshotUrl: string | null;
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
    headshotUrl: p.headshotUrl,
  };
}

/** A roster row with every rating attribute, for the team page's ratings grid. */
function toRosterPlayerDto(p: Player): RosterPlayerDto {
  return {
    ...toPlayerDto(p),
    speed: p.speed,
    strength: p.strength,
    awareness: p.awareness,
    throwPower: p.throwPower,
    throwAccuracy: p.throwAccuracy,
    catching: p.catching,
    routeRunning: p.routeRunning,
    carry: p.carry,
    trucking: p.trucking,
    passBlock: p.passBlock,
    runBlock: p.runBlock,
    tackle: p.tackle,
    coverage: p.coverage,
    kickPower: p.kickPower,
    kickAccuracy: p.kickAccuracy,
  };
}
