import { describe, expect, it } from "vitest";
import { planAdditions } from "./plan-additions";

type F = { name: string };
const c = (name: string, sha256: string) => ({ file: { name }, sha256 });
const none = new Map<string, string | null>();

describe("planAdditions", () => {
  it("accepts new photos into free slots", () => {
    const plan = planAdditions<F>({
      currentHashes: ["a"],
      candidates: [c("b.jpg", "b"), c("c.jpg", "c")],
      savedHashes: none,
      limit: 10,
    });
    expect(plan.accepted.map((x) => x.file.name)).toEqual(["b.jpg", "c.jpg"]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips exact duplicates already in the draft batch", () => {
    const plan = planAdditions<F>({
      currentHashes: ["a"],
      candidates: [c("copy-of-a.jpg", "a")],
      savedHashes: none,
      limit: 10,
    });
    expect(plan.accepted).toEqual([]);
    expect(plan.skipped).toEqual([{ file: { name: "copy-of-a.jpg" }, reason: "duplicate_in_batch" }]);
  });

  it("skips duplicates within the same pick, keeping the first", () => {
    const plan = planAdditions<F>({
      currentHashes: [],
      candidates: [c("one.jpg", "x"), c("two.jpg", "x")],
      savedHashes: none,
      limit: 10,
    });
    expect(plan.accepted.map((x) => x.file.name)).toEqual(["one.jpg"]);
    expect(plan.skipped[0]).toMatchObject({ file: { name: "two.jpg" }, reason: "duplicate_in_batch" });
  });

  it("skips photos saved in an earlier batch and reports their company", () => {
    const plan = planAdditions<F>({
      currentHashes: [],
      candidates: [c("IMG_4790.jpg", "k")],
      savedHashes: new Map([["k", "Kanok Digital"]]),
      limit: 10,
    });
    expect(plan.accepted).toEqual([]);
    expect(plan.skipped).toEqual([
      { file: { name: "IMG_4790.jpg" }, reason: "already_saved", existingCompanyName: "Kanok Digital" },
    ]);
  });

  it("enforces the batch limit without letting duplicates use a slot", () => {
    const plan = planAdditions<F>({
      currentHashes: ["1", "2", "3", "4", "5", "6", "7", "8"],
      candidates: [c("dup.jpg", "1"), c("nine.jpg", "9"), c("saved.jpg", "s"), c("ten.jpg", "10"), c("eleven.jpg", "11")],
      savedHashes: new Map([["s", null]]),
      limit: 10,
    });
    expect(plan.accepted.map((x) => x.file.name)).toEqual(["nine.jpg", "ten.jpg"]);
    expect(plan.skipped.map((s) => [s.file.name, s.reason])).toEqual([
      ["dup.jpg", "duplicate_in_batch"],
      ["saved.jpg", "already_saved"],
      ["eleven.jpg", "over_limit"],
    ]);
  });

  it("passes through invalid files as skipped", () => {
    const plan = planAdditions<F>({
      currentHashes: [],
      candidates: [],
      invalid: [{ file: { name: "doc.pdf" }, reason: "unsupported_type" }],
      savedHashes: none,
      limit: 10,
    });
    expect(plan.skipped).toEqual([{ file: { name: "doc.pdf" }, reason: "unsupported_type" }]);
  });

  it("accepts nothing when the batch is already full", () => {
    const plan = planAdditions<F>({
      currentHashes: Array.from({ length: 10 }, (_, i) => String(i)),
      candidates: [c("new.jpg", "n")],
      savedHashes: none,
      limit: 10,
    });
    expect(plan.accepted).toEqual([]);
    expect(plan.skipped[0].reason).toBe("over_limit");
  });
});
