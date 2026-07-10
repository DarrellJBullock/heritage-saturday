import * as XLSX from 'xlsx';
import { ImportParseError, KNOWN_SHEETS, RawImportRow } from './types';

/**
 * XLSX/XLS: each workbook tab is a sheet, tab name is the sheet name (lowercased).
 */
export function parseXlsx(buffer: Buffer): RawImportRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    throw new ImportParseError(`Unable to read workbook: ${(e as Error).message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new ImportParseError('Workbook contains no sheets');
  }

  // SheetJS's XLSX.read() does not throw on non-workbook (e.g. plain-text/garbage)
  // input — it silently yields a workbook with no recognized roster sheets and/or no
  // data rows. Without these guards such a file would be accepted as an empty, seemingly
  // successful import, violating Story 1 AC7 ("corrupt content -> clear top-level error,
  // no partial import"). So we reject anything that doesn't parse into at least one
  // recognized sheet carrying at least one data row.
  const hasKnownSheet = workbook.SheetNames.some((n) => KNOWN_SHEETS.has(n.toLowerCase()));
  if (!hasKnownSheet) {
    throw new ImportParseError(
      `Workbook contains no recognized roster sheets (expected at least one of: ${[...KNOWN_SHEETS].join(', ')})`,
    );
  }

  const rows: RawImportRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = sheetName.toLowerCase();
    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    json.forEach((raw, rowIndex) => {
      rows.push({ sheet, rowIndex, raw });
    });
  }

  if (rows.length === 0) {
    throw new ImportParseError('Workbook contains no data rows');
  }

  return rows;
}
