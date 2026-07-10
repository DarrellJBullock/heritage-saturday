import { ImportParseError, RawImportRow } from './types';

/**
 * JSON workbook convention: top-level keys are sheet names, each mapping to an
 * array of row objects. e.g. { "players": [...], "teams": [...] }
 */
export function parseJson(content: string): RawImportRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new ImportParseError(`Invalid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ImportParseError('JSON root must be an object keyed by sheet name');
  }

  const rows: RawImportRow[] = [];
  for (const [sheetRaw, value] of Object.entries(parsed as Record<string, unknown>)) {
    const sheet = sheetRaw.toLowerCase();
    if (!Array.isArray(value)) {
      throw new ImportParseError(`Sheet "${sheet}" must be an array of rows`);
    }
    value.forEach((raw, rowIndex) => {
      if (typeof raw !== 'object' || raw === null) {
        throw new ImportParseError(`Sheet "${sheet}" row ${rowIndex} is not an object`);
      }
      rows.push({ sheet, rowIndex, raw: raw as Record<string, unknown> });
    });
  }

  return rows;
}
