import type { Company, ISODate, Opportunity, ReviewItem } from "@/domain/types";
import { getDB } from "@/lib/db";
import { deriveStatus } from "@/lib/extraction/postprocess";
import { commitBatch, refreshBatchStatus } from "@/lib/grouping/commit-batch";
import { normalizeTitle } from "@/lib/grouping/match";
import { fieldValue } from "@/lib/grouping/plan-commit";

/**
 * Review decisions. Each one changes only what the user decided, records it
 * in userEdits, and closes the review item. Photos and evidence are kept.
 */

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const nowIso = () => new Date().toISOString();

export function todayIso(d = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function close(item: ReviewItem, state: "resolved" | "skipped" = "resolved") {
  const db = getDB();
  await db.reviewItems.update(item.id, { state });
  await refreshBatchStatus(item.batchId);
}

async function getOpen(itemId: string) {
  const item = await getDB().reviewItems.get(itemId);
  if (!item || item.state !== "open") throw new Error("This item was already handled.");
  return item;
}

export async function skipItem(itemId: string) {
  await close(await getOpen(itemId), "skipped");
}

/** Move everything from `sourceId` into `targetId`, then delete the empty source company. */
export async function mergeCompanies(sourceId: string, targetId: string) {
  const db = getDB();
  await db.transaction(
    "rw",
    [db.companies, db.opportunities, db.links, db.events, db.contacts, db.photos, db.interests, db.reviewItems, db.userEdits],
    async () => {
      const [source, target] = await Promise.all([db.companies.get(sourceId), db.companies.get(targetId)]);
      if (!source || !target || sourceId === targetId) return;

      // Positions: same title → fold into the target's position.
      const targetOpps = await db.opportunities.where("companyId").equals(targetId).toArray();
      const sourceOpps = await db.opportunities.where("companyId").equals(sourceId).toArray();
      const remap = new Map<string, string>();
      for (const o of sourceOpps) {
        const dup = targetOpps.find((t) => normalizeTitle(t.title.value) === normalizeTitle(o.title.value));
        if (dup) {
          const merged: Opportunity = {
            ...dup,
            deadline: dup.deadline ?? o.deadline,
            opensAt: dup.opensAt ?? o.opensAt,
            requirements: [...dup.requirements, ...o.requirements.filter((r) => !dup.requirements.some((x) => x.value === r.value))],
            skills: [...dup.skills, ...o.skills.filter((r) => !dup.skills.some((x) => x.value === r.value))],
            sources: [...dup.sources, ...o.sources],
          };
          await db.opportunities.put(merged);
          await db.opportunities.delete(o.id);
          remap.set(o.id, dup.id);
        } else {
          await db.opportunities.update(o.id, { companyId: targetId });
        }
      }
      for (const l of await db.links.where("companyId").equals(sourceId).toArray()) {
        await db.links.update(l.id, { companyId: targetId, opportunityIds: [...new Set(l.opportunityIds.map((id) => remap.get(id) ?? id))] });
      }
      await db.events.where("companyId").equals(sourceId).modify({ companyId: targetId });
      await db.contacts.where("companyId").equals(sourceId).modify({ companyId: targetId });
      await db.photos.where("companyId").equals(sourceId).modify({ companyId: targetId });

      const updated: Company = {
        ...target,
        aliases: [...new Set([...target.aliases, source.name.value, ...source.aliases])].filter((a) => a !== target.name.value),
        domains: [...new Set([...target.domains, ...source.domains])],
        photoIds: [...new Set([...target.photoIds, ...source.photoIds])],
        locations: [...target.locations, ...source.locations.filter((l) => !target.locations.some((x) => x.value === l.value))],
        description: target.description ?? source.description,
        industry: target.industry ?? source.industry,
        updatedAt: nowIso(),
      };
      await db.companies.put(updated);

      if (await db.interests.get(sourceId)) {
        if (!(await db.interests.get(targetId))) await db.interests.put({ companyId: targetId, savedAt: nowIso() });
        await db.interests.delete(sourceId);
      }
      await db.companies.delete(sourceId);
      // Other open questions about the removed company no longer apply.
      await db.reviewItems
        .filter((r) => r.state === "open" && r.kind === "uncertain_company_match" && (r.payload.newCompanyId === sourceId || r.payload.candidateId === sourceId))
        .modify({ state: "resolved" });
      await db.userEdits.add({ id: newId(), entity: "company", entityId: targetId, field: "merged", previous: { id: source.id, name: source.name.value }, next: targetId, editedAt: nowIso() });
    },
  );
}

/** "Same, merge" or "Different" for an uncertain company match. */
export async function resolveCompanyMatch(itemId: string, decision: "merge" | "separate") {
  const item = await getOpen(itemId);
  const { newCompanyId, candidateId } = item.payload as { newCompanyId: string; candidateId: string };
  if (decision === "merge") await mergeCompanies(newCompanyId, candidateId);
  else
    await getDB().userEdits.add({
      id: newId(),
      entity: "company",
      entityId: newCompanyId,
      field: "notSameAs",
      previous: null,
      next: candidateId,
      editedAt: nowIso(),
    });
  const fresh = await getDB().reviewItems.get(itemId);
  if (fresh?.state === "open") await close(item);
  else await refreshBatchStatus(item.batchId);
}

/** Pick the correct deadline when sources disagree (or keep it marked uncertain). */
export async function resolveDeadline(itemId: string, choice: ISODate | "later") {
  const item = await getOpen(itemId);
  if (choice === "later") return close(item, "skipped");
  const db = getDB();
  const { opportunityId } = item.payload as { opportunityId: string };
  const opp = await db.opportunities.get(opportunityId);
  if (opp) {
    const deadline = { value: choice, status: "edited" as const, sources: [{ kind: "user" as const, editedAt: nowIso() }] };
    await db.opportunities.update(opportunityId, {
      deadline,
      status: deriveStatus({ claim: opp.status === "upcoming" ? "upcoming" : "none", deadline: choice, opensAt: fieldValue(opp.opensAt), today: todayIso() }),
    });
    await db.userEdits.add({ id: newId(), entity: "opportunity", entityId: opportunityId, field: "deadline", previous: opp.deadline?.value, next: choice, editedAt: nowIso() });
  }
  await close(item);
}

/** Tie an application form to the positions it is for, or keep it company-wide. */
export async function resolveApplicationLink(itemId: string, opportunityIds: string[]) {
  const item = await getOpen(itemId);
  const db = getDB();
  const { linkId } = item.payload as { linkId: string };
  const link = await db.links.get(linkId);
  if (link) {
    await db.links.update(linkId, { opportunityIds });
    await db.userEdits.add({ id: newId(), entity: "link", entityId: linkId, field: "opportunityIds", previous: link.opportunityIds, next: opportunityIds, editedAt: nowIso() });
  }
  await close(item);
}

/** Assign a photo with no company name to an existing company, or to a new one the user names. */
export async function assignPhoto(itemId: string, target: { companyId: string } | { newCompanyName: string }) {
  const item = await getOpen(itemId);
  const db = getDB();
  const { photoId } = item.payload as { photoId: string };
  let companyId: string;
  if ("companyId" in target) {
    companyId = target.companyId;
  } else {
    const name = target.newCompanyName.trim();
    if (!name) throw new Error("Enter a company name.");
    companyId = newId();
    const now = nowIso();
    await db.companies.add({
      id: companyId,
      name: { value: name, status: "edited", sources: [{ kind: "user", editedAt: now }] },
      aliases: [],
      domains: [],
      description: undefined,
      industry: undefined,
      locations: [],
      perks: [],
      photoIds: [],
      createdInBatchId: item.batchId,
      updatedInBatchId: item.batchId,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.reviewItems.update(item.id, { state: "resolved" });
  await commitBatch(item.batchId, { photoIds: [photoId], companyId });
  await db.userEdits.add({ id: newId(), entity: "photo", entityId: photoId, field: "companyId", previous: null, next: companyId, editedAt: nowIso() });
  await refreshBatchStatus(item.batchId);
}

/** Suggest the company of the photo taken closest in time (within 10 minutes) in the same batch. */
export async function suggestCompanyForPhoto(photoId: string): Promise<string | null> {
  const db = getDB();
  const photo = await db.photos.get(photoId);
  if (!photo) return null;
  const at = Date.parse(photo.takenAt ?? photo.addedAt);
  const others = (await db.photos.where("batchId").equals(photo.batchId).toArray()).filter((p) => p.id !== photoId && p.companyId);
  let best: { id: string; diff: number } | null = null;
  for (const p of others) {
    const diff = Math.abs(Date.parse(p.takenAt ?? p.addedAt) - at);
    if (diff <= 10 * 60 * 1000 && (!best || diff < best.diff)) best = { id: p.companyId!, diff };
  }
  return best?.id ?? null;
}
