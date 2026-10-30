import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActive } from "./nav-items";

describe("primary navigation", () => {
  it("has exactly three tabs in order: Upload, Companies, My Calendar", () => {
    expect(NAV_ITEMS.map((i) => [i.label, i.href])).toEqual([
      ["Upload", "/"],
      ["Companies", "/companies"],
      ["My Calendar", "/calendar"],
    ]);
    expect(NAV_ITEMS.some((i) => /dates|home/i.test(i.label))).toBe(false);
  });

  it("marks exactly one tab active for each screen", () => {
    const active = (path: string) => NAV_ITEMS.filter((i) => isActive(path, i.href)).map((i) => i.label);
    expect(active("/")).toEqual(["Upload"]);
    expect(active("/batches/abc")).toEqual(["Upload"]);
    expect(active("/companies")).toEqual(["Companies"]);
    expect(active("/companies/lp")).toEqual(["Companies"]);
    expect(active("/calendar")).toEqual(["My Calendar"]);
  });
});
