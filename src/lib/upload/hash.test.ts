import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "./hash";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("sha256Hex", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hashes with Web Crypto", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(ABC);
  });

  it("hashes Blobs", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe(ABC);
  });

  it("falls back to pure JS outside secure contexts", async () => {
    vi.stubGlobal("crypto", {});
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(ABC);
  });

  it("gives identical files identical hashes and different files different ones", async () => {
    const a = await sha256Hex(new Blob([new Uint8Array([1, 2, 3])]));
    const b = await sha256Hex(new Blob([new Uint8Array([1, 2, 3])]));
    const c = await sha256Hex(new Blob([new Uint8Array([1, 2, 4])]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
