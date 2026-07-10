import { NON_BLOCKING_SHEETS } from '@heritage-saturday/shared';
import { RawImportRow, ValidatedImportRow } from './types';
import {
  validateCoachRow,
  validateDepthChartRow,
  validatePlayerRow,
  validateTeamRow,
} from './rowValidators';
import { toStr } from './fieldRules';

export * from './types';
export * from './fieldRules';
export * from './rowValidators';

/**
 * Runs per-row structural validation for every row, then applies cross-row
 * rules (duplicate player_id/team_id, duplicate jersey per team) per
 * company-docs/architecture.md §5. Non-blocking sheets (headshots/bands/
 * rivalries) are always forced to OK regardless of content.
 */
export function validateImportRows(rows: RawImportRow[]): ValidatedImportRow[] {
  const results: ValidatedImportRow[] = rows.map((row) => {
    const sheet = row.sheet.toLowerCase();

    if ((NON_BLOCKING_SHEETS as string[]).includes(sheet)) {
      return { ...row, status: 'OK', messages: [], entityRefId: null };
    }

    switch (sheet) {
      case 'players': {
        const r = validatePlayerRow(row.raw);
        return { ...row, ...r };
      }
      case 'teams': {
        const r = validateTeamRow(row.raw);
        return { ...row, ...r };
      }
      case 'coaches': {
        const r = validateCoachRow(row.raw);
        return { ...row, ...r };
      }
      case 'depthchart': {
        const r = validateDepthChartRow(row.raw);
        return { ...row, ...r };
      }
      default: {
        // Unknown sheet: stored, never blocking (treated like a non-blocking sheet).
        return { ...row, status: 'OK', messages: [], entityRefId: null };
      }
    }
  });

  applyCrossRowRules(results);
  // Must run after applyCrossRowRules: a duplicate team_id marks the teams row ERROR,
  // and a row pointing at a team that won't be committed is itself an orphan.
  applyOrphanReferenceRules(results);

  return results;
}

function markOrphan(row: ValidatedImportRow, message: string): void {
  row.status = 'WARNING';
  row.messages.push(message);
}

/**
 * The only rules that emit WARNING in Capability 1.
 *
 * An orphan row references an entity that will not exist after commit. Such a row is
 * structurally valid on its own — the reason it can't land is a sibling row's absence.
 * ImportsService's commit loops silently `continue` past these (no FK error, commit is
 * never aborted), so the row is dropped rather than written. ERROR would misdirect the
 * user to fix this row; the actual fix is on the Teams or Players sheet. Hence WARNING,
 * with a message that says plainly the row will not be created.
 *
 * A *blank* reference stays ERROR (the existing missing-required-field rules): that is a
 * defect in the row itself, not a linkage gap.
 *
 * Order is load-bearing. Teams settle first, then players (which can be orphaned by a
 * missing team), and only then depthchart — because a depthchart row pointing at a player
 * who was himself orphaned is equally undeliverable.
 */
function applyOrphanReferenceRules(rows: ValidatedImportRow[]): void {
  const sheetOf = (r: ValidatedImportRow) => r.sheet.toLowerCase();

  const committableTeamIds = new Set(
    rows
      .filter((r) => sheetOf(r) === 'teams' && r.status !== 'ERROR')
      .map((r) => toStr(r.raw.team_id))
      .filter((id) => id !== ''),
  );

  const orphanedByTeam = (row: ValidatedImportRow): boolean => {
    const teamId = toStr(row.raw.team_id);
    return teamId !== '' && !committableTeamIds.has(teamId);
  };

  // 1. Players — orphaned when their team won't be committed.
  for (const row of rows) {
    if (sheetOf(row) !== 'players' || row.status === 'ERROR') continue;
    if (!orphanedByTeam(row)) continue;
    markOrphan(
      row,
      `team_id "${toStr(row.raw.team_id)}" does not match any team in this import — this player will not be created until a matching team is added`,
    );
  }

  // 2. Coaches — same rule, same drop point (ImportsService coach loop).
  for (const row of rows) {
    if (sheetOf(row) !== 'coaches' || row.status === 'ERROR') continue;
    if (!orphanedByTeam(row)) continue;
    markOrphan(
      row,
      `team_id "${toStr(row.raw.team_id)}" does not match any team in this import — this coach will not be created until a matching team is added`,
    );
  }

  // 3. DepthChart — orphaned by a missing team OR by a player who won't be created.
  //    Computed after step 1 so a WARNING (orphaned) player is not treated as committable.
  const committablePlayerIds = new Set(
    rows
      .filter((r) => sheetOf(r) === 'players' && r.status === 'OK')
      .map((r) => toStr(r.raw.player_id))
      .filter((id) => id !== ''),
  );

  for (const row of rows) {
    if (sheetOf(row) !== 'depthchart' || row.status === 'ERROR') continue;

    if (orphanedByTeam(row)) {
      markOrphan(
        row,
        `team_id "${toStr(row.raw.team_id)}" does not match any team in this import — this depth chart entry will not be created until a matching team is added`,
      );
      continue; // One reason is enough; naming the team first points at the root cause.
    }

    const playerId = toStr(row.raw.player_id);
    if (playerId !== '' && !committablePlayerIds.has(playerId)) {
      markOrphan(
        row,
        `player_id "${playerId}" does not match any player that will be created by this import — this depth chart entry will be dropped`,
      );
    }
  }
}

function applyCrossRowRules(rows: ValidatedImportRow[]): void {
  // Duplicate player_id across the "players" sheet.
  const playerIdSeen = new Map<string, number>();
  // Duplicate team_id across the "teams" sheet.
  const teamIdSeen = new Map<string, number>();
  // Duplicate jersey number within the same team_id, across "players" sheet.
  const jerseySeen = new Map<string, number>();

  for (const row of rows) {
    const sheet = row.sheet.toLowerCase();

    if (sheet === 'players') {
      const playerId = toStr(row.raw.player_id);
      const teamId = toStr(row.raw.team_id);
      const jersey = toStr(row.raw.jersey_number);

      if (playerId) {
        playerIdSeen.set(playerId, (playerIdSeen.get(playerId) ?? 0) + 1);
      }
      if (teamId && jersey) {
        const key = `${teamId}::${jersey}`;
        jerseySeen.set(key, (jerseySeen.get(key) ?? 0) + 1);
      }
    }

    if (sheet === 'teams') {
      const teamId = toStr(row.raw.team_id);
      if (teamId) {
        teamIdSeen.set(teamId, (teamIdSeen.get(teamId) ?? 0) + 1);
      }
    }
  }

  for (const row of rows) {
    const sheet = row.sheet.toLowerCase();

    if (sheet === 'players') {
      const playerId = toStr(row.raw.player_id);
      const teamId = toStr(row.raw.team_id);
      const jersey = toStr(row.raw.jersey_number);

      if (playerId && (playerIdSeen.get(playerId) ?? 0) > 1) {
        markError(row, `Duplicate player_id "${playerId}" appears more than once in this import`);
      }
      if (teamId && jersey) {
        const key = `${teamId}::${jersey}`;
        if ((jerseySeen.get(key) ?? 0) > 1) {
          markError(row, `Duplicate jersey_number "${jersey}" for team_id "${teamId}"`);
        }
      }
    }

    if (sheet === 'teams') {
      const teamId = toStr(row.raw.team_id);
      if (teamId && (teamIdSeen.get(teamId) ?? 0) > 1) {
        markError(row, `Duplicate team_id "${teamId}" appears more than once in this import`);
      }
    }
  }
}

function markError(row: ValidatedImportRow, message: string): void {
  row.status = 'ERROR';
  row.messages.push(message);
}
