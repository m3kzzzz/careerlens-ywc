import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { company, opportunity } from "@/test/fixtures";
import { getDB, resetDBForTests } from "./index";
import { getInterestedIds, removeInterests, saveCompanies, setInterested } from "./interests";
import { loadLibrary } from "./library";

async function seed() {
  const db = getDB();
  await db.companies.bulkPut([company("lp", "Lumen Pay"), company("kd", "Kanok Digital"), company("og", "Orbit Games")]);
  await db.opportunities.bulkPut([
    opportunity("o1", "lp", "Software Engineer Intern", { deadlineIso: "2026-11-02" }),
    opportunity("o2", "lp", "QA Engineer Intern"),
  ]);
}

describe("company interest persistence", () => {
  beforeEach(async () => {
    resetDBForTests();
    await getDB().delete();
    resetDBForTests();
    await seed();
  });

  it("saves and unsaves at the company level", async () => {
    await setInterested("lp", true);
    expect(await getInterestedIds()).toEqual(new Set(["lp"]));
    await setInterested("lp", false);
    expect(await getInterestedIds()).toEqual(new Set());
  });

  it("adds several companies at once, ignoring unknown and already-saved ids", async () => {
    await saveCompanies(["lp"]);
    const firstSavedAt = (await getDB().interests.get("lp"))!.savedAt;
    await saveCompanies(["lp", "kd", "does-not-exist"]);
    expect(await getInterestedIds()).toEqual(new Set(["lp", "kd"]));
    expect((await getDB().interests.get("lp"))!.savedAt).toBe(firstSavedAt);
  });

  it("survives a reload (new connection to the same database)", async () => {
    await saveCompanies(["lp", "kd"]);
    resetDBForTests();
    expect((await loadLibrary()).interestedIds).toEqual(new Set(["lp", "kd"]));
  });

  it("removing from My Calendar never deletes the company or its positions", async () => {
    await saveCompanies(["lp", "kd"]);
    await removeInterests(["lp", "kd"]);
    const lib = await loadLibrary();
    expect(lib.interestedIds.size).toBe(0);
    expect(lib.companies.map((c) => c.id).sort()).toEqual(["kd", "lp", "og"]);
    expect(lib.opportunities).toHaveLength(2);
  });

  it("keeps selections when a later batch updates a company's opportunities", async () => {
    await saveCompanies(["lp"]);
    await getDB().opportunities.put(opportunity("o3", "lp", "Product Design Intern", { deadlineIso: "2026-11-20" }));
    await getDB().companies.update("lp", { updatedAt: "2026-10-30T00:00:00Z", updatedInBatchId: "b2" });
    const lib = await loadLibrary();
    expect(lib.interestedIds).toEqual(new Set(["lp"]));
    expect(lib.opportunities.filter((o) => o.companyId === "lp")).toHaveLength(3);
  });

  it("ignores an interest whose company no longer exists", async () => {
    await saveCompanies(["og"]);
    await getDB().companies.delete("og");
    expect((await loadLibrary()).interestedIds.has("og")).toBe(false);
  });
});
