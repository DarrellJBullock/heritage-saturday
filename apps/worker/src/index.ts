import { createSimulationWorker } from './worker';
import { SIMULATION_QUEUE } from './queue';

export * from './queue';
export * from './processor';
export * from './worker';

/**
 * Entrypoint. Cap 1 does not enqueue anything (apps/api simulates synchronously per
 * architecture.md §545), so a running worker idles until a producer appears. It exists
 * now so the queue contract and engine reuse are settled before the migration.
 */
if (require.main === module) {
  const worker = createSimulationWorker();
  console.log(`[worker] listening on queue "${SIMULATION_QUEUE}"`);

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, draining…`);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
