"use client";

import type { PhotoQrScan } from "@/domain/types";
import { EXTRACT_MAX_IMAGE_BYTES } from "@/lib/extraction/api-contract";
import { decodeQrCodes } from "@/lib/qr/decode-qr";
import { isHeic } from "@/lib/upload/validate";

/** Long edge of the image sent to Gemini: enough for small brochure text. */
const AI_MAX_EDGE = 2048;
/** QR codes are decoded from a larger copy so small codes stay sharp. */
const QR_MAX_EDGE = 2560;
const JPEG_QUALITY = 0.85;

export interface PreparedPhoto {
  blob: Blob;
  width?: number;
  height?: number;
  qr: PhotoQrScan;
}

export class PhotoPrepError extends Error {}

async function decode(blob: Blob): Promise<ImageBitmap | null> {
  try {
    // Applies EXIF orientation so sideways phone photos are upright.
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

function draw(bitmap: ImageBitmap, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new PhotoPrepError("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, ctx, width, height };
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoPrepError("Couldn't encode the photo."))), "image/jpeg", JPEG_QUALITY),
  );
}

/**
 * Decode QR codes and produce the JPEG sent to the AI. Re-encoding also
 * strips EXIF metadata such as GPS location before the photo leaves the device.
 */
export async function preparePhoto(file: Blob, fileName: string): Promise<PreparedPhoto> {
  const bitmap = await decode(file);

  if (!bitmap) {
    // HEIC can't be decoded outside Safari; Gemini accepts it directly.
    if (isHeic({ name: fileName, type: file.type }) && file.size <= EXTRACT_MAX_IMAGE_BYTES) {
      const blob = file.type ? file : new Blob([file], { type: "image/heic" });
      return { blob, qr: { status: "unsupported", codes: [] } };
    }
    throw new PhotoPrepError(
      isHeic({ name: fileName, type: file.type })
        ? "This browser can't open HEIC photos this large. Try Safari, or export the photo as JPEG."
        : "This photo couldn't be opened. It may be damaged or in an unsupported format.",
    );
  }

  try {
    let qr: PhotoQrScan;
    try {
      const big = draw(bitmap, QR_MAX_EDGE);
      const codes = await decodeQrCodes(big.ctx.getImageData(0, 0, big.width, big.height));
      qr = { status: "done", codes };
    } catch (err) {
      console.warn("QR decoding failed", err);
      qr = { status: "failed", codes: [] };
    }

    const small = draw(bitmap, AI_MAX_EDGE);
    const blob = await toJpeg(small.canvas);
    return { blob, width: small.width, height: small.height, qr };
  } finally {
    bitmap.close();
  }
}
