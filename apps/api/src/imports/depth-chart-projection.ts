import { REQUIRED_STARTING_POSITIONS } from '../depth-charts/depth-charts.constants';

export interface DepthChartRowRef {
  externalTeamId: string;
  externalPlayerId: string;
  position: string;
}

/**
 * Decides, for each non-ERROR depthchart row, whether commit will actually write it as a
 * DepthChartEntry. Single source of truth shared by the commit transaction and the
 * pre-commit preview projection, so the two summaries cannot drift.
 *
 * A row is written only if all of these hold:
 *  - its team will be committed (otherwise the whole group is orphaned);
 *  - its own player will be committed (an orphaned or ERROR player is never created);
 *  - its team's chart is complete *once undeliverable rows are removed* — every required
 *    starting position is still covered by a surviving row (architecture.md §5: an
 *    incomplete chart is dropped in favour of auto-generation on first read).
 *
 * Completeness is judged on survivors, not on all rows. Judging it before dropping rows
 * whose player will never be created let a chart be declared complete and then written
 * missing a required position — and DepthChartsService.getOrGenerate would immediately
 * regenerate it, so the "IMPORTED" chart was a lie that cost a write. Requiring survivors
 * to cover every required position means a chart is persisted only if it is actually
 * usable; otherwise the whole group falls back to auto-generation, which is the documented
 * behaviour for an incomplete chart.
 *
 * An empty survivor set is subsumed: it cannot cover the required positions.
 *
 * @returns a parallel array: `true` at index i means rows[i] will be created.
 */
export function classifyDepthChartRows(
  rows: readonly DepthChartRowRef[],
  committableTeamIds: ReadonlySet<string>,
  committablePlayerIds: ReadonlySet<string>,
): boolean[] {
  const willCreate = new Array<boolean>(rows.length).fill(false);

  const indicesByTeam = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const list = indicesByTeam.get(row.externalTeamId) ?? [];
    list.push(i);
    indicesByTeam.set(row.externalTeamId, list);
  });

  for (const [externalTeamId, indices] of indicesByTeam.entries()) {
    if (!committableTeamIds.has(externalTeamId)) continue;

    const survivors = indices.filter((i) => committablePlayerIds.has(rows[i].externalPlayerId));

    const positionsCovered = new Set(survivors.map((i) => rows[i].position.toUpperCase()));
    const complete = REQUIRED_STARTING_POSITIONS.every((p) => positionsCovered.has(p));
    if (!complete) continue;

    for (const i of survivors) willCreate[i] = true;
  }

  return willCreate;
}
