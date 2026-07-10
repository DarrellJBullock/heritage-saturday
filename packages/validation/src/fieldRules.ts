import { POSITIONS } from '@heritage-saturday/shared';

export function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

export function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function isValidPosition(v: unknown): boolean {
  return (POSITIONS as readonly string[]).includes(toStr(v).toUpperCase());
}

export function isRatingInRange(v: unknown, min = 0, max = 99): boolean {
  const n = toInt(v);
  return n !== null && n >= min && n <= max;
}
