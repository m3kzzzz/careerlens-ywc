import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Batch } from "@/domain/types";
import type { PhotoExtraction } from "@/lib/extraction/types";
import { getDB, resetDBForTests } from "@/lib/db";
import { saveCompanies } from "@/lib/db/interests";
import { loadLibrary } from "@/lib/db/library";
import { assignPhoto, resolveCompanyMatch, resolveDeadline, suggestCompanyForPhoto } from "@/lib/review/actions";
import { removeLink, renameCompany, updateOpportunity } from "@/lib/review/corrections";
import { exCompany, exLink, exOpp, extraction, photo } from "@/test/extraction-fixtures";
import { commitBatch } from "./commit-batch";

/** Store a batch whose photos have been read, exactly as the runner leaves it. */
async function storeReadBatch(batchId: string, number: number, items: [string, PhotoExtraction][]) {
  const db = getDB();
  const batch: Batch = { id: batchId, number, createdAt: "2026-10-30T09:00:00Z", status: "extracted", photoIds: items.map(([id]) => id), skippedDuplicateCount: 0 };
  await db.batches.add(batch);
  for (const [i, [id, ex]] of items.entries()) {
    await db.photos.add(photo(id, { batchId, sha256: `${batchId}-${id}`, takenAt: `2026-10-30T09:0${i}:00Z` }));
    await db.extractions.add({ photoId: id, batchId, extraction: ex });
  }
}

const byName = async (name: string) => (await getDB().companies.toArray()).find((c) => c.name.value === name)!;

describe("upload → group → review → correct → second batch (IndexedDB)", () => {
  beforeEach(async () => {
    resetDBForTests();
    await getDB().delete();
    resetDBForTests();
  });

  it("runs the whole journey without losing data, edits or saved companies", async () => {
    const db = getDB();
    // Batch 1: two Lumen Pay photos, one Kanok photo, one photo with no company name.
    await storeReadBatch("b1", 1, [
      ["p1", extraction({ companies: [exCompany("Lumen Pay", { domains: ["lumenpay.co.th"] })], opportunities: [exOpp("Backend Intern", { status: "open", deadline: { value: "2026-11-02", raw: "2 Nov 2026", status: "auto" } })], links: [exLink("https://forms.gle/lp", "forms.gle/lp", { purpose: "application_form", appliesToTitles: ["Backend Intern"] }), exLink("https://bit.ly/lp", "bit.ly/lp", { purpose: "unknown", verification: "not_fetched" })] })],
      ["p2", extraction({ companies: [exCompany("Lumen Pay Co., Ltd.")], opportunities: [exOpp("QA Intern")] })],
      ["p3", extraction({ companies: [exCompany("Kanok Digital", { domains: ["kanokdigital.co.th"] })], opportunities: [exOpp("Frontend Intern", { deadline: { value: "2026-11-12", raw: "12 Nov", status: "auto" } })] })],
      ["p4", extraction({ opportunities: [exOpp("Electrical Engineer", { deadline: { value: "2026-12-15", raw: "15 Dec 2569", status: "auto" } })] })],
    ]);

    const r1 = await commitBatch("b1");
    expect(r1).toMatchObject({ newCompanies: 2, reviewItems: 1 });
    expect((await db.batches.get("b1"))!.status).toBe("needs_review");
    // Idempotent: committing again changes nothing.
    expect(await commitBatch("b1")).toMatchObject({ newCompanies: 0, reviewItems: 0 });
    expect(await db.companies.count()).toBe(2);
    expect(await db.opportunities.count()).toBe(3);

    // Review: assign the nameless photo (suggested by time: the photo just before it).
    const assign = (await db.reviewItems.toArray()).find((r) => r.kind === "photo_without_company")!;
    const kanok = await byName("Kanok Digital");
    expect(await suggestCompanyForPhoto("p4")).toBe(kanok.id);
    await assignPhoto(assign.id, { companyId: kanok.id });
    expect((await db.opportunities.toArray()).find((o) => o.title.value === "Electrical Engineer")!.companyId).toBe(kanok.id);
    expect((await db.batches.get("b1"))!.status).toBe("done");

    // User saves companies and corrects data.
    const lumen = await byName("Lumen Pay");
    await saveCompanies([lumen.id, kanok.id]);
    await renameCompany(lumen.id, "Lumen Pay Thailand");
    const backend = (await db.opportunities.toArray()).find((o) => o.title.value === "Backend Intern")!;
    await updateOpportunity(backend.id, { deadline: "2026-11-05" });
    const shortLink = (await db.links.toArray()).find((l) => l.normalizedUrl === "bit.ly/lp")!;
    await removeLink(shortLink.id);

    // Batch 2: same company again (printed name), a different deadline, the removed link, and a look-alike company.
    await storeReadBatch("b2", 2, [
      ["q1", extraction({ companies: [exCompany("Lumen Pay")], opportunities: [exOpp("Backend Intern", { deadline: { value: "2026-11-20", raw: "20 Nov", status: "auto" } }), exOpp("Data Intern")], links: [exLink("https://bit.ly/lp", "bit.ly/lp", { purpose: "unknown" })] })],
      ["q2", extraction({ companies: [exCompany("KNK Digital Academy", { domains: ["knk.ac.th"] })], opportunities: [exOpp("Tech Bootcamp")] })],
      ["q3", extraction({ companies: [exCompany("Kanok Digital")], opportunities: [exOpp("Frontend Intern", { deadline: { value: "2026-11-14", raw: "14 Nov", status: "auto" } })] })],
    ]);
    const r2 = await commitBatch("b2");
    expect(r2.newCompanies).toBe(1); // only KNK Digital Academy is new (and needs review)

    const lib = await loadLibrary();
    const lumenAfter = lib.companies.find((c) => c.id === lumen.id)!;
    expect(lumenAfter.name).toMatchObject({ value: "Lumen Pay Thailand", status: "edited" });
    expect(lumenAfter.photoIds).toEqual(["p1", "p2", "q1"]);
    const backendAfter = lib.opportunities.find((o) => o.id === backend.id)!;
    expect(backendAfter.deadline).toMatchObject({ value: "2026-11-05", status: "edited" }); // the user's correction wins
    expect(lib.links.some((l) => l.normalizedUrl === "bit.ly/lp")).toBe(false); // removed link stays removed
    expect(lib.opportunities.filter((o) => o.companyId === lumen.id).map((o) => o.title.value).sort()).toEqual(["Backend Intern", "Data Intern", "QA Intern"]);
    expect(lib.interestedIds).toEqual(new Set([lumen.id, kanok.id]));

    const items = (await db.reviewItems.where("batchId").equals("b2").toArray()).filter((r) => r.state === "open");
    expect(items.map((r) => r.kind).sort()).toEqual(["deadline_conflict", "uncertain_company_match"]);

    // Review batch 2: KNK is the same as Kanok (user decides), and pick the correct Frontend deadline.
    const match = items.find((r) => r.kind === "uncertain_company_match")!;
    const knkId = (match.payload as { newCompanyId: string }).newCompanyId;
    await saveCompanies([knkId]);
    await resolveCompanyMatch(match.id, "merge");
    const conflict = items.find((r) => r.kind === "deadline_conflict")!;
    await resolveDeadline(conflict.id, "2026-11-14");

    const final = await loadLibrary();
    expect(final.companies.map((c) => c.name.value).sort()).toEqual(["Kanok Digital", "Lumen Pay Thailand"]);
    const kanokFinal = final.companies.find((c) => c.id === kanok.id)!;
    expect(kanokFinal.aliases).toContain("KNK Digital Academy");
    expect(final.opportunities.filter((o) => o.companyId === kanok.id).map((o) => o.title.value).sort()).toEqual(["Electrical Engineer", "Frontend Intern", "Tech Bootcamp"]);
    expect(final.opportunities.find((o) => o.title.value === "Frontend Intern")!.deadline).toMatchObject({ value: "2026-11-14", status: "edited" });
    expect(final.interestedIds).toEqual(new Set([lumen.id, kanok.id])); // the saved merged company carried over
    expect((await db.batches.get("b2"))!.status).toBe("done");
    expect(await db.photos.count()).toBe(7); // no photo was lost
  });

  it("clearing a wrong date keeps it cleared after another batch", async () => {
    const db = getDB();
    await storeReadBatch("b1", 1, [["p1", extraction({ companies: [exCompany("Orbit Games")], opportunities: [exOpp("Game Designer", { deadline: { value: "2026-11-01", raw: "1/11", status: "uncertain" } })] })]]);
    await commitBatch("b1");
    const opp = (await db.opportunities.toArray())[0];
    await updateOpportunity(opp.id, { deadline: null });
    await storeReadBatch("b2", 2, [["p2", extraction({ companies: [exCompany("Orbit Games")], opportunities: [exOpp("Game Designer", { deadline: { value: "2026-11-01", raw: "1/11", status: "uncertain" } })] })]]);
    await commitBatch("b2");
    const after = await db.opportunities.get(opp.id);
    expect(after!.deadline).toMatchObject({ value: "", status: "edited" });
    expect(after!.status).toBe("not_specified");
  });
});
