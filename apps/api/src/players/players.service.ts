import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Player } from '@prisma/client';

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
}
