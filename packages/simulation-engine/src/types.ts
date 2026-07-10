import { OffensiveArchetype, DefensiveArchetype, Position } from '@heritage-saturday/shared';

export interface SimPlayer {
  id: string;
  position: Position;
  overallRating: number;
  // optional rating fields used to flavor stat distribution; all optional since
  // an imported roster may not populate every rating column.
  throwPower?: number | null;
  throwAccuracy?: number | null;
  carry?: number | null;
  trucking?: number | null;
  catching?: number | null;
  routeRunning?: number | null;
  tackle?: number | null;
  coverage?: number | null;
  kickPower?: number | null;
  kickAccuracy?: number | null;
}

export interface SimDepthChartEntry {
  position: Position;
  slot: number; // 0 = starter, 1..3 = backups
  playerId: string;
}

export interface SimInputTeam {
  teamId: string;
  offArchetype: OffensiveArchetype;
  defArchetype: DefensiveArchetype;
  players: SimPlayer[];
  depthChart: SimDepthChartEntry[];
}

export interface RulesetOverrides {
  // Cap 1: always defaults. Param exists for forward-compat per architecture.md §6.
  penalties?: boolean;
  injuries?: boolean;
  weather?: boolean;
  fatigue?: boolean;
  homeFieldAdvantage?: boolean;
}

export interface SimulationInput {
  home: SimInputTeam;
  away: SimInputTeam;
  seed: string;
  ruleset?: RulesetOverrides;
}

export interface SimGameEvent {
  quarter: number; // 1-4, 5 = OT
  sequence: number;
  type: string; // SCORE | TURNOVER | PUNT | DRIVE_END | ...
  teamId: string | null;
  payload: Record<string, unknown>;
}

export interface SimTeamStats {
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  turnovers: number;
  timeOfPossessionSeconds: number;
}

export interface SimPlayerStat {
  playerId: string;
  teamId: string;
  passAttempts?: number;
  passCompletions?: number;
  passYards?: number;
  passTDs?: number;
  interceptions?: number;
  carries?: number;
  rushYards?: number;
  rushTDs?: number;
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  tackles?: number;
  sacks?: number;
  defInterceptions?: number;
  fgMade?: number;
  fgAttempts?: number;
  xpMade?: number;
}

export interface SimulationResult {
  finalScore: { home: number; away: number };
  quarterByQuarter: { quarter: number; home: number; away: number }[];
  events: SimGameEvent[];
  teamStats: { home: SimTeamStats; away: SimTeamStats };
  playerStats: SimPlayerStat[];
}
