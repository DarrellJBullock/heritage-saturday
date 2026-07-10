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
} from './enums';

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
