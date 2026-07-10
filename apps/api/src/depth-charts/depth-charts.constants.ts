import { Position } from '@heritage-saturday/shared';

// Minimum-viable-lineup required positions per company-docs/architecture.md §6
// ("Minimum viable roster / unfillable position handling") and product-spec.md
// Open Question #1. KR/PR are return-specialist slots, not required to field a
// legal lineup in Cap 1 — eligibility/flex rules here are an Engineering call,
// not an API contract change.
export const REQUIRED_STARTING_POSITIONS: Position[] = [
  'QB', 'RB', 'WR', 'TE',
  'LT', 'LG', 'C', 'RG', 'RT',
  'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB',
  'CB', 'FS', 'SS',
  'K', 'P',
];

export const MAX_DEPTH_SLOTS_PER_POSITION = 4; // slot 0 (starter) .. 3 (3rd backup)
