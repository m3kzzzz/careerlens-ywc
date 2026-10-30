import { ApiError, GoogleGenAI } from "@google/genai";
import { aiPhotoExtractionJsonSchema, aiPhotoExtractionSchema, type AiPhotoExtraction } from "@/lib/extraction/ai-schema";
import type { ExtractError } from "@/lib/extraction/api-contract";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "@/lib/extraction/prompt";
import type { DecodedQr } from "@/lib/extraction/types";

/** Server-only Gemini access. The API key never leaves the server. */

export const DEFAULT_MODEL = "gemini-3.6-flash";
/** Used once when the main model is overloaded or out of quota ("none" disables). */
// gemini-2.5-flash is listed but returns 404 for new API keys, so the fallback is 3.5.
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash";
// Two attempts (main + fallback) must fit in the route's 60 s limit.
const REQUEST_TIMEOUT_MS = 25_000;

let client: GoogleGenAI | null = null;

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  return { apiKey, model, fallbackModel: fallback === "none" || fallback === model ? null : fallback };
}

function getClient(apiKey: string) {
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

const jsonSchema = aiPhotoExtractionJsonSchema();

export class ExtractionFailure extends Error {
  constructor(public readonly error: ExtractError) {
    super(error.message);
  }
}

export async function extractWithGemini(input: {
  image: { data: Buffer; mimeType: string };
  qr: DecodedQr[];
  signal?: AbortSignal;
}): Promise<{ result: AiPhotoExtraction; model: string }> {
  const { apiKey, model, fallbackModel } = geminiConfig();
  if (!apiKey) {
    throw new ExtractionFailure({
      code: "not_configured",
      message: "The server has no GEMINI_API_KEY configured.",
      retryable: false,
    });
  }
  try {
    return { result: await callModel(apiKey, model, input), model };
  } catch (err) {
    // Demand spikes (503) and per-model quota (429) are model-specific: try the fallback model once.
    const code = err instanceof ExtractionFailure ? err.error.code : null;
    if (!fallbackModel || (code !== "upstream" && code !== "rate_limited" && code !== "quota_exhausted") || input.signal?.aborted) throw err;
    console.warn(`[extract] ${model} unavailable (${code}); trying ${fallbackModel}`);
    try {
      return { result: await callModel(apiKey, fallbackModel, input), model: fallbackModel };
    } catch (fallbackErr) {
      // A broken fallback must never turn a temporary problem into a fatal one: report the main model's error.
      const reason = fallbackErr instanceof ExtractionFailure ? fallbackErr.error.code : "error";
      console.warn(`[extract] fallback ${fallbackModel} failed (${reason}); reporting ${model}'s error`);
      throw err;
    }
  }
}

async function callModel(
  apiKey: string,
  model: string,
  input: { image: { data: Buffer; mimeType: string }; qr: DecodedQr[]; signal?: AbortSignal },
): Promise<AiPhotoExtraction> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;

  let text: string | undefined;
  try {
    const response = await getClient(apiKey).models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: input.image.mimeType, data: input.image.data.toString("base64") } },
            { text: buildUserPrompt(input.qr) },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        abortSignal: signal,
      },
    });
    text = response.text;
    if (!text) {
      const reason = response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason ?? "empty response";
      throw new ExtractionFailure({
        code: "blocked",
        message: `Gemini returned no content (${reason}).`,
        retryable: false,
      });
    }
  } catch (err) {
    throw toFailure(err, model, timeout.aborted);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ExtractionFailure({ code: "invalid_response", message: "Gemini returned malformed JSON.", retryable: true });
  }
  const parsed = aiPhotoExtractionSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[extract] schema validation failed", parsed.error.issues.slice(0, 5));
    throw new ExtractionFailure({
      code: "invalid_response",
      message: "Gemini's answer didn't match the expected structure.",
      retryable: true,
    });
  }
  return parsed.data;
}

function toFailure(err: unknown, model: string, timedOut: boolean): ExtractionFailure {
  if (err instanceof ExtractionFailure) return err;
  if (timedOut) {
    return new ExtractionFailure({ code: "timeout", message: "Gemini took too long to answer.", retryable: true });
  }
  if (err instanceof ApiError) {
    const msg = err.message ?? "";
    // Log the upstream reason (never the key) so failures can be diagnosed.
    console.warn(`[extract] ${model} → ${err.status}: ${msg.replace(/\s+/g, " ").slice(0, 200)}`);
    if (err.status === 429) {
      const retryAfterMs = parseRetryDelay(msg);
      // A per-day quota can't be waited out within a batch: say so instead of retrying for hours.
      if (/PerDay/i.test(msg) || (retryAfterMs ?? 0) > 10 * 60 * 1000) {
        const hours = retryAfterMs ? Math.max(1, Math.round(retryAfterMs / 3_600_000)) : null;
        return new ExtractionFailure({
          code: "quota_exhausted",
          message: `This API key has used its Gemini daily limit${hours ? `. It resets in about ${hours} hour${hours === 1 ? "" : "s"}` : ""}. Retry then, or enable billing for a higher limit.`,
          retryable: false,
        });
      }
      return new ExtractionFailure({ code: "rate_limited", message: "Gemini's rate limit was reached.", retryable: true, retryAfterMs });
    }
    if (err.status === 404 || /not found|is not supported/i.test(msg)) {
      return new ExtractionFailure({
        code: "model_unavailable",
        message: `Model "${model}" isn't available for this API key. Check GEMINI_MODEL.`,
        retryable: false,
      });
    }
    if (err.status === 401 || err.status === 403 || /api key/i.test(msg)) {
      return new ExtractionFailure({ code: "auth", message: "Gemini rejected the API key.", retryable: false });
    }
    if (err.status === 400) {
      return new ExtractionFailure({ code: "bad_request", message: "Gemini couldn't process this image.", retryable: false });
    }
    if (err.status >= 500) {
      const busy = /high demand|overloaded|UNAVAILABLE/i.test(msg);
      return new ExtractionFailure({
        code: "upstream",
        message: busy ? "Gemini is busy right now. Trying again shortly." : "Gemini is temporarily unavailable.",
        retryable: true,
        retryAfterMs: busy ? 8000 : undefined,
      });
    }
  }
  console.error("[extract] unexpected Gemini error", err);
  return new ExtractionFailure({ code: "upstream", message: "Couldn't reach Gemini.", retryable: true });
}

/** Gemini 429 bodies include e.g. "retryDelay": "21s". */
function parseRetryDelay(message: string): number | undefined {
  const m = message.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}
