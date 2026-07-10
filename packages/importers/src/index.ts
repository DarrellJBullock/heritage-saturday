export * from './types';
export { parseCsv } from './csv';
export { parseJson } from './json';
export { parseXlsx } from './xlsx';

import { FileFormat, ImportParseError, RawImportRow } from './types';
import { parseCsv } from './csv';
import { parseJson } from './json';
import { parseXlsx } from './xlsx';

/**
 * Dispatch to the correct format-specific parser. `apps/api` is responsible for
 * MIME/extension sniffing to determine `format` before calling this.
 */
export function parseFile(input: Buffer | string, format: FileFormat): RawImportRow[] {
  switch (format) {
    case 'csv':
      return parseCsv(typeof input === 'string' ? input : input.toString('utf-8'));
    case 'json':
      return parseJson(typeof input === 'string' ? input : input.toString('utf-8'));
    case 'xlsx':
    case 'xls':
      return parseXlsx(typeof input === 'string' ? Buffer.from(input) : input);
    default:
      throw new ImportParseError(`Unsupported file format: ${format}`);
  }
}

export function detectFormat(fileName: string, mimeType?: string): FileFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  if (ext === 'json' || mimeType === 'application/json') return 'json';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  return null;
}
