import type { ExtractError, ExtractErrorCode } from "@/lib/extraction/api-contract";

export const MAX_AUTO_ATTEMPTS = 4;
/** Waiting out a rate limit is expected on free API tiers, so it gets more patience. */
export const MAX_RATE_LIMITED_ATTEMPTS = 8;

/** Errors that will fail every photo the same way: stop the batch instead of burning quota. */
const BATCH_FATAL: ExtractErrorCode[] = ["not_configured", "auth", "model_unavailable", "forbidden", "quota_exhausted"];

export function isBatchFatal(error: ExtractError): boolean {
  return BATCH_FATAL.includes(error.code);
}

/**
 * Delay before the next automatic attempt, or null to give up.
 * `attempt` is the number of attempts already made (1 after the first failure).
 */
export function retryDelayMs(error: ExtractError, attempt: number, random = Math.random): number | null {
  const max = error.code === "rate_limited" ? MAX_RATE_LIMITED_ATTEMPTS : MAX_AUTO_ATTEMPTS;
  if (!error.retryable || attempt >= max) return null;
  if (error.code === "invalid_response" && attempt >= 2) return null; // one re-ask is enough
  const backoff = 1500 * 2 ** (attempt - 1); // 1.5s, 3s, 6s
  const jitter = Math.round(random() * 500);
  return Math.min(60_000, Math.max(error.retryAfterMs ?? 0, backoff) + jitter);
}
