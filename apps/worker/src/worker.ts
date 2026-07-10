import { Worker } from 'bullmq';
import { processSimulateJob } from './processor';
import {
  SIMULATE_JOB,
  SIMULATION_QUEUE,
  redisConnectionFromEnv,
  type SimulateJobData,
  type SimulateJobResult,
} from './queue';

export function createSimulationWorker(): Worker<SimulateJobData, SimulateJobResult> {
  const { url } = redisConnectionFromEnv();

  const worker = new Worker<SimulateJobData, SimulateJobResult>(
    SIMULATION_QUEUE,
    async (job) => {
      if (job.name !== SIMULATE_JOB) {
        // Unknown job names fail loudly rather than being silently dropped: a
        // producer/consumer version skew should surface, not vanish into the queue.
        throw new Error(`Unsupported job name "${job.name}" on ${SIMULATION_QUEUE}`);
      }
      return processSimulateJob(job.data);
    },
    { connection: { url } },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id ?? '<unknown>'} failed: ${err.message}`);
  });

  return worker;
}
