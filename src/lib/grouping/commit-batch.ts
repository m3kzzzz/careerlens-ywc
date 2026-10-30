import { getDB } from "@/lib/db";
import { normalizeTitle } from "./match";
import { type Existing, planCommit, type PhotoToCommit } from "./plan-commit";

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Things the user removed, recorded in userEdits so later batches don't bring them back. */
async function loadExisting(): Promise<Existing> {
  const db = getDB();
  const [companies, opportunities, links, events, contacts, edits] = await Promise.all([
    db.companies.toArray(),
    db.opportunities.toArray(),
    db.links.toArray(),
    db.events.toArray(),
    db.contacts.toArray(),
    db.userEdits.toArray(),
  ]);
  const dismissedUrls = new Set<string>();
  const dismissedPositions = new Set<string>();
  for (const e of edits) {
    if (e.field !== "removed") continue;
    if (e.entity === "link" && typeof e.previous === "object" && e.previous) dismissedUrls.add((e.previous as { normalizedUrl: string }).normalizedUrl);
    if (e.entity === "opportunity" && typeof e.previous === "object" && e.previous) {
      const p = e.previous as { companyId: string; title: string };
      dismissedPositions.add(`${p.companyId}|${normalizeTitle(p.title)}`);
    }
  }
  return { companies, opportunities, links, events, contacts, dismissedUrls, dismissedPositions };
}

export interface CommitResult {
  newCompanies: number;
  updatedCompanies: number;
  reviewItems: number;
}

/**
 * Merge a batch's read-but-not-yet-merged photos into company data, in one
 * transaction. Safe to call repeatedly: committed photos are skipped.
 * With `forced`, merges specific photos into a chosen company (Review → assign).
 */
export async function commitBatch(batchId: string, forced?: { photoIds: string[]; companyId: string }): Promise<CommitResult> {
  const db = getDB();
  return db.transaction(
    "rw",
    [db.batches, db.photos, db.extractions, db.companies, db.opportunities, db.links, db.events, db.contacts, db.reviewItems, db.userEdits],
    async () => {
      const batch = await db.batches.get(batchId);
      if (!batch) return { newCompanies: 0, updatedCompanies: 0, reviewItems: 0 };

      const photos = forced
        ? (await db.photos.bulkGet(forced.photoIds)).filter((p) => !!p)
        : (await db.photos.where("batchId").equals(batchId).toArray()).filter((p) => p.status === "done" && !p.committed);
      const records = await db.extractions.bulkGet(photos.map((p) => p!.id));
      const order = new Map(batch.photoIds.map((id, i) => [id, i]));
      const toCommit: PhotoToCommit[] = photos
        .flatMap((p, i): PhotoToCommit[] => {
          const extraction = records[i]?.extraction;
          return p && extraction ? [{ photo: p, extraction, forcedCompanyId: forced?.companyId }] : [];
        })
        .sort((a, b) => (order.get(a.photo.id) ?? 0) - (order.get(b.photo.id) ?? 0));

      if (toCommit.length) {
        const plan = planCommit({ batchId, photos: toCommit, existing: await loadExisting(), now: new Date(), newId });
        await db.companies.bulkPut(plan.companies);
        await db.opportunities.bulkPut(plan.opportunities);
        await db.links.bulkPut(plan.links);
        await db.events.bulkPut(plan.events);
        await db.contacts.bulkPut(plan.contacts);
        await db.reviewItems.bulkAdd(plan.reviewItems);
        for (const { photo } of toCommit) {
          await db.photos.update(photo.id, { committed: true, companyId: plan.photoCompany.get(photo.id) ?? null });
        }
        await refreshBatchStatus(batchId);
        return { ...plan.stats, reviewItems: plan.reviewItems.length };
      }
      await refreshBatchStatus(batchId);
      return { newCompanies: 0, updatedCompanies: 0, reviewItems: 0 };
    },
  );
}

/** needs_review while any review item is open, else done. Leaves unfinished batches alone. */
export async function refreshBatchStatus(batchId: string) {
  const db = getDB();
  const batch = await db.batches.get(batchId);
  if (!batch || batch.status === "processing" || batch.status === "failed") return;
  const photos = await db.photos.where("batchId").equals(batchId).toArray();
  if (photos.some((p) => p.status === "done" && !p.committed)) return; // still to merge
  const open = await db.reviewItems.where("batchId").equals(batchId).filter((r) => r.state === "open").count();
  await db.batches.update(batchId, { status: open > 0 ? "needs_review" : "done" });
}
