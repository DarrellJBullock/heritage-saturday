// Shared DTO shapes for the Capability-1 API, per company-docs/architecture.md §4.
// Types only — no logic. Both apps/api and apps/web import these.

import {
  ImportRowStatus,
  ImportStatus,
  ImportSheet,
  OffensiveArchetype,
  DefensiveArchetype,
  GameStatus,
  Position,
  LeagueSize,
} from './enums';

// ---------------------------------------------------------------------------
// Leagues (Capability 2)
// ---------------------------------------------------------------------------

export interface CreateLeagueRequestDto {
  name: string;
  size: LeagueSize;
  // Omit for an empty league populated by import; set to a preset key to generate teams
  // (wired in a later phase). templateKey and generation are validated server-side.
  templateKey?: string;
  // Optional deterministic generation seed; the server generates one when absent.
  seed?: string;
}

export interface LeagueListItemDto {
  id: string;
  name: string;
  size: number;
  templateKey: string | null;
  teamCount: number;
  createdAt: string;
}

export interface LeagueDetailDto extends LeagueListItemDto {
  rosters: RosterListItemDto[];
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export interface ImportSummaryDto {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface UploadRosterResponseDto {
  importId: string;
  status: ImportStatus;
  topLevelError: string | null;
}

export interface ImportPreviewRowDto {
  sheet: ImportSheet | string;
  rowIndex: number;
  status: ImportRowStatus;
  messages: string[];
  data: Record<string, unknown>;
}

export interface ImportPreviewResponseDto {
  importId: string;
  fileName: string;
  status: ImportStatus;
  summary: ImportSummaryDto;
  rows: ImportPreviewRowDto[];
}

export interface CommitImportResponseDto {
  rosterId: string;
  summary: ImportSummaryDto;
}

export interface ImportHistoryItemDto {
  importId: string;
  fileName: string;
  createdAt: string;
  status: ImportStatus;
  summary: ImportSummaryDto;
}

// ---------------------------------------------------------------------------
// Rosters / Teams / Players
// ---------------------------------------------------------------------------

export interface RosterListItemDto {
  id: string;
  name: string;
  teamCount: number;
  createdAt: string;
}

export interface RosterDetailDto extends RosterListItemDto {
  teams: TeamSummaryDto[];
}

export interface TeamSummaryDto {
  id: string;
  externalTeamId: string;
  teamName: string;
  abbreviation: string | null;
  city: string | null;
  state: string | null;
  conference: string | null;
  division: string | null;
}

export interface PlayerDto {
  id: string;
  externalPlayerId: string;
  firstName: string;
  lastName: string;
  position: Position;
  jerseyNumber: number;
  overallRating: number;
  archetype: string | null;
}

/**
 * Full team page: the summary fields plus the branding and coach the summary omits, and the
 * roster. `primaryColor`/`secondaryColor` are surfaced here (they were stored but never
 * serialized before the team page existed).
 */
export interface TeamDetailDto extends TeamSummaryDto {
  primaryColor: string | null;
  secondaryColor: string | null;
  coachName: string | null;
  players: PlayerDto[];
}

/** Full player page: identity plus every rating attribute and the owning team. Attributes are
 * nullable because an imported roster need not populate every column. */
export interface PlayerDetailDto extends PlayerDto {
  teamId: string;
  teamName: string;
  speed: number | null;
  strength: number | null;
  awareness: number | null;
  throwPower: number | null;
  throwAccuracy: number | null;
  catching: number | null;
  routeRunning: number | null;
  carry: number | null;
  trucking: number | null;
  passBlock: number | null;
  runBlock: number | null;
  tackle: number | null;
  coverage: number | null;
  kickPower: number | null;
  kickAccuracy: number | null;
}

// ---------------------------------------------------------------------------
// Depth charts
// ---------------------------------------------------------------------------

export interface DepthChartEntryDto {
  position: Position;
  slot: number;
  playerId: string;
}

export interface DepthChartResponseDto {
  teamId: string;
  source: 'IMPORTED' | 'AUTO_GENERATED';
  entries: DepthChartEntryDto[];
  /**
   * True iff every required starting position is filled. Clients must branch on this
   * rather than on `warnings.length === 0`: the two agree today only because both derive
   * from the same check, and `warnings` is free to carry non-blocking advisories later.
   */
  legal: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface SimulateGameRequestDto {
  homeTeamId: string;
  awayTeamId: string;
  homeOffArchetype: OffensiveArchetype;
  homeDefArchetype: DefensiveArchetype;
  awayOffArchetype: OffensiveArchetype;
  awayDefArchetype: DefensiveArchetype;
  seed?: string;
}

export interface SimulateGameResponseDto {
  gameId: string;
  status: GameStatus;
  homeScore: number;
  awayScore: number;
  seed: string;
}

export interface QuarterScoreDto {
  quarter: number;
  home: number;
  away: number;
}

export interface TeamGameStatsDto {
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  turnovers: number;
  timeOfPossessionSeconds: number | null;
}

export interface PlayerGameStatsDto {
  playerId: string;
  firstName: string;
  lastName: string;
  position: Position;
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

export interface BoxScoreTeamDto {
  id: string;
  teamName: string;
}

export interface BoxScoreResponseDto {
  gameId: string;
  seed: string;
  status: GameStatus;
  teams: { home: BoxScoreTeamDto; away: BoxScoreTeamDto };
  finalScore: { home: number; away: number };
  quarterByQuarter: QuarterScoreDto[];
  teamStats: { home: TeamGameStatsDto; away: TeamGameStatsDto };
  playerStats: { home: PlayerGameStatsDto[]; away: PlayerGameStatsDto[] };
}
