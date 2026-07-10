import { OffensiveArchetype, DefensiveArchetype } from '@heritage-saturday/shared';

// Static tendency-weight config per architecture.md §3/§7: "fixed archetype
// definitions (tendency weights) live as static config inside
// packages/simulation-engine, not in Postgres."

export interface OffenseArchetypeConfig {
  passRatio: number; // 0-1, share of plays that are pass plays
  aggression: number; // 0-1, higher = more scoring variance / bigger plays
  turnoverRisk: number; // 0-1, higher = more giveaways
}

export interface DefenseArchetypeConfig {
  runStop: number; // 0-1, higher = better at limiting rush yards
  passDefense: number; // 0-1, higher = better at limiting pass yards
  turnoverGen: number; // 0-1, higher = forces more takeaways
}

export const OFFENSE_ARCHETYPE_CONFIG: Record<OffensiveArchetype, OffenseArchetypeConfig> = {
  BALANCED: { passRatio: 0.55, aggression: 0.5, turnoverRisk: 0.5 },
  POWER_RUN: { passRatio: 0.35, aggression: 0.45, turnoverRisk: 0.4 },
  SPREAD: { passRatio: 0.65, aggression: 0.55, turnoverRisk: 0.5 },
  VERTICAL_PASSING: { passRatio: 0.7, aggression: 0.7, turnoverRisk: 0.6 },
  WEST_COAST: { passRatio: 0.6, aggression: 0.45, turnoverRisk: 0.35 },
  OPTION_RPO: { passRatio: 0.5, aggression: 0.6, turnoverRisk: 0.55 },
  PLAY_ACTION_HEAVY: { passRatio: 0.58, aggression: 0.6, turnoverRisk: 0.5 },
};

export const DEFENSE_ARCHETYPE_CONFIG: Record<DefensiveArchetype, DefenseArchetypeConfig> = {
  BALANCED_4_3: { runStop: 0.5, passDefense: 0.5, turnoverGen: 0.5 },
  BASE_3_4: { runStop: 0.55, passDefense: 0.45, turnoverGen: 0.45 },
  NICKEL_ZONE: { runStop: 0.4, passDefense: 0.6, turnoverGen: 0.5 },
  BLITZ_HEAVY: { runStop: 0.45, passDefense: 0.45, turnoverGen: 0.65 },
  MAN_COVERAGE: { runStop: 0.4, passDefense: 0.65, turnoverGen: 0.55 },
  BEND_DONT_BREAK: { runStop: 0.5, passDefense: 0.55, turnoverGen: 0.35 },
  RUN_STOP: { runStop: 0.7, passDefense: 0.4, turnoverGen: 0.45 },
};
