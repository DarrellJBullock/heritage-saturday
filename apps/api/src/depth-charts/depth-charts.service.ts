import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Position } from '@heritage-saturday/shared';
import { DepthChartResponseDto } from '@heritage-saturday/shared';
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

    if (!depthChart || isIncomplete) {
      depthChart = await this.generateAndPersist(teamId);
    }

    const { legal, unfilled } = await this.checkLegalityFromEntries(
      teamId,
      depthChart.entries.map((e) => e.position),
    );

    return {
      teamId,
      source: depthChart.source as 'IMPORTED' | 'AUTO_GENERATED',
      entries: depthChart.entries.map((e) => ({ position: e.position, slot: e.slot, playerId: e.playerId })),
      legal,
      warnings: unfilled.map((p) => `${p} unfilled`),
    };
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
