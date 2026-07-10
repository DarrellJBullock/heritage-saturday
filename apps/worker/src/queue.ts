import type { SimulationInput, SimulationResult } from '@heritage-saturday/simulation-engine';

/**
 * Queue + job names are the contract between apps/api (producer) and apps/worker
 * (consumer). architecture.md §557: migrating away from the synchronous call site
 * means `GamesService` enqueues SIMULATE_JOB here instead of calling simulateGame()
 * directly — the engine's input/output contract does not change, which is why
 * SimulateJobData is exactly SimulationInput and not a bespoke shape.
 */
export const SIMULATION_QUEUE = 'simulation';
export const SIMULATE_JOB = 'simulate';

export type SimulateJobData = SimulationInput;

/**
 * The worker returns the raw engine result. It deliberately does NOT persist Game /
 * GameEvent / TeamGameStats / PlayerGameStats — that transaction lives in
 * apps/api GamesService (architecture.md §6, step 3) and duplicating it here would
 * recreate exactly the "duplicate implementation risk" §560 says this app avoids.
 * Whoever moves simulation off the request path moves that persistence step too.
 */
export type SimulateJobResult = SimulationResult;

export function redisConnectionFromEnv(): { url: string } {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set (see .env.example; docker compose up -d redis)');
  }
  return { url };
}
