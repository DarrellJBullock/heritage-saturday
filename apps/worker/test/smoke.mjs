// Worker smoke test — drives the real BullMQ worker against a live Redis.
//
// The unit tests in processor.test.ts cover the pure processor without Redis. This
// exercises the transport: that a job round-trips through the queue, that determinism
// survives JSON serialization, and that an unknown job name fails loudly rather than
// vanishing. It needs `docker compose up -d redis` (or a Redis service) and REDIS_URL.
//
// Usage: npm run build -w @heritage-saturday/worker && npm run smoke -w @heritage-saturday/worker

import { createRequire } from 'node:module';

// dist/ is CommonJS; require it rather than relying on ESM named-export interop.
const require = createRequire(import.meta.url);
const { Queue, QueueEvents } = require('bullmq');
const { createSimulationWorker, SIMULATION_QUEUE, SIMULATE_JOB } = require('../dist/index.js');

process.env.REDIS_URL ||= 'redis://localhost:6379';
const connection = { url: process.env.REDIS_URL };
const JOB_TIMEOUT_MS = 15_000;
const READY_TIMEOUT_MS = 15_000;

/**
 * bullmq/ioredis retry a refused connection forever, so `waitUntilReady()` never rejects
 * when Redis is absent — the process just hangs. Unbounded, that stalls a CI job until the
 * runner's own timeout hours later. Fail fast and say why instead.
 */
function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function makeTeam(teamId) {
  const players = [
    { id: `${teamId}-qb1`, position: 'QB', overallRating: 82, throwPower: 80, throwAccuracy: 78 },
    { id: `${teamId}-rb1`, position: 'RB', overallRating: 78, carry: 75, trucking: 70 },
    { id: `${teamId}-wr1`, position: 'WR', overallRating: 80, catching: 80, routeRunning: 77 },
    { id: `${teamId}-wr2`, position: 'WR', overallRating: 75, catching: 74, routeRunning: 73 },
    { id: `${teamId}-te1`, position: 'TE', overallRating: 70 },
    { id: `${teamId}-lt1`, position: 'LT', overallRating: 76 },
    { id: `${teamId}-lg1`, position: 'LG', overallRating: 74 },
    { id: `${teamId}-c1`, position: 'C', overallRating: 73 },
    { id: `${teamId}-rg1`, position: 'RG', overallRating: 74 },
    { id: `${teamId}-rt1`, position: 'RT', overallRating: 75 },
    { id: `${teamId}-le1`, position: 'LE', overallRating: 77 },
    { id: `${teamId}-re1`, position: 'RE', overallRating: 76 },
    { id: `${teamId}-dt1`, position: 'DT', overallRating: 75 },
    { id: `${teamId}-lolb1`, position: 'LOLB', overallRating: 74 },
    { id: `${teamId}-mlb1`, position: 'MLB', overallRating: 79, tackle: 80 },
    { id: `${teamId}-rolb1`, position: 'ROLB', overallRating: 74 },
    { id: `${teamId}-cb1`, position: 'CB', overallRating: 76, coverage: 78 },
    { id: `${teamId}-fs1`, position: 'FS', overallRating: 75, coverage: 76 },
    { id: `${teamId}-ss1`, position: 'SS', overallRating: 74, coverage: 74 },
    { id: `${teamId}-k1`, position: 'K', overallRating: 72, kickPower: 80, kickAccuracy: 82 },
    { id: `${teamId}-p1`, position: 'P', overallRating: 70 },
  ];
  return {
    teamId,
    offArchetype: 'BALANCED',
    defArchetype: 'BALANCED_4_3',
    players,
    depthChart: players.map((p) => ({ position: p.position, slot: 0, playerId: p.id })),
  };
}

let failures = 0;
function ok(desc, cond, extra) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${desc}`);
  if (!cond) {
    failures += 1;
    if (extra !== undefined) console.log(`        ${JSON.stringify(extra)}`);
  }
}

const worker = createSimulationWorker();
const queue = new Queue(SIMULATION_QUEUE, { connection });
const events = new QueueEvents(SIMULATION_QUEUE, { connection });

try {
  await withTimeout(events.waitUntilReady(), READY_TIMEOUT_MS, `Connecting to ${process.env.REDIS_URL}`);
} catch (err) {
  // Exit hard: the queue clients are still retrying, so a graceful close would hang too.
  console.error(`\n=== worker smoke: FAILED — ${err.message} ===`);
  console.error('Is Redis running? `docker compose up -d redis`, or set REDIS_URL.');
  process.exit(1);
}

try {
  const input = { home: makeTeam('home-team'), away: makeTeam('away-team'), seed: 'worker-smoke-1' };

  // 1. A real job round-trips through Redis and comes back a finished game.
  const job = await queue.add(SIMULATE_JOB, input);
  const result = await job.waitUntilFinished(events, JOB_TIMEOUT_MS);

  ok('simulate job completes via a real Redis round-trip', !!result);
  ok(
    'result carries a final score for both teams',
    typeof result?.finalScore?.home === 'number' && typeof result?.finalScore?.away === 'number',
    result?.finalScore,
  );
  ok('result carries game events', Array.isArray(result?.events) && result.events.length > 0);
  console.log(`        final score: home ${result?.finalScore?.home} — away ${result?.finalScore?.away}`);

  // 2. Determinism must survive JSON serialization through the queue, not just in-process.
  const job2 = await queue.add(SIMULATE_JOB, input);
  const result2 = await job2.waitUntilFinished(events, JOB_TIMEOUT_MS);
  ok(
    'same seed through the queue yields byte-identical results',
    JSON.stringify(result) === JSON.stringify(result2),
  );

  // 3. A producer/consumer version skew must surface, not vanish into the queue.
  const bad = await queue.add('not-a-real-job', input);
  let rejected = false;
  try {
    await bad.waitUntilFinished(events, JOB_TIMEOUT_MS);
  } catch (err) {
    rejected = /Unsupported job name/.test(err.message);
  }
  ok('unknown job name is rejected with a directed error', rejected);
} finally {
  await worker.close();
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  await events.close();
}

console.log(`\n=== worker smoke: ${failures === 0 ? 'ALL PASS' : `${failures} FAILED`} ===`);
process.exit(failures === 0 ? 0 : 1);
