import { z } from "zod";
import type { PhotoExtraction } from "./types";

/** Shared between the /api/extract route and the browser client. */

export const EXTRACT_MAX_IMAGE_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const EXTRACT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const qrPayloadSchema = z
  .array(z.object({ text: z.string().min(1).max(2000), region: z.string().max(20) }))
  .max(12);

export type ExtractErrorCode =
  | "not_configured" // no GEMINI_API_KEY on the server
  | "bad_request"
  | "too_large"
  | "forbidden"
  | "rate_limited" // our limiter or Gemini 429
  | "model_unavailable" // wrong model ID or model not enabled for this key
  | "auth" // key rejected
  | "upstream" // Gemini 5xx / network
  | "timeout"
  | "blocked" // safety or other refusal
  | "invalid_response"; // output failed schema validation

export interface ExtractError {
  code: ExtractErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export type ExtractResponse = { ok: true; extraction: PhotoExtraction } | { ok: false; error: ExtractError };
