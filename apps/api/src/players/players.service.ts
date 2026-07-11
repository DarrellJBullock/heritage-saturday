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

  /** Full player detail for the player page. Read access (owner or league member) is enforced by
   * PlayerReadAccessGuard on the route; `canEditHeadshot` is true only for the owner. */
  async getDetail(playerId: string, userId: string): Promise<PlayerDetailDto> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { team: { select: { id: true, teamName: true, roster: { select: { ownerId: true } } } } },
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
      headshotUrl: player.headshotUrl,
      teamId: player.team.id,
      teamName: player.team.teamName,
      canEditHeadshot: player.team.roster.ownerId === userId,
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

  /**
   * Set or clear a player's headshot URL. Owner-only (PlayerOwnershipGuard on the route). A
   * null/blank value clears it; otherwise the URL must be a well-formed https image link — http
   * is rejected so a photo can't be blocked as mixed content on the deployed https site.
   */
  async setHeadshot(playerId: string, rawUrl: string | null, userId: string): Promise<PlayerDetailDto> {
    const headshotUrl = normalizeHeadshotUrl(rawUrl);
    // updateMany with a not-found result is impossible here — the guard already resolved the
    // player and confirmed ownership — but update throws if the row vanished, which is fine.
    await this.prisma.player.update({ where: { id: playerId }, data: { headshotUrl } });
    return this.getDetail(playerId, userId);
  }
}

/** Validate an https image URL, or null to clear. Throws a 400 DomainException on a bad value. */
function normalizeHeadshotUrl(raw: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048) {
    throw new DomainException(400, 'BAD_REQUEST', 'Headshot URL is too long (max 2048 characters)');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DomainException(400, 'BAD_REQUEST', 'Headshot URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new DomainException(400, 'BAD_REQUEST', 'Headshot URL must start with https://');
  }
  return trimmed;
}
