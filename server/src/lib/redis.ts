import { Redis } from "ioredis";
import { config } from "../config.js";

// Shared by the catalog cache and the rate-limit store -- one connection,
// two consumers. `null` when REDIS_URL isn't set: callers treat that as
// "caching/shared rate limiting unavailable" rather than crashing, so local
// dev without Docker still works (see config.ts).
export const redis = config.REDIS_URL
    ? new Redis(config.REDIS_URL, {
          // @fastify/rate-limit's README calls out that ioredis's defaults
          // aren't tuned for rate limiting -- an unbounded retry queue would
          // rather block requests than fail open.
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
      })
    : null;

if (!redis) {
    console.warn("REDIS_URL not set -- catalog caching disabled, rate limiting uses in-memory store");
}
