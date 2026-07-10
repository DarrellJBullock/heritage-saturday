import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Player } from '@prisma/client';
import { PlayerDetailDto } from '@heritage-saturday/shared';
import { DomainException } from '../common/errors/domain-exception';

/**
 * PlayersModule per architecture.md §2: read access to Player, scoped via
 * team -> roster ownership at the controller boundary (see TeamsModule for the
 * exposed /teams/:id/players route). This service also provides the full
 * rating rows other modules (DepthCharts, Games) need — it does not own depth
 * chart assignment logic, only exposes raw player data.
 */
@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async getFullRosterForTeam(teamId: string): Promise<Player[]> {
    // Unique per team (@@unique([teamId, jerseyNumber])), so this is a total order.
    return this.prisma.player.findMany({ where: { teamId }, orderBy: { jerseyNumber: 'asc' } });
  }

  /** Full player detail for the player page. Ownership is enforced by PlayerOwnershipGuard on
   * the route; this is only reached for a player the caller owns. */
  async getDetail(playerId: string): Promise<PlayerDetailDto> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { team: { select: { id: true, teamName: true } } },
    });
    if (!player) {
      throw new DomainException(404, 'NOT_FOUND', 'Player not found');
    }
    return {
      id: player.id,
      externalPlayerId: player.externalPlayerId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      overallRating: player.overallRating,
      archetype: player.archetype,
      teamId: player.team.id,
      teamName: player.team.teamName,
      speed: player.speed,
      strength: player.strength,
      awareness: player.awareness,
      throwPower: player.throwPower,
      throwAccuracy: player.throwAccuracy,
      catching: player.catching,
      routeRunning: player.routeRunning,
      carry: player.carry,
      trucking: player.trucking,
      passBlock: player.passBlock,
      runBlock: player.runBlock,
      tackle: player.tackle,
      coverage: player.coverage,
      kickPower: player.kickPower,
      kickAccuracy: player.kickAccuracy,
    };
  }
}
