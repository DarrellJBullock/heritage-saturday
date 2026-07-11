import { Position } from '@heritage-saturday/shared';

/** A generated player. Mirrors the subset of the Prisma Player the API writes and the engine
 * reads: position + overallRating are required; the rest flavor simulation and are optional. */
export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  position: Position;
  jerseyNumber: number;
  overallRating: number;
  throwPower?: number;
  throwAccuracy?: number;
  carry?: number;
  trucking?: number;
  catching?: number;
  routeRunning?: number;
  tackle?: number;
  coverage?: number;
  kickPower?: number;
  kickAccuracy?: number;
}

export interface GeneratedBand {
  name: string;
  style: string;
  chant: string;
  tradition: string;
}

export interface GeneratedTeam {
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
  primaryColor: string;
  secondaryColor: string;
  band: GeneratedBand;
  // Index (into GeneratedLeague.teams) of this team's rival, and the name of their annual game.
  // Rivalries are symmetric: teams[i].rivalIndex === j ⇒ teams[j].rivalIndex === i.
  rivalIndex: number;
  classicGameName: string;
  players: GeneratedPlayer[];
}

export interface GeneratedLeague {
  teams: GeneratedTeam[];
}

export interface GenerateLeagueOptions {
  templateKey: string;
  size: number;
  seed: string;
}
