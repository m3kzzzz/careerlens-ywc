import { NextResponse } from "next/server";
import {
  EXTRACT_IMAGE_TYPES,
  EXTRACT_MAX_IMAGE_BYTES,
  qrPayloadSchema,
  type ExtractError,
  type ExtractResponse,
} from "@/lib/extraction/api-contract";
import { postprocessExtraction } from "@/lib/extraction/postprocess";
import { ExtractionFailure, extractWithGemini } from "@/server/gemini";
import { checkRateLimit, clientKey } from "@/server/rate-limit";

export const maxDuration = 60;

const STATUS: Record<ExtractError["code"], number> = {
  not_configured: 503,
  bad_request: 400,
  too_large: 413,
  forbidden: 403,
  rate_limited: 429,
  quota_exhausted: 429,
  model_unavailable: 502,
  auth: 502,
  upstream: 502,
  timeout: 504,
  blocked: 422,
  invalid_response: 502,
};

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null; // e.g. "null" from sandboxed frames
  }
}

function fail(error: ExtractError) {
  const headers = error.retryAfterMs ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } : undefined;
  return NextResponse.json<ExtractResponse>({ ok: false, error }, { status: STATUS[error.code], headers });
}

/**
 * POST multipart/form-data { image: File, qr: JSON DecodedQr[] }
 * → one photo's structured extraction.
 */
export async function POST(req: Request) {
  // Only our own pages may call this endpoint from a browser.
  const origin = req.headers.get("origin");
  if (origin && originHost(origin) !== req.headers.get("host")) {
    return fail({ code: "forbidden", message: "Cross-origin requests are not allowed.", retryable: false });
  }

  const limit = checkRateLimit(clientKey(req));
  if (!limit.ok) {
    return fail({ code: "rate_limited", message: "Too many photos at once. Waiting a moment.", retryable: true, retryAfterMs: limit.retryAfterMs });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > EXTRACT_MAX_IMAGE_BYTES + 64 * 1024) {
    return fail({ code: "too_large", message: "This photo is too large to send.", retryable: false });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail({ code: "bad_request", message: "Expected a multipart upload.", retryable: false });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return fail({ code: "bad_request", message: "No image was attached.", retryable: false });
  }
  if (!(EXTRACT_IMAGE_TYPES as readonly string[]).includes(image.type)) {
    return fail({ code: "bad_request", message: `Unsupported image type "${image.type}".`, retryable: false });
  }
  if (image.size > EXTRACT_MAX_IMAGE_BYTES) {
    return fail({ code: "too_large", message: "This photo is too large to send.", retryable: false });
  }

  let qr;
  try {
    qr = qrPayloadSchema.parse(JSON.parse(String(form.get("qr") ?? "[]")));
  } catch {
    return fail({ code: "bad_request", message: "QR payload is invalid.", retryable: false });
  }

  try {
    const { result, model } = await extractWithGemini({
      image: { data: Buffer.from(await image.arrayBuffer()), mimeType: image.type },
      qr,
      signal: req.signal,
    });
    const extraction = postprocessExtraction(result, qr, { model });
    return NextResponse.json<ExtractResponse>({ ok: true, extraction });
  } catch (err) {
    if (err instanceof ExtractionFailure) return fail(err.error);
    console.error("[extract] unexpected error", err);
    return fail({ code: "upstream", message: "Something went wrong while reading this photo.", retryable: true });
  }
}
