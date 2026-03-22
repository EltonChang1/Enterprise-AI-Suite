import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const queueName = process.env.JOBS_QUEUE_NAME || "enterprise-jobs";

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name === "agent-task") {
      return {
        processed: true,
        type: "agent-task",
        tenantId: job.data.tenantId,
        taskId: job.data.taskId,
        completedAt: new Date().toISOString()
      };
    }

    if (job.name === "workflow-run") {
      return {
        processed: true,
        type: "workflow-run",
        tenantId: job.data.tenantId,
        workflowId: job.data.workflowId,
        completedAt: new Date().toISOString()
      };
    }

    return {
      processed: true,
      type: "generic",
      payload: job.data,
      completedAt: new Date().toISOString()
    };
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 8) }
);

const events = new QueueEvents(queueName, { connection });

worker.on("completed", (job) => {
  console.log(`[worker] completed job ${job?.id} (${job?.name})`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed job ${job?.id} (${job?.name})`, error?.message || error);
});

events.on("waiting", ({ jobId }) => {
  console.log(`[worker] job waiting: ${jobId}`);
});

console.log(`[worker] listening on queue '${queueName}' via ${redisUrl}`);
