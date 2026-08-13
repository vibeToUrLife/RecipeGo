import 'server-only'

// Best-effort in-memory fixed-window rate limiter.
//
// Scope caveat: this lives in a single Node process, so on serverless it limits
// per *warm instance*, not globally, and the window resets on a cold start. That
// is enough to blunt a single abusive client hammering one instance; for a hard,
// cross-instance guarantee swap the Map for a shared store (e.g. Upstash Redis or
// a Postgres table). Kept in-memory here to avoid adding infrastructure.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  retryAfterSec: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  // Opportunistic cleanup so the map can't grow unbounded across many distinct keys.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
  }

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  bucket.count++
  return { ok: true, retryAfterSec: 0 }
}

// Clear all counters. Handy in tests and for a manual operational reset.
export function resetRateLimit(): void {
  buckets.clear()
}
