import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGame } from '../src/engine';
import { SimulationInput, SimInputTeam } from '../src/types';

function makeTeam(teamId: string): SimInputTeam {
  const players = [
    { id: `${teamId}-qb1`, position: 'QB' as const, overallRating: 82, throwPower: 80, throwAccuracy: 78 },
    { id: `${teamId}-rb1`, position: 'RB' as const, overallRating: 78, carry: 75, trucking: 70 },
    { id: `${teamId}-wr1`, position: 'WR' as const, overallRating: 80, catching: 80, routeRunning: 77 },
    { id: `${teamId}-wr2`, position: 'WR' as const, overallRating: 75, catching: 74, routeRunning: 73 },
    { id: `${teamId}-te1`, position: 'TE' as const, overallRating: 70 },
    { id: `${teamId}-lt1`, position: 'LT' as const, overallRating: 76 },
    { id: `${teamId}-lg1`, position: 'LG' as const, overallRating: 74 },
    { id: `${teamId}-c1`, position: 'C' as const, overallRating: 73 },
    { id: `${teamId}-rg1`, position: 'RG' as const, overallRating: 74 },
    { id: `${teamId}-rt1`, position: 'RT' as const, overallRating: 75 },
    { id: `${teamId}-le1`, position: 'LE' as const, overallRating: 77 },
    { id: `${teamId}-re1`, position: 'RE' as const, overallRating: 76 },
    { id: `${teamId}-dt1`, position: 'DT' as const, overallRating: 75 },
    { id: `${teamId}-lolb1`, position: 'LOLB' as const, overallRating: 74 },
    { id: `${teamId}-mlb1`, position: 'MLB' as const, overallRating: 79, tackle: 80 },
    { id: `${teamId}-rolb1`, position: 'ROLB' as const, overallRating: 74 },
    { id: `${teamId}-cb1`, position: 'CB' as const, overallRating: 76, coverage: 78 },
    { id: `${teamId}-fs1`, position: 'FS' as const, overallRating: 75, coverage: 76 },
    { id: `${teamId}-ss1`, position: 'SS' as const, overallRating: 74, coverage: 74 },
    { id: `${teamId}-k1`, position: 'K' as const, overallRating: 72, kickPower: 80, kickAccuracy: 82 },
    { id: `${teamId}-p1`, position: 'P' as const, overallRating: 70 },
  ];

  const depthChart = players.map((p) => ({ position: p.position, slot: 0, playerId: p.id }));

  return {
    teamId,
    offArchetype: 'BALANCED',
    defArchetype: 'BALANCED_4_3',
    players,
    depthChart,
  };
}

function buildInput(seed: string): SimulationInput {
  return {
    home: makeTeam('home-team'),
    away: makeTeam('away-team'),
    seed,
  };
}

test('same seed produces byte-identical results', () => {
  const resultA = simulateGame(buildInput('season-week-1'));
  const resultB = simulateGame(buildInput('season-week-1'));
  assert.deepEqual(resultA, resultB);
});

test('different seeds produce different results', () => {
  const resultA = simulateGame(buildInput('seed-alpha'));
  const resultB = simulateGame(buildInput('seed-beta'));
  assert.notDeepEqual(resultA, resultB);
});

test('produces a legal final score that matches quarter-by-quarter sum', () => {
  const result = simulateGame(buildInput('legality-check'));
  const summedHome = result.quarterByQuarter.reduce((sum, q) => sum + q.home, 0);
  const summedAway = result.quarterByQuarter.reduce((sum, q) => sum + q.away, 0);
  assert.equal(summedHome, result.finalScore.home);
  assert.equal(summedAway, result.finalScore.away);
  assert.ok(Number.isInteger(result.finalScore.home));
  assert.ok(Number.isInteger(result.finalScore.away));
  assert.ok(result.finalScore.home >= 0);
  assert.ok(result.finalScore.away >= 0);
});
