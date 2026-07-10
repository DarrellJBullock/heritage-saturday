// Heritage Saturday — shared enums/constants
// Source of truth: company-docs/architecture.md §3 / prisma schema. Kept in sync manually
// since packages/shared has zero runtime deps on Prisma.

export const POSITIONS = [
  'QB', 'RB', 'FB', 'WR', 'TE',
  'LT', 'LG', 'C', 'RG', 'RT',
  'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB',
  'CB', 'FS', 'SS',
  'K', 'P', 'KR', 'PR',
] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * Minimum-viable-lineup positions per architecture.md §6 and product-spec Open Question #1.
 * KR/PR are return specialists, not required to field a legal lineup in Cap 1.
 *
 * Lives here rather than in apps/api because both `packages/validation` (which decides at
 * stage time whether an imported depth chart can be used) and `apps/api` (which decides at
 * commit time whether to persist it) must agree on the same list.
 */
export const REQUIRED_STARTING_POSITIONS: Position[] = [
  'QB', 'RB', 'WR', 'TE',
  'LT', 'LG', 'C', 'RG', 'RT',
  'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB',
  'CB', 'FS', 'SS',
  'K', 'P',
];

export const OFFENSIVE_ARCHETYPES = [
  'BALANCED', 'POWER_RUN', 'SPREAD', 'VERTICAL_PASSING',
  'WEST_COAST', 'OPTION_RPO', 'PLAY_ACTION_HEAVY',
] as const;
export type OffensiveArchetype = (typeof OFFENSIVE_ARCHETYPES)[number];

export const DEFENSIVE_ARCHETYPES = [
  'BALANCED_4_3', 'BASE_3_4', 'NICKEL_ZONE', 'BLITZ_HEAVY',
  'MAN_COVERAGE', 'BEND_DONT_BREAK', 'RUN_STOP',
] as const;
export type DefensiveArchetype = (typeof DEFENSIVE_ARCHETYPES)[number];

export const IMPORT_ROW_STATUSES = ['OK', 'WARNING', 'ERROR'] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const IMPORT_STATUSES = ['PENDING', 'COMMITTED', 'FAILED'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const GAME_STATUSES = ['PENDING', 'RUNNING', 'COMPLETE', 'FAILED'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const IMPORT_SHEETS = [
  'players', 'teams', 'coaches', 'depthchart', 'headshots', 'bands', 'rivalries',
] as const;
export type ImportSheet = (typeof IMPORT_SHEETS)[number];

// Non-blocking sheets per architecture.md §5 — parsed/stored, never validated/blocking.
export const NON_BLOCKING_SHEETS: ImportSheet[] = ['headshots', 'bands', 'rivalries'];
