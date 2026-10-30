import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/** Real zxing WebAssembly in Node: encode a QR image, then decode it with the reader the app uses. */
describe("zxing QR decoding (real wasm)", () => {
  it("decodes a QR code image back to its URL, and finds nothing in an image without one", async () => {
    const writer = await import("zxing-wasm/writer");
    const reader = await import("zxing-wasm/reader");
    writer.prepareZXingModule({ overrides: { wasmBinary: readFileSync(require.resolve("zxing-wasm/writer/zxing_writer.wasm")).buffer as ArrayBuffer } });
    reader.prepareZXingModule({ overrides: { wasmBinary: readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm")).buffer as ArrayBuffer } });

    const url = "https://forms.gle/lumenpay-intern27";
    const written = await writer.writeBarcode(url, { format: "QRCode", scale: 4 });
    expect(written.error).toBeFalsy();
    const decoded = await reader.readBarcodes(written.image!, { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 12 });
    expect(decoded.filter((r) => r.isValid).map((r) => r.text)).toEqual([url]);

    // An image of something that isn't a QR code (here: a Code 128 barcode) yields no QR result.
    const notQr = await writer.writeBarcode("NOT-A-QR", { format: "Code128", scale: 2 });
    const none = await reader.readBarcodes(notQr.image!, { formats: ["QRCode"], tryHarder: true });
    expect(none.filter((r) => r.isValid)).toEqual([]);
  }, 30_000);
});
