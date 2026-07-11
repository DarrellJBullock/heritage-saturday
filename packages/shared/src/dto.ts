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
  Visibility,
  LeagueRole,
  MemberRole,
  InvitationStatus,
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
  // The caller's relationship to this league: OWNER (created it) or MEMBER (granted access).
  role: LeagueRole;
}

export interface LeagueDetailDto extends LeagueListItemDto {
  // For a member, only LEAGUE-visible rosters appear; for the owner, all of them.
  rosters: RosterListItemDto[];
}

export interface LeagueMemberDto {
  userId: string;
  email: string;
  role: LeagueRole;
}

export interface AddMemberRequestDto {
  email: string;
  // The role to grant; defaults to VIEWER server-side when omitted. Never OWNER.
  role?: MemberRole;
}

export interface SetMemberRoleRequestDto {
  role: MemberRole;
}

export interface SetRosterVisibilityRequestDto {
  visibility: Visibility;
}

export interface CreateInvitationRequestDto {
  email: string;
  // Role to grant on acceptance; defaults VIEWER server-side. Never OWNER.
  role?: MemberRole;
}

export interface InvitationDto {
  id: string;
  leagueId: string;
  leagueName: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  invitedByEmail: string;
  createdAt: string;
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
  visibility: Visibility;
  archived: boolean;
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
  // Player photo, an https image URL, or null for the initials placeholder.
  headshotUrl: string | null;
}

/** Set (or clear, with null/empty) a player's headshot photo URL. */
export interface SetHeadshotRequestDto {
  headshotUrl: string | null;
}

/**
 * Every rating attribute. Nullable because an imported roster (or a generated player at a
 * position the attribute doesn't apply to) need not populate every column. Shared by the roster
 * grid (RosterPlayerDto) and the player page (PlayerDetailDto).
 */
export interface PlayerRatingsDto {
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

/** A roster row with its full rating attributes, for the team page's ratings grid. */
export interface RosterPlayerDto extends PlayerDto, PlayerRatingsDto {}

/**
 * Full team page: the summary fields plus the branding and coach the summary omits, and the
 * roster. `primaryColor`/`secondaryColor` are surfaced here (they were stored but never
 * serialized before the team page existed).
 */
export interface BandDto {
  name: string;
  style: string;
  chant: string;
  tradition: string;
}

/** A team's colors (HEX strings, or null). primary/secondary are the base; the rest flesh out
 * branding and are shown as swatches / editable by the owner. */
export interface TeamColorsDto {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  helmetColor: string | null;
  homeJerseyColor: string | null;
  awayJerseyColor: string | null;
}

/** Set a team's colors (owner-only). Each field is a #rgb / #rrggbb HEX string, or null to clear. */
export type SetTeamColorsRequestDto = TeamColorsDto;

export interface TeamDetailDto extends TeamSummaryDto, TeamColorsDto {
  coachName: string | null;
  players: RosterPlayerDto[];
  band: BandDto | null;
  rival: { teamId: string; teamName: string; classicGameName: string | null } | null;
  // True when the viewer owns this team's roster — the web page shows the color editor.
  canEditColors: boolean;
  // Non-blocking color advisories: low primary/secondary contrast, or a palette shared with
  // another team in the league. Empty when the colors are fine.
  colorWarnings: string[];
}

/** Full player page: identity plus every rating attribute and the owning team. */
export interface PlayerDetailDto extends PlayerDto, PlayerRatingsDto {
  teamId: string;
  teamName: string;
  // True when the viewer owns this player's roster — the web page shows the headshot editor.
  canEditHeadshot: boolean;
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
  source: 'IMPORTED' | 'AUTO_GENERATED' | 'MANUAL';
  entries: DepthChartEntryDto[];
  /**
   * True iff every required starting position is filled. Clients must branch on this
   * rather than on `warnings.length === 0`: the two agree today only because both derive
   * from the same check, and `warnings` is free to carry non-blocking advisories later.
   */
  legal: boolean;
  warnings: string[];
}

/** Replace a team's depth chart by hand (owner-only). Must fill every required starting
 * position (slot 0), reference only that team's players, and place each player at their own
 * position. The whole chart is sent, not a delta. */
export interface SaveDepthChartRequestDto {
  entries: DepthChartEntryDto[];
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

// A single possession, reconstructed from the drive-level game events.
export interface DriveSummaryDto {
  quarter: number;
  side: 'home' | 'away';
  teamName: string;
  yards: number;
  outcome: string; // engine-defined: TD | FG | PUNT | TURNOVER | DOWNS | END_HALF | ...
  points: number; // 0 unless the drive scored
}

// A standout player on a team, for the Game Center "top performers" section.
export interface PerformerDto {
  playerId: string;
  name: string;
  position: Position;
  role: 'PASSING' | 'RUSHING' | 'RECEIVING' | 'DEFENSE';
  line: string; // a short human stat line, e.g. "18/27, 243 yds, 2 TD"
}

export interface WinProbabilityPointDto {
  quarter: number;
  homeWinProb: number; // 0..1; a labeled heuristic, terminal point pinned to the actual winner
}

// A single play in the play-by-play feed (derived from the engine's PLAY events).
export interface PlayDto {
  quarter: number;
  down: number;
  yardsToGo: number;
  yardLine: number; // 1-99 from the offense's own goal line (100 = touchdown)
  clock: string; // MM:SS remaining in the quarter
  playType: string; // RUN | PASS | FIELD_GOAL | PUNT
  yards: number;
  result: string; // GAIN | FIRST_DOWN | TOUCHDOWN | FIELD_GOAL_GOOD | PUNT | INTERCEPTION | ...
  description: string;
  teamId: string | null; // the possessing team
  side: 'home' | 'away';
}

export interface PlayByPlayResponseDto {
  gameId: string;
  teams: { home: BoxScoreTeamDto; away: BoxScoreTeamDto };
  // Every play, in game order.
  plays: PlayDto[];
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
  // Game Center (derived server-side from the stored game; no re-simulation).
  drives: DriveSummaryDto[];
  leaders: { home: PerformerDto[]; away: PerformerDto[] };
  winProbability: WinProbabilityPointDto[];
  recap: string;
}

// ---------------------------------------------------------------------------
// Schedule & standings (season structure)
// ---------------------------------------------------------------------------

export interface ScheduleTeamRefDto {
  teamId: string;
  teamName: string;
}

export interface ScheduleGameDto {
  gameId: string;
  week: number;
  home: ScheduleTeamRefDto;
  away: ScheduleTeamRefDto;
  status: GameStatus;
  // Null until the game's week has been simulated.
  homeScore: number | null;
  awayScore: number | null;
  // Rivalry annotations (see rivalry-aware scheduling). isHomecoming marks the home team's
  // rivalry game; classicGameName is the named annual meeting, if any.
  isRivalry: boolean;
  isHomecoming: boolean;
  classicGameName: string | null;
}

export interface ScheduleResponseDto {
  weeks: { week: number; games: ScheduleGameDto[] }[];
  // The lowest week that still has an unplayed game, or null when the season is complete (or
  // no schedule exists yet, in which case `weeks` is empty too).
  nextWeek: number | null;
}

export interface StandingRowDto {
  teamId: string;
  teamName: string;
  conference: string | null;
  division: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  differential: number;
}

export interface StandingsResponseDto {
  // One group per conference/division; rows sorted by wins desc, then differential desc.
  groups: { conference: string | null; division: string | null; rows: StandingRowDto[] }[];
}

// ---------------------------------------------------------------------------
// Season stat leaders
// ---------------------------------------------------------------------------

export interface LeaderRowDto {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  position: Position;
  value: number;
}

export interface LeaderCategoryDto {
  // Stable stat key, e.g. 'passYards'.
  key: string;
  // Display heading, e.g. 'Passing Yards'.
  label: string;
  // Short unit suffix for the value column, e.g. 'yds' | 'pts' | '' (a plain count).
  unit: string;
  // Players with a nonzero value, descending; capped at the top N. Empty until games are played.
  rows: LeaderRowDto[];
}

export interface LeadersResponseDto {
  // Aggregated over completed season games only (the same games standings count).
  categories: LeaderCategoryDto[];
}

// ---------------------------------------------------------------------------
// Rivalries (secondary + emerging; primary rival lives on the team detail)
// ---------------------------------------------------------------------------

export interface RivalryDto {
  id: string;
  teamA: ScheduleTeamRefDto;
  teamB: ScheduleTeamRefDto;
  type: 'SECONDARY' | 'EMERGING';
  // ACTIVE (a live secondary rival) or PENDING (an emerging pair awaiting commissioner approval).
  status: 'ACTIVE' | 'PENDING';
  // Rivalry score from head-to-head games (closeness- and frequency-weighted).
  score: number;
}

export interface RivalriesResponseDto {
  // Live secondary rivals, and emerging pairs the commissioner can approve or dismiss.
  active: RivalryDto[];
  emerging: RivalryDto[];
}
