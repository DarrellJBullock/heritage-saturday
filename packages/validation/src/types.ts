import { ImportRowStatus } from '@heritage-saturday/shared';

export interface RawImportRow {
  sheet: string;
  rowIndex: number;
  raw: Record<string, unknown>;
}

export interface ValidatedImportRow extends RawImportRow {
  status: ImportRowStatus;
  messages: string[];
  entityRefId?: string | null;
}

export interface RowValidationResult {
  status: ImportRowStatus;
  messages: string[];
  entityRefId?: string | null;
}
