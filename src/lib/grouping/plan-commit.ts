import type {
  Company,
  Contact,
  Field,
  ISODate,
  Link,
  Opportunity,
  Photo,
  RecruitmentEvent,
  RecruitmentStatus,
  ReviewItem,
  SourceRef,
} from "@/domain/types";
import { deriveStatus } from "@/lib/extraction/postprocess";
import type { ExtractedDate, ExtractedValue, PhotoExtraction } from "@/lib/extraction/types";
import { matchCompany, normalizeCompanyName, normalizeTitle } from "./match";

/**
 * Turns read photos into companies, positions, links, events and contacts,
 * merged with what is already stored. Pure: it returns the rows to write, so
 * it can be unit-tested and applied in one IndexedDB transaction.
 *
 * Rules:
 *  - only strong evidence merges companies; similar names create a separate
 *    company plus an "uncertain_company_match" review item;
 *  - a photo without a company becomes a "photo_without_company" review item;
 *  - fields the user edited are never changed; empty fields are filled;
 *    disagreeing deadlines become a "deadline_conflict" review item;
 *  - things the user removed (links, positions) are not re-added.
 */

export interface Existing {
  companies: Company[];
  opportunities: Opportunity[];
  links: Link[];
  events: RecruitmentEvent[];
  contacts: Contact[];
  /** Normalized URLs the user removed. */
  dismissedUrls: Set<string>;
  /** `${companyId}|${normalizedTitle}` of positions the user removed. */
  dismissedPositions: Set<string>;
}

export interface PhotoToCommit {
  photo: Photo;
  extraction: PhotoExtraction;
  /** Set when the user assigned this photo to a company in Review. */
  forcedCompanyId?: string;
}

export interface CommitPlan {
  companies: Company[];
  opportunities: Opportunity[];
  links: Link[];
  events: RecruitmentEvent[];
  contacts: Contact[];
  /** photoId → companyId (null = waiting for assignment in Review). */
  photoCompany: Map<string, string | null>;
  reviewItems: ReviewItem[];
  stats: { newCompanies: number; updatedCompanies: number; opportunities: number; links: number };
}

/** Everything the planner records comes from a photo. */
type PhotoSource = Extract<SourceRef, { kind: "photo" }>;

const ORDER: Record<RecruitmentStatus, number> = { not_specified: 0, upcoming: 1, open: 2, closed: 3 };
const CLAIM: Record<RecruitmentStatus, "open" | "upcoming" | "closed" | "none"> = {
  open: "open",
  upcoming: "upcoming",
  closed: "closed",
  not_specified: "none",
};

function todayIso(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A value counts only if non-empty; an edited empty value means "user cleared it". */
export function fieldValue<T>(f: Field<T> | undefined): T | undefined {
  if (!f) return undefined;
  const v = f.value as unknown;
  return v === "" || v === null ? undefined : f.value;
}

function toField<T>(v: ExtractedValue<T>, src: PhotoSource): Field<T> {
  return { value: v.value, status: v.status, sources: [src], note: v.note };
}

function plain<T>(value: T, src: PhotoSource): Field<T> {
  return { value, status: "auto", sources: [src] };
}

function addSource<T>(f: Field<T>, src: SourceRef): Field<T> {
  const has = f.sources.some((s) => s.kind === "photo" && src.kind === "photo" && s.photoId === src.photoId);
  return has ? f : { ...f, sources: [...f.sources, src] };
}

/** Merge a newly read value into a stored one. */
function mergeField<T>(
  current: Field<T> | undefined,
  incoming: Field<T> | undefined,
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): { field: Field<T> | undefined; conflict?: { current: Field<T>; incoming: Field<T> } } {
  if (!incoming) return { field: current };
  if (!current) return { field: incoming };
  if (current.status === "edited") return { field: current }; // never overwrite the user
  if (same(current.value, incoming.value)) {
    const merged = addSource(current, incoming.sources[0]);
    if (merged.sources.length < 2) return { field: merged };
    // Two photos agreeing confirm the value, unless both readings were unsure.
    const bothUnsure = current.status === "uncertain" && incoming.status === "uncertain";
    return { field: bothUnsure ? merged : { ...merged, status: "confirmed", note: undefined } };
  }
  return { field: current, conflict: { current, incoming } };
}

function mergeList(current: Field<string>[], incoming: string[], src: PhotoSource): Field<string>[] {
  const out = [...current];
  for (const v of incoming) {
    const i = out.findIndex((f) => f.value.toLowerCase() === v.toLowerCase());
    if (i >= 0) out[i] = addSource(out[i], src);
    else out.push(plain(v, src));
  }
  return out;
}

function dateField(d: ExtractedDate | undefined, src: PhotoSource): Field<ISODate> | undefined {
  if (!d) return undefined;
  return { value: d.value, status: d.status, sources: [{ ...src, quote: d.raw }], note: d.note };
}

export function planCommit(input: {
  batchId: string;
  photos: PhotoToCommit[];
  existing: Existing;
  now: Date;
  newId: () => string;
}): CommitPlan {
  const { batchId, existing, now, newId } = input;
  const nowIso = now.toISOString();
  const today = todayIso(now);

  // Working copies keyed by id; only touched rows are returned.
  const companies = new Map(existing.companies.map((c) => [c.id, structuredClone(c)]));
  const opps = new Map(existing.opportunities.map((o) => [o.id, structuredClone(o)]));
  const links = new Map(existing.links.map((l) => [l.id, structuredClone(l)]));
  const events = new Map(existing.events.map((e) => [e.id, structuredClone(e)]));
  const contacts = new Map(existing.contacts.map((c) => [c.id, structuredClone(c)]));
  const touched = { companies: new Set<string>(), opps: new Set<string>(), links: new Set<string>(), events: new Set<string>(), contacts: new Set<string>() };
  const createdCompanies = new Set<string>();
  const photoCompany = new Map<string, string | null>();
  const reviewItems: ReviewItem[] = [];
  const linksTouchedThisBatch = new Set<string>();
  /** Within this batch, the same normalized name always maps to the same company. */
  const batchCompanyByKey = new Map<string, string>();

  const review = (kind: ReviewItem["kind"], payload: Record<string, unknown>) =>
    reviewItems.push({ id: newId(), batchId, kind, state: "open", createdAt: nowIso, payload });

  const resolveCompany = (ex: PhotoExtraction["companies"][number], src: PhotoSource): string => {
    const key = normalizeCompanyName(ex.name.value);
    const known = batchCompanyByKey.get(key) ?? ex.aliases.map((a) => batchCompanyByKey.get(normalizeCompanyName(a))).find(Boolean);
    let id = known;
    if (!id) {
      const result = matchCompany(
        { name: ex.name.value, aliases: ex.aliases, domains: ex.domains },
        [...companies.values()].map((c) => ({ id: c.id, name: c.name.value, aliases: c.aliases, domains: c.domains })),
      );
      if (result.kind === "match") {
        id = result.companyId;
      } else {
        id = newId();
        companies.set(id, {
          id,
          name: toField(ex.name, src),
          aliases: [],
          domains: [],
          description: undefined,
          industry: undefined,
          locations: [],
          perks: [],
          photoIds: [],
          createdInBatchId: batchId,
          updatedInBatchId: batchId,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        createdCompanies.add(id);
        if (result.kind === "ambiguous") {
          const other = companies.get(result.companyId)!;
          review("uncertain_company_match", {
            newCompanyId: id,
            candidateId: result.companyId,
            newName: ex.name.value,
            candidateName: other.name.value,
            newDomains: ex.domains,
            candidateDomains: other.domains,
            similarity: result.similarity,
            reasons: result.reasons,
            photoIds: [src.kind === "photo" ? src.photoId : ""],
          });
        }
      }
      batchCompanyByKey.set(key, id);
    }
    applyCompanyFacts(id, ex, src);
    return id;
  };

  const applyCompanyFacts = (id: string, ex: PhotoExtraction["companies"][number], src: PhotoSource) => {
    const c = companies.get(id)!;
    const name = mergeField(c.name, toField(ex.name, src), (a, b) => normalizeCompanyName(a) === normalizeCompanyName(b)).field!;
    const aliases = new Set(c.aliases);
    for (const a of [ex.name.value, ...ex.aliases]) if (normalizeCompanyName(a) !== normalizeCompanyName(name.value)) aliases.add(a);
    c.name = name;
    c.aliases = [...aliases];
    c.domains = [...new Set([...c.domains, ...ex.domains])];
    if (ex.description) c.description = mergeField(c.description, plain(ex.description, src)).field;
    if (ex.industry) c.industry = mergeField(c.industry, plain(ex.industry, src)).field;
    c.locations = mergeList(c.locations, ex.locations, src);
    c.perks = mergeList(c.perks, ex.perks, src);
    if (src.kind === "photo" && !c.photoIds.includes(src.photoId)) c.photoIds.push(src.photoId);
    c.updatedInBatchId = batchId;
    c.updatedAt = nowIso;
    touched.companies.add(id);
  };

  const ownerOf = (companyName: string | null, photoCompanyIds: string[]): string => {
    if (companyName) {
      const key = normalizeCompanyName(companyName);
      const hit = photoCompanyIds.find((id) => {
        const c = companies.get(id)!;
        return [c.name.value, ...c.aliases].some((n) => normalizeCompanyName(n) === key);
      });
      if (hit) return hit;
    }
    return photoCompanyIds[0];
  };

  for (const { photo, extraction: ex, forcedCompanyId } of input.photos) {
    const src: PhotoSource = { kind: "photo", photoId: photo.id };

    let photoCompanyIds: string[];
    if (forcedCompanyId && companies.has(forcedCompanyId)) {
      photoCompanyIds = [forcedCompanyId];
      // Keep any names printed on the photo as facts of the chosen company.
      for (const ec of ex.companies) applyCompanyFacts(forcedCompanyId, ec, src);
      const c = companies.get(forcedCompanyId)!;
      if (!c.photoIds.includes(photo.id)) c.photoIds.push(photo.id);
      touched.companies.add(forcedCompanyId);
    } else if (ex.companies.length === 0) {
      photoCompany.set(photo.id, null);
      if (ex.isRecruitmentMaterial && (ex.opportunities.length || ex.links.length || ex.events.length || ex.contacts.length)) {
        review("photo_without_company", { photoId: photo.id, takenAt: photo.takenAt ?? photo.addedAt });
      }
      continue;
    } else {
      photoCompanyIds = ex.companies.map((ec) => resolveCompany(ec, src));
    }
    photoCompany.set(photo.id, photoCompanyIds[0]);

    // Positions
    const oppIdByTitle = new Map<string, string>();
    for (const o of ex.opportunities) {
      const companyId = forcedCompanyId ?? ownerOf(o.companyName, photoCompanyIds);
      const titleKey = normalizeTitle(o.title.value);
      if (existing.dismissedPositions.has(`${companyId}|${titleKey}`)) continue;
      let current = [...opps.values()].find((x) => x.companyId === companyId && normalizeTitle(x.title.value) === titleKey);
      const incomingDeadline = dateField(o.deadline, src);
      const incomingOpens = dateField(o.opensAt, src);
      if (!current) {
        current = {
          id: newId(),
          companyId,
          title: toField(o.title, src),
          type: o.type ? plain(o.type, src) : undefined,
          // Re-derive from stated evidence so status and dates can never disagree.
          status: deriveStatus({ claim: CLAIM[o.status], deadline: incomingDeadline?.value, opensAt: incomingOpens?.value, today }),
          deadline: incomingDeadline,
          opensAt: incomingOpens,
          duration: o.duration ? plain(o.duration, src) : undefined,
          location: o.location ? plain(o.location, src) : undefined,
          workMode: o.workMode ? plain(o.workMode, src) : undefined,
          compensation: o.compensation ? toField(o.compensation, src) : undefined,
          requirements: o.requirements.map((r) => plain(r, src)),
          skills: o.skills.map((s) => plain(s, src)),
          howToApply: o.howToApply ? plain(o.howToApply, src) : undefined,
          sources: [{ ...src, quote: o.quote }],
        };
        opps.set(current.id, current);
      } else {
        const c = current;
        c.title = mergeField(c.title, toField(o.title, src)).field!;
        if (o.type) c.type = mergeField(c.type, plain(o.type, src)).field;
        const dl = mergeField(c.deadline, incomingDeadline);
        c.deadline = dl.field;
        if (dl.conflict && c.deadline) {
          c.deadline = { ...c.deadline, status: "uncertain", note: `Sources disagree: ${dl.conflict.current.value} vs ${dl.conflict.incoming.value}` };
          review("deadline_conflict", {
            opportunityId: c.id,
            companyId,
            title: c.title.value,
            options: [
              { value: dl.conflict.current.value, sources: dl.conflict.current.sources },
              { value: dl.conflict.incoming.value, sources: dl.conflict.incoming.sources },
            ],
          });
        }
        c.opensAt = mergeField(c.opensAt, incomingOpens).field;
        if (o.duration) c.duration = mergeField(c.duration, plain(o.duration, src)).field;
        if (o.location) c.location = mergeField(c.location, plain(o.location, src)).field;
        if (o.workMode) c.workMode = mergeField(c.workMode, plain(o.workMode, src)).field;
        if (o.compensation) c.compensation = mergeField(c.compensation, toField(o.compensation, src)).field;
        c.requirements = mergeList(c.requirements, o.requirements, src);
        c.skills = mergeList(c.skills, o.skills, src);
        if (o.howToApply) c.howToApply = mergeField(c.howToApply, plain(o.howToApply, src)).field;
        if (!c.sources.some((s) => s.kind === "photo" && s.photoId === photo.id)) c.sources.push({ ...src, quote: o.quote });
        // Status from the strongest stated claim plus the merged dates.
        const claim = ORDER[o.status] > ORDER[c.status] ? o.status : c.status;
        c.status = deriveStatus({ claim: CLAIM[claim], deadline: fieldValue(c.deadline), opensAt: fieldValue(c.opensAt), today });
      }
      touched.opps.add(current.id);
      oppIdByTitle.set(`${companyId}|${titleKey}`, current.id);
    }

    // Links (QR codes and printed URLs)
    for (const l of ex.links) {
      if (existing.dismissedUrls.has(l.normalized)) continue;
      const companyId = forcedCompanyId ?? (l.companyName ? ownerOf(l.companyName, photoCompanyIds) : photoCompanyIds[0]);
      const forOpps = l.appliesToTitles
        .map((t) => {
          const key = normalizeTitle(t);
          const direct = oppIdByTitle.get(`${companyId}|${key}`);
          if (direct) return direct;
          return [...opps.values()].find((o) => o.companyId === companyId && normalizeTitle(o.title.value) === key)?.id;
        })
        .filter((x): x is string => !!x);
      let current = [...links.values()].find((x) => x.normalizedUrl === l.normalized);
      if (!current) {
        current = {
          id: newId(),
          companyId,
          rawUrl: l.raw,
          normalizedUrl: l.normalized,
          origin: l.origin,
          purpose: l.purpose,
          verification: l.verification,
          opportunityIds: forOpps,
          pageTitle: undefined,
          sources: [{ ...src, quote: l.label }],
        };
        links.set(current.id, current);
      } else {
        current.opportunityIds = [...new Set([...current.opportunityIds, ...forOpps])];
        if (!current.sources.some((s) => s.kind === "photo" && s.photoId === photo.id)) current.sources.push({ ...src, quote: l.label });
        current.companyId ??= companyId;
      }
      touched.links.add(current.id);
      linksTouchedThisBatch.add(current.id);
    }

    // Events
    for (const e of ex.events) {
      const companyId = forcedCompanyId ?? ownerOf(e.companyName, photoCompanyIds);
      const key = normalizeTitle(e.title);
      let current = [...events.values()].find((x) => x.companyId === companyId && normalizeTitle(x.title.value) === key);
      if (!current) {
        current = {
          id: newId(),
          companyId,
          title: plain(e.title, src),
          date: dateField(e.date, src),
          time: e.time ? plain(e.time, src) : undefined,
          location: e.location ? plain(e.location, src) : undefined,
          sources: [{ ...src, quote: e.quote }],
        };
        events.set(current.id, current);
      } else {
        current.date = mergeField(current.date, dateField(e.date, src)).field;
        if (e.time) current.time = mergeField(current.time, plain(e.time, src)).field;
        if (e.location) current.location = mergeField(current.location, plain(e.location, src)).field;
        if (!current.sources.some((s) => s.kind === "photo" && s.photoId === photo.id)) current.sources.push(src);
      }
      // An event-registration link on the same photo for the same company.
      const reg = [...links.values()].find((l) => l.companyId === companyId && l.purpose === "event_registration" && l.sources.some((s) => s.kind === "photo" && s.photoId === photo.id));
      if (reg && !current.registrationLinkId) current.registrationLinkId = reg.id;
      touched.events.add(current.id);
    }

    // Contacts
    for (const ct of ex.contacts) {
      const companyId = forcedCompanyId ?? ownerOf(ct.companyName, photoCompanyIds);
      const key = `${ct.kind}|${ct.value.toLowerCase()}`;
      let current = [...contacts.values()].find((x) => x.companyId === companyId && `${x.kind}|${x.value.value.toLowerCase()}` === key);
      if (!current) {
        current = { id: newId(), companyId, kind: ct.kind, value: plain(ct.value, src), label: ct.label, sources: [src] };
        contacts.set(current.id, current);
      } else if (!current.sources.some((s) => s.kind === "photo" && s.photoId === photo.id)) {
        current.sources.push(src);
      }
      touched.contacts.add(current.id);
    }
  }

  // An application form for a company with several positions, tied to none: ask which.
  for (const id of linksTouchedThisBatch) {
    const l = links.get(id)!;
    if (l.purpose !== "application_form" || l.opportunityIds.length > 0 || !l.companyId) continue;
    const companyOpps = [...opps.values()].filter((o) => o.companyId === l.companyId);
    if (companyOpps.length >= 2) {
      review("unclear_application_link", {
        linkId: l.id,
        companyId: l.companyId,
        url: l.normalizedUrl,
        label: l.sources.find((s) => s.kind === "photo")?.quote,
        options: companyOpps.map((o) => ({ id: o.id, title: o.title.value })),
      });
    }
  }

  const pick = <T,>(m: Map<string, T>, ids: Set<string>) => [...ids].map((id) => m.get(id)!);
  return {
    companies: pick(companies, touched.companies),
    opportunities: pick(opps, touched.opps),
    links: pick(links, touched.links),
    events: pick(events, touched.events),
    contacts: pick(contacts, touched.contacts),
    photoCompany,
    reviewItems,
    stats: {
      newCompanies: createdCompanies.size,
      updatedCompanies: [...touched.companies].filter((id) => !createdCompanies.has(id)).length,
      opportunities: touched.opps.size,
      links: touched.links.size,
    },
  };
}
