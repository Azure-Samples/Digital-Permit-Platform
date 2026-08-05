import type { RedisOptions } from "ioredis";

export function getRedisConnectionOptions(
  redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
): RedisOptions {
  const url = new URL(redisUrl);
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname || "localhost",
    port: Number(url.port || (url.protocol === "rediss:" ? "6380" : "6379")),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isInteger(database) ? database : undefined,
    maxRetriesPerRequest: null,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}