// Common intermediate row shape produced by every format-specific parser.
// Per company-docs/architecture.md §2/§5. No DB, no validation, no Nest deps here.

import { IMPORT_SHEETS, NON_BLOCKING_SHEETS } from '@heritage-saturday/shared';

/**
 * The roster-bearing sheets: every recognized sheet minus the non-blocking ones
 * (headshots/bands/rivalries), which carry no roster data. Derived from shared's
 * canonical taxonomy rather than re-listed here so the two cannot drift.
 *
 * Used by parseXlsx to tell a real workbook from garbage: SheetJS happily "reads"
 * arbitrary bytes into a workbook with unrecognized tabs, so a file yielding none
 * of these is rejected rather than accepted as an empty import.
 */
export const KNOWN_SHEETS: ReadonlySet<string> = new Set(
  IMPORT_SHEETS.filter((sheet) => !(NON_BLOCKING_SHEETS as string[]).includes(sheet)),
);

export interface RawImportRow {
  sheet: string; // players | teams | coaches | depthchart | headshots | bands | rivalries
  rowIndex: number; // 0-based index within its sheet
  raw: Record<string, unknown>;
}

export type FileFormat = 'csv' | 'json' | 'xlsx' | 'xls';

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportParseError';
  }
}
