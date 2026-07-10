import {
  createRng,
  rngInt,
  Rng,
  Position,
  REQUIRED_STARTING_POSITIONS,
} from '@heritage-saturday/shared';
import {
  TEAM_NICKNAMES,
  CITY_NAMES,
  CONFERENCE_NAMES,
  DIVISION_NAMES,
  FIRST_NAMES,
  LAST_NAMES,
  COLOR_PAIRS,
} from './data';
import { GeneratedLeague, GeneratedPlayer, GeneratedTeam, GenerateLeagueOptions } from './types';

// Conference/division shape per preset. Every entry divides evenly: teams-per-division =
// size / (conferences * divisionsPerConference) is an integer for all four presets
// (8→4, 16→4, 24→4, 54→6). divisionsPerConference ≤ DIVISION_NAMES.length and
// conferences ≤ CONFERENCE_NAMES.length.
interface Layout {
  conferences: number;
  divisionsPerConference: number;
}
const LAYOUT_TABLE: Record<number, Layout> = {
  8: { conferences: 2, divisionsPerConference: 1 },
  16: { conferences: 2, divisionsPerConference: 2 },
  24: { conferences: 2, divisionsPerConference: 3 },
  54: { conferences: 3, divisionsPerConference: 3 },
};

/** conference/division for each of the `size` team slots, in order. */
function buildSlots(size: number): { conference: string; division: string }[] {
  const layout = LAYOUT_TABLE[size] ?? {
    conferences: 2,
    divisionsPerConference: Math.max(1, Math.min(DIVISION_NAMES.length, Math.ceil(size / 8))),
  };
  const totalDivisions = layout.conferences * layout.divisionsPerConference;
  const teamsPerDivision = Math.ceil(size / totalDivisions);

  const slots: { conference: string; division: string }[] = [];
  for (let i = 0; i < size; i++) {
    const divisionIndex = Math.floor(i / teamsPerDivision);
    const confIndex = Math.floor(divisionIndex / layout.divisionsPerConference);
    const divInConf = divisionIndex % layout.divisionsPerConference;
    slots.push({
      conference: CONFERENCE_NAMES[confIndex % CONFERENCE_NAMES.length],
      division: DIVISION_NAMES[divInConf % DIVISION_NAMES.length],
    });
  }
  return slots;
}

/** Fisher–Yates over a copy, using the seeded rng so ordering is deterministic. */
function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Which optional flavor attributes matter for each position group. Positions absent here (the
// offensive line) carry only overallRating, which is all the engine needs — the rest are
// optional flavor per SimPlayer.
const ATTRS_BY_POSITION: Partial<Record<Position, string[]>> = {
  QB: ['throwPower', 'throwAccuracy'],
  RB: ['carry', 'trucking'],
  FB: ['carry', 'trucking'],
  WR: ['catching', 'routeRunning'],
  TE: ['catching', 'routeRunning'],
  LE: ['tackle'],
  RE: ['tackle'],
  DT: ['tackle'],
  LOLB: ['tackle', 'coverage'],
  MLB: ['tackle'],
  ROLB: ['tackle', 'coverage'],
  CB: ['coverage', 'tackle'],
  FS: ['coverage', 'tackle'],
  SS: ['coverage', 'tackle'],
  K: ['kickPower', 'kickAccuracy'],
  P: ['kickPower', 'kickAccuracy'],
};

function makePlayer(
  rng: Rng,
  position: Position,
  firstName: string,
  lastName: string,
  jerseyNumber: number,
  ratingMin: number,
  ratingMax: number,
): GeneratedPlayer {
  const overallRating = rngInt(rng, ratingMin, ratingMax);
  const player: GeneratedPlayer = { firstName, lastName, position, jerseyNumber, overallRating };
  // Flavor the position-relevant attributes around the overall so simulation has real inputs.
  for (const attr of ATTRS_BY_POSITION[position] ?? []) {
    (player as unknown as Record<string, number>)[attr] = clamp(
      overallRating + rngInt(rng, -6, 6),
      40,
      99,
    );
  }
  return player;
}

// A starter (slot 0) and a backup for every required position, so the auto-generated depth
// chart (rating-based, in apps/api DepthChartsService) is always legal. Ratings overlap but
// skew higher for the starter; the depth chart still sorts strictly by rating.
function generatePlayers(rng: Rng, firstNames: string[], lastNames: string[]): GeneratedPlayer[] {
  const players: GeneratedPlayer[] = [];
  const usedJerseys = new Set<number>();
  const nextJersey = (): number => {
    let n = rngInt(rng, 1, 99);
    while (usedJerseys.has(n)) n = (n % 99) + 1;
    usedJerseys.add(n);
    return n;
  };
  let nameCursor = rngInt(rng, 0, firstNames.length - 1);
  const nextName = (): [string, string] => {
    const first = firstNames[nameCursor % firstNames.length];
    const last = lastNames[nameCursor % lastNames.length];
    nameCursor += 1;
    return [first, last];
  };

  for (const position of REQUIRED_STARTING_POSITIONS) {
    const [sf, sl] = nextName();
    players.push(makePlayer(rng, position, sf, sl, nextJersey(), 70, 92)); // starter
    const [bf, bl] = nextName();
    players.push(makePlayer(rng, position, bf, bl, nextJersey(), 55, 74)); // backup
  }
  return players;
}

function abbreviationOf(nickname: string): string {
  return nickname.slice(0, 3).toUpperCase();
}

/**
 * Generate a full, immediately-playable league: `size` uniquely-named teams, each with a roster
 * covering every required starting position. Pure and deterministic — the same seed yields the
 * same league. The API writes these teams/players and lets depth charts auto-generate on read.
 */
export function generateLeague({ size, seed }: GenerateLeagueOptions): GeneratedLeague {
  if (size < 2) throw new Error('A league needs at least two teams');
  if (size > TEAM_NICKNAMES.length || size > CITY_NAMES.length) {
    throw new Error(`size ${size} exceeds the available name banks`);
  }

  const rng = createRng(seed);
  const cities = shuffled(rng, CITY_NAMES).slice(0, size);
  const nicknames = shuffled(rng, TEAM_NICKNAMES).slice(0, size);
  const firstNames = shuffled(rng, FIRST_NAMES);
  const lastNames = shuffled(rng, LAST_NAMES);
  const slots = buildSlots(size);

  const teams: GeneratedTeam[] = [];
  for (let i = 0; i < size; i++) {
    const [primaryColor, secondaryColor] = COLOR_PAIRS[i % COLOR_PAIRS.length];
    teams.push({
      name: `${cities[i]} ${nicknames[i]}`,
      city: cities[i],
      abbreviation: abbreviationOf(nicknames[i]),
      conference: slots[i].conference,
      division: slots[i].division,
      primaryColor,
      secondaryColor,
      players: generatePlayers(rng, firstNames, lastNames),
    });
  }
  return { teams };
}
