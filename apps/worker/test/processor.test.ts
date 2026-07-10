import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGame, type SimInputTeam, type SimulationInput } from '@heritage-saturday/simulation-engine';
import { processSimulateJob } from '../src/processor';
import { redisConnectionFromEnv } from '../src/queue';

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

  return {
    teamId,
    offArchetype: 'BALANCED',
    defArchetype: 'BALANCED_4_3',
    players,
    depthChart: players.map((p) => ({ position: p.position, slot: 0, playerId: p.id })),
  };
}

function buildInput(seed: string): SimulationInput {
  return { home: makeTeam('home-team'), away: makeTeam('away-team'), seed };
}

test('processing a job is identical to calling the engine directly (no transport drift)', () => {
  const input = buildInput('season-week-1');
  assert.deepEqual(processSimulateJob(input), simulateGame(input));
});

test('same seed through the job path produces byte-identical results', () => {
  assert.deepEqual(processSimulateJob(buildInput('week-3')), processSimulateJob(buildInput('week-3')));
});

test('redisConnectionFromEnv throws a directed error when REDIS_URL is unset', () => {
  const original = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    assert.throws(() => redisConnectionFromEnv(), /REDIS_URL is not set/);
  } finally {
    if (original !== undefined) process.env.REDIS_URL = original;
  }
});

test('redisConnectionFromEnv returns the configured url', () => {
  const original = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://localhost:6379';
  try {
    assert.deepEqual(redisConnectionFromEnv(), { url: 'redis://localhost:6379' });
  } finally {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  }
});
