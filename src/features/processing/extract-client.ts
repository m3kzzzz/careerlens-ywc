import type { DecodedQr } from "@/domain/types";
import type { ExtractResponse } from "@/lib/extraction/api-contract";

/** Send one prepared photo to /api/extract. Network failures become retryable errors. */
export async function requestExtraction(
  image: Blob,
  qr: DecodedQr[],
  signal: AbortSignal,
): Promise<ExtractResponse> {
  const form = new FormData();
  form.append("image", image, image.type === "image/jpeg" ? "photo.jpg" : "photo");
  form.append("qr", JSON.stringify(qr));

  let res: Response;
  try {
    res = await fetch("/api/extract", { method: "POST", body: form, signal });
  } catch (err) {
    if (signal.aborted) throw err;
    return { ok: false, error: { code: "upstream", message: "No connection. Will try again.", retryable: true } };
  }

  try {
    return (await res.json()) as ExtractResponse;
  } catch {
    // e.g. the platform's own 413/504 HTML page
    return {
      ok: false,
      error: {
        code: res.status === 413 ? "too_large" : "upstream",
        message: res.status === 413 ? "This photo is too large to send." : `Server error (${res.status}).`,
        retryable: res.status !== 413,
      },
    };
  }
}
