import type { ExtractError, ExtractErrorCode } from "@/lib/extraction/api-contract";

export const MAX_AUTO_ATTEMPTS = 4;

/** Errors that will fail every photo the same way: stop the batch instead of burning quota. */
const BATCH_FATAL: ExtractErrorCode[] = ["not_configured", "auth", "model_unavailable", "forbidden"];

export function isBatchFatal(error: ExtractError): boolean {
  return BATCH_FATAL.includes(error.code);
}

/**
 * Delay before the next automatic attempt, or null to give up.
 * `attempt` is the number of attempts already made (1 after the first failure).
 */
export function retryDelayMs(error: ExtractError, attempt: number, random = Math.random): number | null {
  if (!error.retryable || attempt >= MAX_AUTO_ATTEMPTS) return null;
  if (error.code === "invalid_response" && attempt >= 2) return null; // one re-ask is enough
  const backoff = 1500 * 2 ** (attempt - 1); // 1.5s, 3s, 6s
  const jitter = Math.round(random() * 500);
  return Math.min(60_000, Math.max(error.retryAfterMs ?? 0, backoff) + jitter);
}
