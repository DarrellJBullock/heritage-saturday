import type { OffensiveArchetype, DefensiveArchetype } from '@heritage-saturday/shared';

// Display labels for the fixed archetype lists (company-docs/vision.md).
// Values themselves come from @heritage-saturday/shared; this file only maps
// enum values to human-readable copy.

export const OFFENSIVE_ARCHETYPE_LABELS: Record<OffensiveArchetype, string> = {
  BALANCED: 'Balanced',
  POWER_RUN: 'Power Run',
  SPREAD: 'Spread',
  VERTICAL_PASSING: 'Vertical Passing',
  WEST_COAST: 'West Coast',
  OPTION_RPO: 'Option/RPO',
  PLAY_ACTION_HEAVY: 'Play Action Heavy',
};

export const DEFENSIVE_ARCHETYPE_LABELS: Record<DefensiveArchetype, string> = {
  BALANCED_4_3: "Balanced 4-3",
  BASE_3_4: 'Base 3-4',
  NICKEL_ZONE: 'Nickel Zone',
  BLITZ_HEAVY: 'Blitz Heavy',
  MAN_COVERAGE: 'Man Coverage',
  BEND_DONT_BREAK: "Bend-Don't-Break",
  RUN_STOP: 'Run Stop',
};
