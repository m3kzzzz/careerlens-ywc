import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES } from "./constants";
import { isHeic, validateImageFile } from "./validate";

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("validateImageFile", () => {
  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.png", "image/png"],
    ["photo.webp", "image/webp"],
    ["IMG_1.HEIC", "image/heic"],
  ])("accepts %s", (name, type) => {
    expect(validateImageFile(f(name, type))).toBeNull();
  });

  it("accepts HEIC by extension when the browser reports no MIME type", () => {
    expect(validateImageFile(f("IMG_0001.HEIC", ""))).toBeNull();
  });

  it("rejects non-image files", () => {
    expect(validateImageFile(f("brochure.pdf", "application/pdf"))).toBe("unsupported_type");
    expect(validateImageFile(f("anim.gif", "image/gif"))).toBe("unsupported_type");
  });

  it("does not trust the extension when a different MIME type is given", () => {
    expect(validateImageFile(f("fake.jpg", "text/html"))).toBe("unsupported_type");
  });

  it("rejects empty and oversized files", () => {
    expect(validateImageFile(f("a.jpg", "image/jpeg", 0))).toBe("empty");
    expect(validateImageFile(f("a.jpg", "image/jpeg", MAX_FILE_BYTES + 1))).toBe("too_large");
  });
});

describe("isHeic", () => {
  it("detects HEIC by type or extension", () => {
    expect(isHeic(f("a.heic", ""))).toBe(true);
    expect(isHeic(f("a", "image/heif"))).toBe(true);
    expect(isHeic(f("a.jpg", "image/jpeg"))).toBe(false);
  });
});
