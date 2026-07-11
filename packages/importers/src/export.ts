// Workbook writers — the inverse of the parsers. Pure (no DB, no Nest): callers pass plain
// column-keyed rows and get an .xlsx Buffer back. Column order is the canonical import layout,
// so a file produced here re-imports cleanly (round-trips).

import * as XLSX from 'xlsx';

export const TEMPLATE_TEAM_COLUMNS = [
  'team_id',
  'team_name',
  'abbreviation',
  'city',
  'state',
  'conference',
  'division',
  'coach_name',
  'primary_color',
  'secondary_color',
  'accent_color',
  'helmet_color',
  'home_jersey_color',
  'away_jersey_color',
] as const;

export const TEMPLATE_PLAYER_COLUMNS = [
  'player_id',
  'team_id',
  'first_name',
  'last_name',
  'position',
  'jersey_number',
  'archetype',
  'overall_rating',
  'speed',
  'strength',
  'awareness',
  'throw_power',
  'throw_accuracy',
  'catching',
  'route_running',
  'carry',
  'trucking',
  'pass_block',
  'run_block',
  'tackle',
  'coverage',
  'kick_power',
  'kick_accuracy',
  'headshot_url',
] as const;

export type ExportRow = Record<string, string | number | null>;

function toWorkbook(teams: ExportRow[], players: ExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  // `header` fixes the column order and guarantees every header appears even when a row omits it.
  const teamsSheet = XLSX.utils.json_to_sheet(teams, { header: [...TEMPLATE_TEAM_COLUMNS] });
  const playersSheet = XLSX.utils.json_to_sheet(players, { header: [...TEMPLATE_PLAYER_COLUMNS] });
  XLSX.utils.book_append_sheet(wb, teamsSheet, 'teams');
  XLSX.utils.book_append_sheet(wb, playersSheet, 'players');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** A blank workbook: just the header rows on the `teams` and `players` sheets. */
export function buildBlankTemplate(): Buffer {
  return toWorkbook([], []);
}

/** A populated workbook for export. Rows must already be keyed by the canonical column names. */
export function buildRosterWorkbook(teams: ExportRow[], players: ExportRow[]): Buffer {
  return toWorkbook(teams, players);
}
