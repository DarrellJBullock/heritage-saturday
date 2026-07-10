// Shared API error shape per company-docs/architecture.md §8.

export const DOMAIN_ERROR_CODES = [
  'UNFILLABLE_POSITIONS',
  'IMPORT_ALREADY_COMMITTED',
  'UNSUPPORTED_FILE_FORMAT',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'BAD_REQUEST',
] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export interface ApiErrorShape {
  statusCode: number;
  error: DomainErrorCode | string;
  message: string;
  detail?: Record<string, unknown>;
}
