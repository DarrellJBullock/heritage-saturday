import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Position } from '@heritage-saturday/shared';
import { DepthChartEntryDto, DepthChartResponseDto } from '@heritage-saturday/shared';
import { MAX_DEPTH_SLOTS_PER_POSITION, REQUIRED_STARTING_POSITIONS } from './depth-charts.constants';
import { DomainException } from '../common/errors/domain-exception';

export interface LegalityResult {
  legal: boolean;
  unfilled: Position[];
}

@Injectable()
export class DepthChartsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads the team's depth chart, auto-generating (and persisting) one from
   * player ratings by position if none exists or the existing one is missing
   * a required starting position. Per architecture.md §4.
   */
  async getOrGenerate(teamId: string): Promise<DepthChartResponseDto> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new DomainException(404, 'NOT_FOUND', 'Team not found');
    }

    let depthChart = await this.prisma.depthChart.findFirst({
      where: { teamId },
      include: { entries: { orderBy: [{ position: 'asc' }, { slot: 'asc' }] } },
      orderBy: { generatedAt: 'desc' },
    });

    const filledPositions = new Set((depthChart?.entries ?? []).map((e) => e.position));
    const isIncomplete = REQUIRED_STARTING_POSITIONS.some((pos) => !filledPositions.has(pos));

    // Auto-generate when there's no chart, or when an auto/imported one is incomplete. A MANUAL
    // chart is the owner's deliberate choice — never silently regenerate over it (saveManual
    // already guarantees it's legal, so this branch normally wouldn't fire for MANUAL anyway).
    if (!depthChart || (depthChart.source !== 'MANUAL' && isIncomplete)) {
      depthChart = await this.generateAndPersist(teamId);
    }

    const { legal, unfilled } = await this.checkLegalityFromEntries(
      teamId,
      depthChart.entries.map((e) => e.position),
    );

    return {
      teamId,
      source: depthChart.source as 'IMPORTED' | 'AUTO_GENERATED' | 'MANUAL',
      entries: depthChart.entries.map((e) => ({ position: e.position, slot: e.slot, playerId: e.playerId })),
      legal,
      warnings: unfilled.map((p) => `${p} unfilled`),
    };
  }

  /**
   * Replace a team's depth chart by hand (owner-only). Validates that the chart references only
   * this team's players, places each at their own position, has no duplicate slot or player, and
   * fills every required starting position at slot 0 — so the result is always legal and
   * getOrGenerate never regenerates over it. The full chart is sent, not a delta.
   */
  async saveManual(teamId: string, entries: DepthChartEntryDto[]): Promise<DepthChartResponseDto> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { players: { select: { id: true, position: true } } },
    });
    if (!team) {
      throw new DomainException(404, 'NOT_FOUND', 'Team not found');
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new DomainException(400, 'BAD_REQUEST', 'A depth chart needs at least one entry');
    }

    const positionByPlayer = new Map(team.players.map((p) => [p.id, p.position as Position]));
    const seenSlots = new Set<string>();
    const seenPlayers = new Set<string>();
    for (const e of entries) {
      if (!e || typeof e.slot !== 'number' || e.slot < 0 || e.slot >= MAX_DEPTH_SLOTS_PER_POSITION) {
        throw new DomainException(400, 'BAD_REQUEST', `slot must be between 0 and ${MAX_DEPTH_SLOTS_PER_POSITION - 1}`);
      }
      const actualPosition = positionByPlayer.get(e.playerId);
      if (!actualPosition) {
        throw new DomainException(400, 'BAD_REQUEST', `Player ${e.playerId} is not on this team`);
      }
      if (actualPosition !== e.position) {
        throw new DomainException(400, 'BAD_REQUEST', `Player ${e.playerId} plays ${actualPosition}, not ${e.position}`);
      }
      const slotKey = `${e.position}#${e.slot}`;
      if (seenSlots.has(slotKey)) {
        throw new DomainException(400, 'BAD_REQUEST', `Two players share ${e.position} slot ${e.slot}`);
      }
      if (seenPlayers.has(e.playerId)) {
        throw new DomainException(400, 'BAD_REQUEST', `Player ${e.playerId} appears in the chart more than once`);
      }
      seenSlots.add(slotKey);
      seenPlayers.add(e.playerId);
    }

    const starters = new Set(entries.filter((e) => e.slot === 0).map((e) => e.position));
    const unfilled = REQUIRED_STARTING_POSITIONS.filter((pos) => !starters.has(pos));
    if (unfilled.length > 0) {
      throw new DomainException(
        400,
        'BAD_REQUEST',
        `Every starting position needs a player (slot 0). Missing: ${unfilled.join(', ')}`,
      );
    }

    // Replace atomically: drop the team's existing chart(s), then write the manual one.
    await this.prisma.$transaction(async (tx) => {
      await tx.depthChartEntry.deleteMany({ where: { depthChart: { teamId } } });
      await tx.depthChart.deleteMany({ where: { teamId } });
      await tx.depthChart.create({
        data: {
          teamId,
          source: 'MANUAL',
          entries: {
            create: entries.map((e) => ({ position: e.position, slot: e.slot, playerId: e.playerId })),
          },
        },
      });
    });

    return this.getOrGenerate(teamId);
  }

  /**
   * Used by GamesModule as a black-box legality check before running a game —
   * per architecture.md §6, GamesModule consumes this, it doesn't own the rule.
   */
  async checkLegality(teamId: string): Promise<LegalityResult> {
    await this.getOrGenerate(teamId); // ensures a depth chart exists
    const depthChart = await this.prisma.depthChart.findFirst({
      where: { teamId },
      include: { entries: { orderBy: [{ position: 'asc' }, { slot: 'asc' }] } },
      orderBy: { generatedAt: 'desc' },
    });
    const positions = (depthChart?.entries ?? []).map((e) => e.position);
    return this.checkLegalityFromEntries(teamId, positions);
  }

  private async checkLegalityFromEntries(_teamId: string, positions: Position[]): Promise<LegalityResult> {
    const filled = new Set(positions);
    const unfilled = REQUIRED_STARTING_POSITIONS.filter((pos) => !filled.has(pos));
    return { legal: unfilled.length === 0, unfilled };
  }

  private async generateAndPersist(teamId: string) {
    // `id: 'asc'` is the tie-break, not decoration: teams routinely carry two players at a
    // position with the same overallRating, and whichever comes back first becomes the
    // slot-0 starter. Ordering by rating alone leaves that choice to the query plan, so the
    // generated chart — and therefore the game — could differ between two identical runs.
    const players = await this.prisma.player.findMany({
      where: { teamId },
      orderBy: [{ overallRating: 'desc' }, { id: 'asc' }],
    });

    const byPosition = new Map<Position, typeof players>();
    for (const p of players) {
      const list = byPosition.get(p.position) ?? [];
      list.push(p);
      byPosition.set(p.position, list);
    }

    const entriesData: { position: Position; slot: number; playerId: string }[] = [];
    for (const pos of REQUIRED_STARTING_POSITIONS) {
      const candidates = (byPosition.get(pos) ?? []).slice(0, MAX_DEPTH_SLOTS_PER_POSITION);
      candidates.forEach((player, slot) => {
        entriesData.push({ position: pos, slot, playerId: player.id });
      });
    }

    return this.prisma.depthChart.create({
      data: {
        teamId,
        source: 'AUTO_GENERATED',
        entries: { create: entriesData },
      },
      include: { entries: { orderBy: [{ position: 'asc' }, { slot: 'asc' }] } },
    });
  }
}
