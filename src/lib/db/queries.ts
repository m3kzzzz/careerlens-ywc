import { getDB } from "./index";

/** sha256 → company name (null when saved but not yet assigned to a company). */
export async function getSavedPhotoHashes(): Promise<Map<string, string | null>> {
  const db = getDB();
  const [photos, companies] = await Promise.all([db.photos.toArray(), db.companies.toArray()]);
  const names = new Map(companies.map((c) => [c.id, c.name.value]));
  return new Map(photos.map((p) => [p.sha256, p.companyId ? (names.get(p.companyId) ?? null) : null]));
}

export interface LibrarySummary {
  /** Batches that finished reading (at least partly). */
  batchCount: number;
  nextBatchNumber: number;
  photoCount: number;
  companyCount: number;
  opportunityCount: number;
}

export async function getLibrarySummary(): Promise<LibrarySummary> {
  const db = getDB();
  const [batchCount, last, photoCount, companyCount, opportunityCount] = await Promise.all([
    db.batches.where("status").anyOf("extracted", "needs_review", "done").count(),
    db.batches.orderBy("number").last(),
    db.photos.count(),
    db.companies.count(),
    db.opportunities.count(),
  ]);
  return { batchCount, nextBatchNumber: (last?.number ?? 0) + 1, photoCount, companyCount, opportunityCount };
}
