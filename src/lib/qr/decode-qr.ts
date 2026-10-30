"use client";

import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import type { DecodedQr } from "@/domain/types";

let prepared = false;

/** Load the reader WebAssembly from this app (copied to /public/wasm by postinstall), not a CDN. */
function ensureModule() {
  if (prepared) return;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/wasm/${path}` : prefix + path),
    },
  });
  prepared = true;
}

const ROWS = ["top", "middle", "bottom"];
const COLS = ["left", "center", "right"];

/** Describe where a code sits on the photo in words the model can use ("bottom-right"). */
export function regionName(cx: number, cy: number, width: number, height: number): string {
  const row = ROWS[Math.min(2, Math.floor((cy / height) * 3))];
  const col = COLS[Math.min(2, Math.floor((cx / width) * 3))];
  if (row === "middle" && col === "center") return "center";
  return row === "middle" ? `middle-${col}` : `${row}-${col}`;
}

/** Decode every QR code in an image. Several codes per brochure are common. */
export async function decodeQrCodes(image: ImageData): Promise<DecodedQr[]> {
  ensureModule();
  const results = await readBarcodes(image, {
    formats: ["QRCode", "MicroQRCode"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 12,
  });

  const seen = new Set<string>();
  const codes: DecodedQr[] = [];
  for (const r of results) {
    const text = r.text?.trim();
    if (!r.isValid || !text || seen.has(text)) continue;
    seen.add(text);
    const { topLeft, topRight, bottomLeft, bottomRight } = r.position;
    const cx = (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4;
    const cy = (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4;
    codes.push({ text, region: regionName(cx, cy, image.width, image.height) });
  }
  return codes;
}
