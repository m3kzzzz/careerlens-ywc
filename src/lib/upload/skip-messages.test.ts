import { describe, expect, it } from "vitest";
import { summarizeSkipped } from "./skip-messages";

describe("summarizeSkipped", () => {
  it("names the company for a single saved duplicate, as in the design", () => {
    const [m] = summarizeSkipped([
      { file: { name: "IMG_4790.jpg" }, reason: "already_saved", existingCompanyName: "Kanok Digital" },
    ]);
    expect(m.title).toBe("1 duplicate skipped.");
    expect(m.detail).toContain("under Kanok Digital");
    expect(m.detail).toContain("doesn't use a slot");
  });

  it("groups by reason and returns nothing for no skips", () => {
    expect(summarizeSkipped([])).toEqual([]);
    const msgs = summarizeSkipped([
      { file: { name: "a.jpg" }, reason: "over_limit" },
      { file: { name: "b.jpg" }, reason: "over_limit" },
      { file: { name: "c.pdf" }, reason: "unsupported_type" },
    ]);
    expect(msgs.map((m) => m.key)).toEqual(["over_limit", "unsupported_type"]);
    expect(msgs[0].title).toBe("2 photos not added.");
  });
});
