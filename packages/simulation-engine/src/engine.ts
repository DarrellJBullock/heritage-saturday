import { createRng, rngInt, Rng } from '@heritage-saturday/shared';
import { DEFENSE_ARCHETYPE_CONFIG, OFFENSE_ARCHETYPE_CONFIG } from './archetypes';
import { decomposeDrive } from './plays';
import {
  SimDepthChartEntry,
  SimGameEvent,
  SimInputTeam,
  SimPlayer,
  SimPlayerStat,
  SimTeamStats,
  SimulationInput,
  SimulationResult,
} from './types';
import { Position } from '@heritage-saturday/shared';

const OFFENSE_SKILL: Position[] = ['QB', 'RB', 'FB', 'WR', 'TE'];
const OFFENSE_LINE: Position[] = ['LT', 'LG', 'C', 'RG', 'RT'];
const DEFENSE_FRONT: Position[] = ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB'];
const DEFENSE_BACK: Position[] = ['CB', 'FS', 'SS'];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function avgRating(players: SimPlayer[], positions: Position[]): number | null {
  const matches = players.filter((p) => positions.includes(p.position));
  if (matches.length === 0) return null;
  return matches.reduce((sum, p) => sum + p.overallRating, 0) / matches.length;
}

function teamAvgRating(players: SimPlayer[]): number {
  if (players.length === 0) return 60;
  return players.reduce((sum, p) => sum + p.overallRating, 0) / players.length;
}

function offenseRating(players: SimPlayer[]): number {
  const skill = avgRating(players, OFFENSE_SKILL);
  const line = avgRating(players, OFFENSE_LINE);
  const parts = [skill, line].filter((n): n is number => n !== null);
  return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : teamAvgRating(players);
}

function defenseRating(players: SimPlayer[]): number {
  const front = avgRating(players, DEFENSE_FRONT);
  const back = avgRating(players, DEFENSE_BACK);
  const parts = [front, back].filter((n): n is number => n !== null);
  return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : teamAvgRating(players);
}

/** Ordered player ids at a given position, starters (slot 0) first, falling back
 * to overall-rating ordering if no depth chart entries exist for the position. */
function playersAtPosition(team: SimInputTeam, position: Position): SimPlayer[] {
  const entries = team.depthChart
    .filter((e) => e.position === position)
    .sort((a, b) => a.slot - b.slot);

  if (entries.length > 0) {
    const byId = new Map(team.players.map((p) => [p.id, p]));
    const ordered = entries.map((e) => byId.get(e.playerId)).filter((p): p is SimPlayer => !!p);
    if (ordered.length > 0) return ordered;
  }

  return team.players
    .filter((p) => p.position === position)
    .sort((a, b) => b.overallRating - a.overallRating);
}

function getStarter(team: SimInputTeam, position: Position): SimPlayer | null {
  const players = playersAtPosition(team, position);
  return players.length > 0 ? players[0] : null;
}

interface StatAccumulator {
  map: Map<string, SimPlayerStat>;
}

function addStat(
  acc: StatAccumulator,
  playerId: string,
  teamId: string,
  delta: Partial<SimPlayerStat>,
): void {
  let existing = acc.map.get(playerId);
  if (!existing) {
    existing = { playerId, teamId };
    acc.map.set(playerId, existing);
  }
  for (const [key, value] of Object.entries(delta)) {
    if (key === 'playerId' || key === 'teamId') continue;
    const k = key as keyof SimPlayerStat;
    (existing[k] as number) = ((existing[k] as number) ?? 0) + (value as number);
  }
}

/** Receivers eligible to catch a pass, in depth order. Deliberately narrow (two
 * wideouts) to match Cap-1 scope; TE and RB are fallbacks only, so that a roster
 * without wideouts can still have its passing yards charged to somebody. */
function eligibleReceivers(team: SimInputTeam): SimPlayer[] {
  const wrs = playersAtPosition(team, 'WR').slice(0, 2);
  if (wrs.length > 0) return wrs;
  const tes = playersAtPosition(team, 'TE').slice(0, 1);
  if (tes.length > 0) return tes;
  return playersAtPosition(team, 'RB').slice(0, 1);
}

/** Split drive yardage by the archetype's pass ratio, collapsing onto whichever
 * phase the roster can actually run: a team with no QB (or nobody to throw to)
 * gains on the ground, and vice versa. Guarantees passYards + rushYards === the
 * yards the team is credited with, so every yard can be charged to a player. */
function splitDriveYards(
  total: number,
  passRatio: number,
  canPass: boolean,
  canRush: boolean,
): { passYards: number; rushYards: number } {
  if (canPass && canRush) {
    const passYards = Math.round(total * passRatio);
    return { passYards, rushYards: total - passYards };
  }
  if (canPass) return { passYards: total, rushYards: 0 };
  if (canRush) return { passYards: 0, rushYards: total };
  return { passYards: 0, rushYards: 0 };
}

/**
 * Credit one drive's passing production — the single place receptions are created.
 *
 * Every completion becomes a reception and the drive's pass yards are distributed
 * across receivers exactly, so that over a game `sum(receptions) === completions`
 * and `sum(receivingYards) === passYards`. Attribution used to live inside each
 * drive-outcome branch, where only the touchdown branch ever wrote a reception —
 * making `receptions === receivingTDs` an identity (every catch a TD) and dropping
 * the yardage from every non-scoring drive entirely.
 */
function creditPassing(
  acc: StatAccumulator,
  rng: Rng,
  teamId: string,
  qb: SimPlayer,
  receivers: SimPlayer[],
  passYards: number,
  isTd: boolean,
  attemptsMin: number,
  attemptsMax: number,
  completionRate: number,
): void {
  const attempts = rngInt(rng, attemptsMin, attemptsMax);
  const completions = clamp(Math.round(attempts * completionRate), 1, attempts);

  addStat(acc, qb.id, teamId, {
    passAttempts: attempts,
    passCompletions: completions,
    passYards,
    ...(isTd ? { passTDs: 1 } : {}),
  });

  const catches = new Array<number>(receivers.length).fill(0);
  for (let i = 0; i < completions; i++) catches[rngInt(rng, 0, receivers.length - 1)] += 1;

  // Indices that actually caught something; non-empty because completions >= 1.
  const caught = catches.map((_, i) => i).filter((i) => catches[i] > 0);
  // The last catcher absorbs the rounding remainder, so the yards sum is exact.
  const remainderIdx = caught[caught.length - 1];

  let assigned = 0;
  for (const i of caught) {
    const yards =
      i === remainderIdx ? passYards - assigned : Math.floor((passYards * catches[i]) / completions);
    if (i !== remainderIdx) assigned += yards;
    addStat(acc, receivers[i].id, teamId, {
      targets: catches[i] + rngInt(rng, 0, 1),
      receptions: catches[i],
      receivingYards: yards,
    });
  }

  if (isTd) {
    const scorer = caught[rngInt(rng, 0, caught.length - 1)];
    addStat(acc, receivers[scorer].id, teamId, { receivingTDs: 1 });
  }
}

/** Credit one drive's rushing production. Called on every drive with rush yardage,
 * not just the ones that end in a rushing touchdown. */
function creditRushing(
  acc: StatAccumulator,
  rng: Rng,
  teamId: string,
  rb: SimPlayer,
  rushYards: number,
  isTd: boolean,
  carriesMin: number,
  carriesMax: number,
): void {
  addStat(acc, rb.id, teamId, {
    carries: rngInt(rng, carriesMin, carriesMax),
    rushYards,
    ...(isTd ? { rushTDs: 1 } : {}),
  });
}

type DriveOutcome = 'TD' | 'FG' | 'PUNT' | 'TURNOVER' | 'MISSED_FG';

interface DriveResult {
  outcome: DriveOutcome;
  points: number;
  yards: number;
  passYards: number;
  rushYards: number;
  possessionSeconds: number;
}

function simulatePossession(
  rng: Rng,
  offense: SimInputTeam,
  defense: SimInputTeam,
  acc: StatAccumulator,
): DriveResult {
  const offConfig = OFFENSE_ARCHETYPE_CONFIG[offense.offArchetype];
  const defConfig = DEFENSE_ARCHETYPE_CONFIG[defense.defArchetype];

  const offRating = offenseRating(offense.players);
  const defRating = defenseRating(defense.players);
  const ratingDiffNorm = clamp((offRating - defRating) / 30, -1, 1);

  const possessionSeconds = rngInt(rng, 90, 210);

  const turnoverProb = clamp(
    0.12 + offConfig.turnoverRisk * 0.08 + defConfig.turnoverGen * 0.08 - ratingDiffNorm * 0.05,
    0.05,
    0.35,
  );

  const receivers = eligibleReceivers(offense);
  const kicker = getStarter(offense, 'K');
  const rusher = getStarter(offense, 'RB') ?? getStarter(offense, 'FB');

  // A pass needs both a thrower and someone to throw to; without either, the drive's
  // yardage is rushed instead. Narrowing to `SimPlayer | null` here lets every call
  // site below stay type-safe without non-null assertions.
  const passer = receivers.length > 0 ? getStarter(offense, 'QB') : null;
  const canPass = passer !== null;
  const canRush = rusher !== null;
  const defFront = playersAtPosition(defense, 'MLB').concat(playersAtPosition(defense, 'LOLB'), playersAtPosition(defense, 'ROLB'));
  const defBack = playersAtPosition(defense, 'CB').concat(playersAtPosition(defense, 'FS'), playersAtPosition(defense, 'SS'));

  const baseYards = rngInt(rng, 20, 70) * (1 + ratingDiffNorm * 0.25) * (1 + (offConfig.aggression - 0.5) * 0.3);
  const grossYards = Math.max(0, Math.round(baseYards));
  const passRatio = clamp(offConfig.passRatio + (rng() - 0.5) * 0.1, 0.15, 0.85);
  const { passYards, rushYards } = splitDriveYards(grossYards, passRatio, canPass, canRush);
  const yards = passYards + rushYards;

  if (rng() < turnoverProb) {
    // Turnover: partial yards gained before the takeaway, no points. Both phases are
    // credited — the drive's passing and rushing yards both really happened, and the
    // team totals count both regardless of which one ended the drive.
    const partial = splitDriveYards(Math.round(yards * 0.4), passRatio, canPass, canRush);

    if (passer && partial.passYards > 0) {
      creditPassing(acc, rng, offense.teamId, passer, receivers, partial.passYards, false, 2, 5, 0.55);
    }
    if (rusher && partial.rushYards > 0) {
      creditRushing(acc, rng, offense.teamId, rusher, partial.rushYards, false, 1, 3);
    }

    // Only a thrown ball can be intercepted; otherwise the takeaway is a fumble,
    // which Cap-1 does not track as a player stat.
    if (passer && rng() < 0.6) {
      addStat(acc, passer.id, offense.teamId, { interceptions: 1 });
      if (defBack.length > 0) {
        const defender = defBack[rngInt(rng, 0, defBack.length - 1)];
        addStat(acc, defender.id, defense.teamId, { defInterceptions: 1 });
      }
    }
    if (defFront.length > 0 && rng() < 0.3) {
      const defender = defFront[rngInt(rng, 0, defFront.length - 1)];
      addStat(acc, defender.id, defense.teamId, { tackles: 1 });
    }

    return {
      outcome: 'TURNOVER',
      points: 0,
      yards: partial.passYards + partial.rushYards,
      passYards: partial.passYards,
      rushYards: partial.rushYards,
      possessionSeconds,
    };
  }

  const scoreProb = clamp(
    0.35 + ratingDiffNorm * 0.25 + offConfig.aggression * 0.1 - defConfig.passDefense * 0.05 - defConfig.runStop * 0.05,
    0.1,
    0.75,
  );

  const passTdRoll = rng() < passRatio;

  if (rng() < scoreProb) {
    const isTd = rng() < 0.65 || !kicker;

    if (isTd) {
      // The touchdown goes to whichever phase the roster can run; the *other* phase
      // still gets its yards, because the drive gained them either way.
      const isPassTd = canPass && (passTdRoll || !canRush);

      if (passer && (passYards > 0 || isPassTd)) {
        creditPassing(acc, rng, offense.teamId, passer, receivers, passYards, isPassTd, 3, 7, 0.6);
      }
      if (rusher && (rushYards > 0 || !isPassTd)) {
        creditRushing(acc, rng, offense.teamId, rusher, rushYards, !isPassTd, 2, 6);
      }

      let points = 6;
      if (kicker) {
        const xpProb = 0.85 + (kicker.kickAccuracy ?? 75) / 500;
        const made = rng() < xpProb;
        addStat(acc, kicker.id, offense.teamId, { xpMade: made ? 1 : 0 });
        if (made) points += 1;
      } else {
        points += 1; // no kicker on roster: assume automatic extra point for Cap-1 legality
      }

      return { outcome: 'TD', points, yards, passYards, rushYards, possessionSeconds };
    }

    // Field goal attempt. The drive still moved the ball, so its yardage is credited
    // to the skill players before the kick is resolved.
    if (kicker) {
      if (passer && passYards > 0) {
        creditPassing(acc, rng, offense.teamId, passer, receivers, passYards, false, 2, 5, 0.55);
      }
      if (rusher && rushYards > 0) {
        creditRushing(acc, rng, offense.teamId, rusher, rushYards, false, 2, 5);
      }

      const fgProb = clamp(0.5 + (kicker.kickAccuracy ?? 70) / 200, 0.35, 0.95);
      const made = rng() < fgProb;
      addStat(acc, kicker.id, offense.teamId, { fgAttempts: 1, fgMade: made ? 1 : 0 });
      return {
        outcome: made ? 'FG' : 'MISSED_FG',
        points: made ? 3 : 0,
        yards,
        passYards,
        rushYards,
        possessionSeconds,
      };
    }
  }

  // Punt: still credit yardage gained on the drive to the relevant skill players.
  if (passer && passYards > 0) {
    creditPassing(acc, rng, offense.teamId, passer, receivers, passYards, false, 2, 5, 0.55);
  }
  if (rusher && rushYards > 0) {
    creditRushing(acc, rng, offense.teamId, rusher, rushYards, false, 2, 5);
  }

  return { outcome: 'PUNT', points: 0, yards, passYards, rushYards, possessionSeconds };
}

export function simulateGame(input: SimulationInput): SimulationResult {
  const rng = createRng(input.seed);
  const acc: StatAccumulator = { map: new Map() };
  const events: SimGameEvent[] = [];
  let sequence = 0;

  const teamStats: Record<'home' | 'away', SimTeamStats> = {
    home: { totalYards: 0, passingYards: 0, rushingYards: 0, turnovers: 0, timeOfPossessionSeconds: 0 },
    away: { totalYards: 0, passingYards: 0, rushingYards: 0, turnovers: 0, timeOfPossessionSeconds: 0 },
  };

  const quarterByQuarter: { quarter: number; home: number; away: number }[] = [];
  let homeScore = 0;
  let awayScore = 0;
  // Play-by-play bookkeeping. driveOrdinal seeds a per-drive RNG so the main stream is untouched;
  // clockRemaining is a synthesized game clock (900s per quarter), for presentation only.
  let driveOrdinal = 0;
  let clockRemaining = 900;

  function runPossession(quarter: number, side: 'home' | 'away'): number {
    const offense = side === 'home' ? input.home : input.away;
    const defense = side === 'home' ? input.away : input.home;

    const result = simulatePossession(rng, offense, defense, acc);

    teamStats[side].totalYards += result.yards;
    teamStats[side].passingYards += result.passYards;
    teamStats[side].rushingYards += result.rushYards;
    teamStats[side].timeOfPossessionSeconds += result.possessionSeconds;
    if (result.outcome === 'TURNOVER') teamStats[side].turnovers += 1;

    // Decompose the drive into plays with an INDEPENDENT per-drive RNG — this never touches the
    // main `rng`, so scores, stats, and every existing result stay byte-for-byte identical.
    const playRng = createRng(`${input.seed}:play:${driveOrdinal}`);
    driveOrdinal += 1;
    const plays = decomposeDrive(
      playRng,
      {
        outcome: result.outcome,
        yards: result.yards,
        passYards: result.passYards,
        rushYards: result.rushYards,
        possessionSeconds: result.possessionSeconds,
      },
      clockRemaining,
    );
    clockRemaining = Math.max(0, clockRemaining - result.possessionSeconds);
    // Emit plays BEFORE the DRIVE_END so DRIVE_END is still immediately followed by its SCORE
    // (the box score's drive builder relies on that adjacency).
    for (const p of plays) {
      events.push({
        quarter,
        sequence: sequence++,
        type: 'PLAY',
        teamId: offense.teamId,
        payload: {
          down: p.down,
          yardsToGo: p.yardsToGo,
          yardLine: p.yardLine,
          clock: p.clock,
          playType: p.playType,
          yards: p.yards,
          result: p.result,
          description: p.description,
        },
      });
    }

    events.push({
      quarter,
      sequence: sequence++,
      type: 'DRIVE_END',
      teamId: offense.teamId,
      payload: { outcome: result.outcome, yards: result.yards },
    });

    if (result.points > 0) {
      events.push({
        quarter,
        sequence: sequence++,
        type: 'SCORE',
        teamId: offense.teamId,
        payload: { points: result.points, outcome: result.outcome },
      });
    }
    if (result.outcome === 'TURNOVER') {
      events.push({
        quarter,
        sequence: sequence++,
        type: 'TURNOVER',
        teamId: offense.teamId,
        payload: {},
      });
    }

    return result.points;
  }

  const POSSESSIONS_PER_TEAM_PER_QUARTER = 3;

  for (let quarter = 1; quarter <= 4; quarter++) {
    clockRemaining = 900; // fresh 15:00 each quarter (presentation clock)
    let qHome = 0;
    let qAway = 0;
    const firstSide: 'home' | 'away' = quarter % 2 === 1 ? 'home' : 'away';
    for (let i = 0; i < POSSESSIONS_PER_TEAM_PER_QUARTER; i++) {
      const sideOrder: ('home' | 'away')[] = firstSide === 'home' ? ['home', 'away'] : ['away', 'home'];
      for (const side of sideOrder) {
        const points = runPossession(quarter, side);
        if (side === 'home') qHome += points;
        else qAway += points;
      }
    }
    homeScore += qHome;
    awayScore += qAway;
    quarterByQuarter.push({ quarter, home: qHome, away: qAway });
  }

  // Overtime: single default format (assumption #2) — alternating possessions,
  // first score wins, capped to avoid unbounded loops; unresolved after the cap
  // ends in a tie (assumption #6).
  if (homeScore === awayScore) {
    clockRemaining = 600; // 10:00 OT period (presentation clock)
    const OT_MAX_POSSESSIONS = 6;
    let otHome = 0;
    let otAway = 0;
    let decided = false;
    for (let i = 0; i < OT_MAX_POSSESSIONS && !decided; i++) {
      const side: 'home' | 'away' = i % 2 === 0 ? 'home' : 'away';
      const points = runPossession(5, side);
      if (side === 'home') otHome += points;
      else otAway += points;
      if (points > 0) decided = true;
    }
    if (otHome > 0 || otAway > 0) {
      homeScore += otHome;
      awayScore += otAway;
      quarterByQuarter.push({ quarter: 5, home: otHome, away: otAway });
    }
  }

  const playerStats = Array.from(acc.map.values());

  return {
    finalScore: { home: homeScore, away: awayScore },
    quarterByQuarter,
    events,
    teamStats,
    playerStats,
  };
}
