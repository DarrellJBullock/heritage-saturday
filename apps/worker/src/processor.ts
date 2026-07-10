import { simulateGame } from '@heritage-saturday/simulation-engine';
import type { SimulateJobData, SimulateJobResult } from './queue';

/**
 * Separated from the BullMQ Worker wiring so it can be exercised without a live
 * Redis. Holds no queue/transport concepts — same determinism guarantee as the
 * engine: identical input (including seed) yields an identical result.
 */
export function processSimulateJob(data: SimulateJobData): SimulateJobResult {
  return simulateGame(data);
}
