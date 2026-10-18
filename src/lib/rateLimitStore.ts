import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import type { RedisReply } from "rate-limit-redis";
import type { Store } from "express-rate-limit";
import { env } from "../configs/env.ts";
import { logger, serializeError } from "./logger.ts";

// Optional: without REDIS_URL, express-rate-limit falls back to its in-memory
// store (per-process, reset on every deploy, not shared across instances).
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      // If Redis is down, fail each command FAST so passOnStoreError can let the
      // request through, instead of every login hanging on reconnect attempts.
      commandTimeout: 250,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    })
  : null;

redis?.on("error", (err) =>
  logger.error({ err: serializeError(err) }, "redis error"),
);

if (!redis && env.NODE_ENV === "production") {
  logger.warn(
    "REDIS_URL is not set: rate limits are per-process and reset on deploy. Set it before running more than one instance.",
  );
}

/** Each limiter needs its own store with a unique prefix. */
export const createStore = (name: string): Store | undefined => {
  if (!redis) return undefined;

  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
  });
};

export const closeRedis = async (): Promise<void> => {
  if (!redis) return;
  await redis.quit().catch(() => undefined);
};
