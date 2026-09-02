type Bucket = { count: number; resetAt: number };

// Best-effort, per-instance rate limiting. Serverless functions can scale to
// multiple warm instances, so this doesn't guarantee a hard global cap — but
// it stops accidental hammering (a stuck retry loop, a runaway script) from
// a single client, which is the actual risk for an internal finance tool
// with no public traffic. Not a substitute for a shared store like Redis if
// this app ever needs a real hard limit.
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(key: string, options: { max: number; windowMs: number }): RateLimitResult {
  const { max, windowMs } = options;
  const now = Date.now();

  if (buckets.size > 1000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, resetAt: existing.resetAt };
}

// Takes anything with readable headers — a NextRequest in a route handler,
// or { headers: await headers() } inside a server action.
type HeaderSource = { headers: { get(name: string): string | null } };

export function getClientIp(request: HeaderSource): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponseInit(result: RateLimitResult): ResponseInit {
  return {
    status: 429,
    headers: {
      "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
    }
  };
}
