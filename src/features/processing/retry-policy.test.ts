import { describe, expect, it } from "vitest";
import { MAX_AUTO_ATTEMPTS, MAX_RATE_LIMITED_ATTEMPTS, isBatchFatal, retryDelayMs } from "./retry-policy";

const noJitter = () => 0;

describe("retryDelayMs", () => {
  it("backs off exponentially for transient errors", () => {
    const e = { code: "upstream" as const, message: "", retryable: true };
    expect(retryDelayMs(e, 1, noJitter)).toBe(1500);
    expect(retryDelayMs(e, 2, noJitter)).toBe(3000);
    expect(retryDelayMs(e, 3, noJitter)).toBe(6000);
    expect(retryDelayMs(e, MAX_AUTO_ATTEMPTS, noJitter)).toBeNull();
  });

  it("honours Gemini's retry-after on rate limits and waits longer before giving up", () => {
    const e = { code: "rate_limited" as const, message: "", retryable: true, retryAfterMs: 21_000 };
    expect(retryDelayMs(e, 1, noJitter)).toBe(21_000);
    expect(retryDelayMs(e, MAX_AUTO_ATTEMPTS, noJitter)).not.toBeNull();
    expect(retryDelayMs(e, MAX_RATE_LIMITED_ATTEMPTS, noJitter)).toBeNull();
  });

  it("does not retry permanent errors, and re-asks only once for bad output", () => {
    expect(retryDelayMs({ code: "bad_request", message: "", retryable: false }, 1)).toBeNull();
    const bad = { code: "invalid_response" as const, message: "", retryable: true };
    expect(retryDelayMs(bad, 1, noJitter)).toBe(1500);
    expect(retryDelayMs(bad, 2, noJitter)).toBeNull();
  });
});

describe("isBatchFatal", () => {
  it("stops the batch for configuration problems only", () => {
    expect(isBatchFatal({ code: "not_configured", message: "", retryable: false })).toBe(true);
    expect(isBatchFatal({ code: "model_unavailable", message: "", retryable: false })).toBe(true);
    expect(isBatchFatal({ code: "rate_limited", message: "", retryable: true })).toBe(false);
    expect(isBatchFatal({ code: "quota_exhausted", message: "", retryable: false })).toBe(true);
    expect(isBatchFatal({ code: "blocked", message: "", retryable: false })).toBe(false);
  });
});
