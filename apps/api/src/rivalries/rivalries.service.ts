import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';
import { RivalriesResponseDto, RivalryDto } from '@heritage-saturday/shared';

// A rivalry is scored from head-to-head completed games, weighted by closeness (one-score games
// count most) and frequency (repeat meetings accumulate). A pair crossing EMERGING_MIN surfaces
// as EMERGING (pending commissioner approval); crossing SECONDARY_MIN makes it an active secondary
// rival automatically. The primary rival (Team.rivalTeamId) is excluded — it's tracked separately.
const EMERGING_MIN = 4;
const SECONDARY_MIN = 7;

function gamePoints(margin: number): number {
  if (margin <= 3) return 4; // nail-biter
  if (margin <= 7) return 3; // one score
  if (margin <= 14) return 2; // competitive
  return 1; // they met
}

/** Canonical unordered-pair key/order so each pairing has exactly one row (teamAId <= teamBId). */
function canonicalPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

@Injectable()
export class RivalriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recompute rivalry scores from the league's completed games and reconcile with stored rows.
   * Idempotent. Commissioner decisions are preserved: an approved pair stays an active secondary
   * rival, and a dismissed pair stays dismissed, regardless of the recomputed thresholds.
   */
  async recompute(leagueId: string): Promise<void> {
    const games = await this.prisma.game.findMany({
      where: { leagueId, status: 'COMPLETE', homeScore: { not: null }, awayScore: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    });
    const teams = await this.prisma.team.findMany({
      where: { roster: { leagueId } },
      select: { id: true, rivalTeamId: true },
    });
    const primaryPairs = new Set<string>();
    for (const t of teams) {
      if (t.rivalTeamId) primaryPairs.add(canonicalPair(t.id, t.rivalTeamId).join('|'));
    }

    const scoreByPair = new Map<string, number>();
    for (const g of games) {
      if (g.homeScore === null || g.awayScore === null) continue;
      const key = canonicalPair(g.homeTeamId, g.awayTeamId).join('|');
      if (primaryPairs.has(key)) continue; // the primary rivalry is tracked on the team, not here
      const margin = Math.abs(g.homeScore - g.awayScore);
      scoreByPair.set(key, (scoreByPair.get(key) ?? 0) + gamePoints(margin));
    }

    const existing = await this.prisma.rivalry.findMany({ where: { leagueId } });
    const existingByPair = new Map(existing.map((r) => [`${r.teamAId}|${r.teamBId}`, r]));

    for (const [key, score] of scoreByPair) {
      if (score < EMERGING_MIN) continue;
      const [teamAId, teamBId] = key.split('|');
      const ex = existingByPair.get(key);

      let type: string;
      let status: string;
      if (ex?.approved) {
        type = 'SECONDARY';
        status = 'ACTIVE'; // commissioner promoted it — keep it live
      } else if (ex?.status === 'DISMISSED') {
        type = 'EMERGING';
        status = 'DISMISSED'; // commissioner rejected it — don't resurface
      } else if (score >= SECONDARY_MIN) {
        type = 'SECONDARY';
        status = 'ACTIVE';
      } else {
        type = 'EMERGING';
        status = 'PENDING';
      }

      if (ex) {
        await this.prisma.rivalry.update({ where: { id: ex.id }, data: { score, type, status } });
      } else {
        await this.prisma.rivalry.create({ data: { leagueId, teamAId, teamBId, type, status, score } });
      }
    }
  }

  /** Current rivalries: live secondary rivals and pending emerging pairs. Recomputes first. */
  async getRivalries(leagueId: string): Promise<RivalriesResponseDto> {
    await this.recompute(leagueId);
    const rows = await this.prisma.rivalry.findMany({
      where: { leagueId, status: { in: ['ACTIVE', 'PENDING'] } },
      include: {
        teamA: { select: { id: true, teamName: true } },
        teamB: { select: { id: true, teamName: true } },
      },
      orderBy: { score: 'desc' },
    });
    const toDto = (r: (typeof rows)[number]): RivalryDto => ({
      id: r.id,
      teamA: { teamId: r.teamA.id, teamName: r.teamA.teamName },
      teamB: { teamId: r.teamB.id, teamName: r.teamB.teamName },
      type: r.type as 'SECONDARY' | 'EMERGING',
      status: r.status as 'ACTIVE' | 'PENDING',
      score: r.score,
    });
    return {
      active: rows.filter((r) => r.status === 'ACTIVE').map(toDto),
      emerging: rows.filter((r) => r.status === 'PENDING').map(toDto),
    };
  }

  /** Commissioner promotes an emerging pair to a live secondary rival (sticks across recomputes). */
  async approve(rivalryId: string, leagueId: string): Promise<RivalriesResponseDto> {
    await this.requireRivalry(rivalryId, leagueId);
    await this.prisma.rivalry.update({
      where: { id: rivalryId },
      data: { approved: true, type: 'SECONDARY', status: 'ACTIVE' },
    });
    return this.getRivalries(leagueId);
  }

  /** Commissioner dismisses an emerging pair; it won't resurface on recompute. */
  async dismiss(rivalryId: string, leagueId: string): Promise<RivalriesResponseDto> {
    await this.requireRivalry(rivalryId, leagueId);
    await this.prisma.rivalry.update({
      where: { id: rivalryId },
      data: { approved: false, status: 'DISMISSED' },
    });
    return this.getRivalries(leagueId);
  }

  private async requireRivalry(rivalryId: string, leagueId: string): Promise<void> {
    const found = await this.prisma.rivalry.findFirst({ where: { id: rivalryId, leagueId } });
    if (!found) {
      throw new DomainException(404, 'NOT_FOUND', 'Rivalry not found');
    }
  }
}
