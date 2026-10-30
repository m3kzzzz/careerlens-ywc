import { getDB } from "./index";

/**
 * Company-level "Interested" selections. Only the interests table is ever
 * written here; companies, opportunities, photos and evidence are never
 * modified or deleted.
 */

export async function saveCompanies(companyIds: string[]): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();
  await db.transaction("rw", db.interests, db.companies, async () => {
    // Only real, stored companies can be saved.
    const existing = (await db.companies.bulkGet(companyIds)).filter(Boolean).map((c) => c!.id);
    const already = new Set((await db.interests.bulkGet(existing)).filter(Boolean).map((i) => i!.companyId));
    await db.interests.bulkPut(existing.filter((id) => !already.has(id)).map((companyId) => ({ companyId, savedAt: now })));
  });
}

export async function removeInterests(companyIds: string[]): Promise<void> {
  await getDB().interests.bulkDelete(companyIds);
}

export async function setInterested(companyId: string, interested: boolean): Promise<void> {
  if (interested) await saveCompanies([companyId]);
  else await removeInterests([companyId]);
}

export async function getInterestedIds(): Promise<Set<string>> {
  const rows = await getDB().interests.toArray();
  return new Set(rows.map((r) => r.companyId));
}
