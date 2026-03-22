import IORedis from "ioredis";
import { config } from "../config.js";

let redis;

export function hasRedis() {
  return Boolean(config.redis.url);
}

export function initRedis() {
  if (!hasRedis()) {
    return null;
  }
  if (redis) {
    return redis;
  }
  redis = new IORedis(config.redis.url, { maxRetriesPerRequest: null });
  redis.on("error", (error) => {
    console.error("[redis]", error.message);
  });
  return redis;
}

export function getRedis() {
  return redis;
}

export async function cacheGetJson(key) {
  if (!redis) {
    return null;
  }
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSetJson(key, value, ttlSeconds = 60) {
  if (!redis) {
    return;
  }
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}
