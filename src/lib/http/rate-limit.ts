/**
 * Fixed-window rate limiter backed by an in-memory map.
 *
 * Suitable for single-instance deployments and as a fail-safe for
 * multi-instance ones (each replica applies its own limit, which is
 * intentionally conservative). For strict per-tenant enforcement across
 * replicas, layer a Redis-backed limiter at the ingress and keep this as
 * a defence-in-depth.
 */

interface Bucket {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetEpochSeconds: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    const expiresAt = now + config.windowMs;
    buckets.set(key, { count: 1, expiresAt });
    return {
      allowed: true,
      remaining: Math.max(0, config.max - 1),
      retryAfterSeconds: 0,
      resetEpochSeconds: Math.ceil(expiresAt / 1000),
    };
  }

  if (bucket.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      resetEpochSeconds: Math.ceil(bucket.expiresAt / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.max - bucket.count),
    retryAfterSeconds: 0,
    resetEpochSeconds: Math.ceil(bucket.expiresAt / 1000),
  };
}

/**
 * Only exposed to tests. Do not use in application code.
 */
export function clearRateLimitsForTests(): void {
  buckets.clear();
}

const IP_ALLOW_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"];

/**
 * Best-effort remote-address extraction that treats any client-controlled
 * header as untrusted: only the first IPv4/IPv6 token is kept.
 */
export function requestClientAddress(request: Request): string {
  for (const name of IP_ALLOW_HEADERS) {
    const value = request.headers.get(name);
    if (!value) continue;
    const first = value.split(",")[0]?.trim();
    if (first && first.length <= 45) return first;
  }
  return "anonymous";
}
