/**
 * Small fixed-window limiter to stop casual abuse of the public extraction
 * endpoint (which spends Gemini quota). It is per server instance, so on
 * serverless it is best-effort, not a hard guarantee.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterMs: number } {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return { ok: true };
  }
  if (entry.count >= MAX_PER_WINDOW) return { ok: false, retryAfterMs: entry.resetAt - now };
  entry.count += 1;
  return { ok: true };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
