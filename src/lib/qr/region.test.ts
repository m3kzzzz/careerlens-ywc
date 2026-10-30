import { describe, expect, it, vi } from "vitest";

vi.mock("zxing-wasm/reader", () => ({ prepareZXingModule: vi.fn(), readBarcodes: vi.fn() }));
const { regionName } = await import("./decode-qr");

describe("regionName", () => {
  it("names the 3×3 grid cell", () => {
    expect(regionName(950, 1150, 1000, 1200)).toBe("bottom-right");
    expect(regionName(10, 10, 1000, 1200)).toBe("top-left");
    expect(regionName(500, 600, 1000, 1200)).toBe("center");
    expect(regionName(100, 600, 1000, 1200)).toBe("middle-left");
    expect(regionName(1000, 1200, 1000, 1200)).toBe("bottom-right"); // edge pixel
  });
});
