import type { Field, ISODate } from "@/domain/types";
import { getDB } from "@/lib/db";
import { deriveStatus } from "@/lib/extraction/postprocess";
import { fieldValue } from "@/lib/grouping/plan-commit";
import { classifyTarget } from "@/lib/links/classify";
import { parseTarget } from "@/lib/links/normalize";
import { todayIso } from "./actions";

/**
 * User corrections. Edited values get status "edited", which later batches
 * never overwrite; removals are remembered so later batches don't re-add them.
 */

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const nowIso = () => new Date().toISOString();
const edited = <T,>(value: T): Field<T> => ({ value, status: "edited", sources: [{ kind: "user", editedAt: nowIso() }] });

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function validIso(v: string) {
  if (!ISO_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function renameCompany(companyId: string, name: string) {
  const value = name.trim();
  if (!value) throw new Error("Company name can't be empty.");
  const db = getDB();
  const c = await db.companies.get(companyId);
  if (!c || c.name.value === value) return;
  // Keep the printed name as an alias so future brochures still match this company.
  const aliases = [...new Set([...c.aliases, c.name.value])].filter((a) => a !== value);
  await db.companies.update(companyId, { name: edited(value), aliases, updatedAt: nowIso() });
  await db.userEdits.add({ id: newId(), entity: "company", entityId: companyId, field: "name", previous: c.name.value, next: value, editedAt: nowIso() });
}

export interface OpportunityPatch {
  title?: string;
  /** ISO date, or null to clear a wrong date. */
  deadline?: ISODate | null;
  opensAt?: ISODate | null;
}

export async function updateOpportunity(oppId: string, patch: OpportunityPatch) {
  const db = getDB();
  const o = await db.opportunities.get(oppId);
  if (!o) return;
  const changes: Partial<typeof o> = {};
  const log: [string, unknown, unknown][] = [];

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("Position title can't be empty.");
    if (t !== o.title.value) {
      changes.title = edited(t);
      log.push(["title", o.title.value, t]);
    }
  }
  for (const key of ["deadline", "opensAt"] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v !== null && !validIso(v)) throw new Error("Enter a valid date.");
    const before = fieldValue(o[key]);
    if ((v ?? undefined) === before && o[key]?.status === "edited") continue;
    // An edited empty value means "the user removed this date"; later batches won't fill it.
    changes[key] = edited(v ?? "");
    log.push([key, before ?? null, v]);
  }
  if (!log.length) return;

  const deadline = fieldValue(changes.deadline ?? o.deadline);
  const opensAt = fieldValue(changes.opensAt ?? o.opensAt);
  changes.status = deriveStatus({
    claim: o.status === "upcoming" ? "upcoming" : o.status === "open" && !fieldValue(o.deadline) ? "open" : "none",
    deadline,
    opensAt,
    today: todayIso(),
  });
  await db.opportunities.update(oppId, changes);
  for (const [field, previous, next] of log) {
    await db.userEdits.add({ id: newId(), entity: "opportunity", entityId: oppId, field, previous, next, editedAt: nowIso() });
  }
}

export async function removeOpportunity(oppId: string) {
  const db = getDB();
  await db.transaction("rw", db.opportunities, db.links, db.userEdits, async () => {
    const o = await db.opportunities.get(oppId);
    if (!o) return;
    for (const l of await db.links.where("companyId").equals(o.companyId).toArray()) {
      if (l.opportunityIds.includes(oppId)) await db.links.update(l.id, { opportunityIds: l.opportunityIds.filter((x) => x !== oppId) });
    }
    await db.opportunities.delete(oppId);
    await db.userEdits.add({ id: newId(), entity: "opportunity", entityId: oppId, field: "removed", previous: { companyId: o.companyId, title: o.title.value }, next: null, editedAt: nowIso() });
  });
}

export async function updateLinkUrl(linkId: string, url: string) {
  const db = getDB();
  const target = parseTarget(url);
  if (target.kind === "text") throw new Error("Enter a web address, email or phone number.");
  await db.transaction("rw", db.links, db.userEdits, async () => {
    const l = await db.links.get(linkId);
    if (!l || l.normalizedUrl === target.normalized) return;
    const clash = await db.links.where("normalizedUrl").equals(target.normalized).first();
    if (clash) throw new Error("That link is already saved.");
    const rule = classifyTarget(target);
    await db.links.update(linkId, {
      rawUrl: target.kind === "web" ? target.url : target.normalized,
      normalizedUrl: target.normalized,
      // Re-classify from the new address; a corrected link is still unverified.
      purpose: rule.certain || l.purpose === "unknown" ? rule.purpose : l.purpose,
      verification: rule.opaque || rule.purpose === "social_contact" ? "not_fetched" : "from_photo",
    });
    await db.userEdits.add({ id: newId(), entity: "link", entityId: linkId, field: "url", previous: l.rawUrl, next: url, editedAt: nowIso() });
    // The old address shouldn't come back from a later batch.
    await db.userEdits.add({ id: newId(), entity: "link", entityId: linkId, field: "removed", previous: { normalizedUrl: l.normalizedUrl }, next: null, editedAt: nowIso() });
  });
}

export async function removeLink(linkId: string) {
  const db = getDB();
  await db.transaction("rw", db.links, db.events, db.userEdits, async () => {
    const l = await db.links.get(linkId);
    if (!l) return;
    await db.events.filter((e) => e.registrationLinkId === linkId).modify({ registrationLinkId: undefined });
    await db.links.delete(linkId);
    await db.userEdits.add({ id: newId(), entity: "link", entityId: linkId, field: "removed", previous: { normalizedUrl: l.normalizedUrl }, next: null, editedAt: nowIso() });
  });
}
