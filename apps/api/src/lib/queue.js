import { Queue } from "bullmq";
import { config } from "../config.js";
import { getRedis } from "./redis.js";

let queue;

export function initQueue() {
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  if (queue) {
    return queue;
  }
  queue = new Queue(config.queue.name, { connection: redis });
  return queue;
}

export async function enqueueJob(name, data, opts = {}) {
  if (!queue) {
    return null;
  }
  return queue.add(name, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: 500,
    ...opts
  });
}
