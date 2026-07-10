import { createRng, rngInt, Rng } from './prng';
import { DEFENSE_ARCHETYPE_CONFIG, OFFENSE_ARCHETYPE_CONFIG } from './archetypes';
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

  const qb = getStarter(offense, 'QB');
  const rb = getStarter(offense, 'RB') ?? getStarter(offense, 'FB');
  const wrs = playersAtPosition(offense, 'WR').slice(0, 2);
  const kicker = getStarter(offense, 'K');
  const defFront = playersAtPosition(defense, 'MLB').concat(playersAtPosition(defense, 'LOLB'), playersAtPosition(defense, 'ROLB'));
  const defBack = playersAtPosition(defense, 'CB').concat(playersAtPosition(defense, 'FS'), playersAtPosition(defense, 'SS'));

  const baseYards = rngInt(rng, 20, 70) * (1 + ratingDiffNorm * 0.25) * (1 + (offConfig.aggression - 0.5) * 0.3);
  const yards = Math.max(0, Math.round(baseYards));
  const passRatio = clamp(offConfig.passRatio + (rng() - 0.5) * 0.1, 0.15, 0.85);
  const passYards = Math.round(yards * passRatio);
  const rushYards = yards - passYards;

  if (rng() < turnoverProb) {
    // Turnover: partial yards gained before the takeaway, no points.
    const partialYards = Math.round(yards * 0.4);
    const partialPass = Math.round(partialYards * passRatio);
    const partialRush = partialYards - partialPass;

    if (qb && partialPass > 0) {
      addStat(acc, qb.id, offense.teamId, { passAttempts: rngInt(rng, 2, 5), passCompletions: 1, passYards: partialPass });
      if (rng() < 0.6) {
        // Interception credited to a defensive back.
        addStat(acc, qb.id, offense.teamId, { interceptions: 1 });
        if (defBack.length > 0) {
          const defender = defBack[rngInt(rng, 0, defBack.length - 1)];
          addStat(acc, defender.id, defense.teamId, { defInterceptions: 1 });
        }
      }
    } else if (rb && partialRush > 0) {
      addStat(acc, rb.id, offense.teamId, { carries: rngInt(rng, 1, 3), rushYards: partialRush });
    }
    if (defFront.length > 0 && rng() < 0.3) {
      const defender = defFront[rngInt(rng, 0, defFront.length - 1)];
      addStat(acc, defender.id, defense.teamId, { tackles: 1 });
    }

    return {
      outcome: 'TURNOVER',
      points: 0,
      yards: partialYards,
      passYards: partialPass,
      rushYards: partialRush,
      possessionSeconds,
    };
  }

  const scoreProb = clamp(
    0.35 + ratingDiffNorm * 0.25 + offConfig.aggression * 0.1 - defConfig.passDefense * 0.05 - defConfig.runStop * 0.05,
    0.1,
    0.75,
  );

  const isPassTd = rng() < passRatio;

  if (rng() < scoreProb) {
    const isTd = rng() < 0.65 || !kicker;

    if (isTd) {
      if (isPassTd && qb) {
        const attempts = rngInt(rng, 3, 7);
        addStat(acc, qb.id, offense.teamId, {
          passAttempts: attempts,
          passCompletions: Math.max(1, Math.round(attempts * 0.6)),
          passYards,
          passTDs: 1,
        });
        if (wrs.length > 0) {
          const receiver = wrs[rngInt(rng, 0, wrs.length - 1)];
          addStat(acc, receiver.id, offense.teamId, {
            targets: rngInt(rng, 1, 3),
            receptions: 1,
            receivingYards: passYards,
            receivingTDs: 1,
          });
        }
      } else if (rb) {
        addStat(acc, rb.id, offense.teamId, {
          carries: rngInt(rng, 2, 6),
          rushYards,
          rushTDs: 1,
        });
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

    // Field goal attempt.
    if (kicker) {
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
  if (qb && passYards > 0) {
    const attempts = rngInt(rng, 2, 5);
    addStat(acc, qb.id, offense.teamId, {
      passAttempts: attempts,
      passCompletions: Math.max(1, Math.round(attempts * 0.55)),
      passYards,
    });
  }
  if (rb && rushYards > 0) {
    addStat(acc, rb.id, offense.teamId, { carries: rngInt(rng, 2, 5), rushYards });
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

  function runPossession(quarter: number, side: 'home' | 'away'): number {
    const offense = side === 'home' ? input.home : input.away;
    const defense = side === 'home' ? input.away : input.home;

    const result = simulatePossession(rng, offense, defense, acc);

    teamStats[side].totalYards += result.yards;
    teamStats[side].passingYards += result.passYards;
    teamStats[side].rushingYards += result.rushYards;
    teamStats[side].timeOfPossessionSeconds += result.possessionSeconds;
    if (result.outcome === 'TURNOVER') teamStats[side].turnovers += 1;

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
