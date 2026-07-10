import Papa from 'papaparse';
import { ImportParseError, RawImportRow } from './types';

/**
 * CSV is single-sheet by nature. Convention: a `sheet` column identifies which
 * logical sheet each row belongs to; rows without one default to "players"
 * (the most common single-sheet upload case).
 */
export function parseCsv(content: string): RawImportRow[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors && result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type !== 'FieldMismatch');
    if (fatal) {
      throw new ImportParseError(`CSV parse error: ${fatal.message}`);
    }
  }

  const rows: RawImportRow[] = [];
  const perSheetIndex: Record<string, number> = {};

  for (const raw of result.data) {
    if (!raw || Object.keys(raw).length === 0) continue;
    const sheet = String((raw as Record<string, unknown>).sheet ?? 'players').toLowerCase();
    const idx = perSheetIndex[sheet] ?? 0;
    perSheetIndex[sheet] = idx + 1;
    rows.push({ sheet, rowIndex: idx, raw });
  }

  return rows;
}
