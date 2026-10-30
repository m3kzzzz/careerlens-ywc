import type {
  Company,
  Contact,
  ISODate,
  Link,
  Opportunity,
  OpportunityType,
  RecruitmentEvent,
  RecruitmentStatus,
} from "@/domain/types";
import { daysUntil, deadlineLabel, formatShortDate } from "@/lib/dates/deadline";
import type { Library } from "@/lib/db/library";
import { fieldValue } from "@/lib/grouping/plan-commit";

/**
 * Read-only view models for Companies, company details and My Calendar,
 * derived from stored records. Nothing here creates or guesses data.
 */

export type ActionKind = "apply" | "careers" | "event" | "contact" | "learn";

/** Where a job title links to. A job-description link is never an Apply link. */
export type JobLink =
  | { kind: "external"; href: string } // verified job-description page
  | { kind: "internal"; href: string } // CareerLens position detail with evidence
  | { kind: "plain" };

export interface OppView {
  id: string;
  companyId: string;
  title: string;
  titleUncertain: boolean;
  type?: OpportunityType;
  status: RecruitmentStatus;
  deadline?: ISODate;
  deadlineUncertain: boolean;
  opensAt?: ISODate;
  /** Short line under the title, e.g. "Closes 2 Nov · 5 days left". */
  note: string;
  noteTone: "red" | "amber" | "muted";
  jobLink: JobLink;
  /** Application form tied to this position by evidence. */
  applyLink?: Link;
  /** Careers listing tied to this position (not an application form). */
  careersLink?: Link;
  opp: Opportunity;
}

export interface EventView {
  id: string;
  companyId: string;
  title: string;
  date?: ISODate;
  dateUncertain: boolean;
  event: RecruitmentEvent;
  registrationLink?: Link;
}

export interface CompanyView {
  id: string;
  name: string;
  aliases: string[];
  industry?: string;
  location?: string;
  description?: string;
  /** "Fintech · Silom · 3 photos" */
  meta: string;
  photoCount: number;
  saved: boolean;
  opps: OppView[];
  events: EventView[];
  contacts: Contact[];
  links: Link[];
  /** Company-wide application forms not tied to one position. */
  generalApplyLinks: Link[];
  actions: Set<ActionKind>;
  /** Earliest upcoming deadline, opening or event date. */
  nextDate?: ISODate;
  uncertainCount: number;
  updatedAt: string;
  company: Company;
}

export function positionHref(companyId: string, oppId: string) {
  return `/companies/${encodeURIComponent(companyId)}#position-${encodeURIComponent(oppId)}`;
}

export function companyHref(companyId: string) {
  return `/companies/${encodeURIComponent(companyId)}`;
}

function isSafeHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Job-title link rules:
 *  1. a VERIFIED external job-description page tied to this position → external
 *  2. otherwise the internal position detail, when we hold evidence for it → internal
 *  3. otherwise plain text. URLs are never invented.
 */
export function jobLinkFor(opp: Opportunity, links: Link[]): JobLink {
  const jd = links.find(
    (l) =>
      l.opportunityIds.includes(opp.id) &&
      l.purpose === "careers" &&
      l.verification === "verified" &&
      isSafeHttpUrl(l.rawUrl),
  );
  if (jd) return { kind: "external", href: jd.rawUrl };
  if (opp.sources.length > 0) return { kind: "internal", href: positionHref(opp.companyId, opp.id) };
  return { kind: "plain" };
}

function oppNote(o: Opportunity, today: Date): { note: string; tone: OppView["noteTone"] } {
  const deadline = fieldValue(o.deadline);
  if (o.status === "closed") return { note: deadline ? `Closed ${formatShortDate(deadline, today)}` : "Closed", tone: "muted" };
  if (deadline) {
    const days = daysUntil(deadline, today);
    return { note: deadlineLabel(deadline, today), tone: days <= 3 ? "red" : days <= 7 ? "amber" : "muted" };
  }
  const opens = fieldValue(o.opensAt);
  if (opens) return { note: `Applications open ${formatShortDate(opens, today)}`, tone: "muted" };
  return { note: "No date in your photos", tone: "muted" };
}

function todayIso(today: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
}

export function buildCompanyViews(lib: Library, today: Date = new Date()): CompanyView[] {
  const now = todayIso(today);
  const by = <T extends { companyId: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) if (r.companyId) map.set(r.companyId, [...(map.get(r.companyId) ?? []), r]);
    return map;
  };
  const oppsBy = by(lib.opportunities);
  const linksBy = by(lib.links);
  const eventsBy = by(lib.events);
  const contactsBy = by(lib.contacts);

  return lib.companies.map((c) => {
    const links = linksBy.get(c.id) ?? [];
    const opps: OppView[] = (oppsBy.get(c.id) ?? []).map((o) => {
      const { note, tone } = oppNote(o, today);
      return {
        id: o.id,
        companyId: c.id,
        title: o.title.value,
        titleUncertain: o.title.status === "uncertain",
        type: o.type?.value,
        status: o.status,
        deadline: fieldValue(o.deadline),
        deadlineUncertain: o.deadline?.status === "uncertain",
        opensAt: fieldValue(o.opensAt),
        note,
        noteTone: tone,
        jobLink: jobLinkFor(o, links),
        applyLink: links.find((l) => l.purpose === "application_form" && l.opportunityIds.includes(o.id)),
        careersLink: links.find((l) => l.purpose === "careers" && l.opportunityIds.includes(o.id)),
        opp: o,
      };
    });
    opps.sort(compareOpps);

    const events: EventView[] = (eventsBy.get(c.id) ?? []).map((e) => ({
      id: e.id,
      companyId: c.id,
      title: e.title.value,
      date: fieldValue(e.date),
      dateUncertain: e.date?.status === "uncertain",
      event: e,
      registrationLink: e.registrationLinkId ? links.find((l) => l.id === e.registrationLinkId) : undefined,
    }));
    events.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

    const contacts = contactsBy.get(c.id) ?? [];
    const actions = new Set<ActionKind>();
    if (links.some((l) => l.purpose === "application_form")) actions.add("apply");
    if (links.some((l) => l.purpose === "careers")) actions.add("careers");
    if (events.length || links.some((l) => l.purpose === "event_registration")) actions.add("event");
    if (contacts.length || links.some((l) => l.purpose === "social_contact")) actions.add("contact");
    if (c.description || links.some((l) => l.purpose === "company_info")) actions.add("learn");

    const upcoming = [
      ...opps.flatMap((o) => (o.status === "closed" ? [] : [o.deadline, o.opensAt])),
      ...events.map((e) => e.date),
    ]
      .filter((d): d is ISODate => !!d && d >= now)
      .sort();

    const uncertainCount =
      (c.name.status === "uncertain" ? 1 : 0) +
      (c.description?.status === "uncertain" ? 1 : 0) +
      opps.reduce(
        (n, o) =>
          n +
          (o.titleUncertain ? 1 : 0) +
          (o.deadlineUncertain ? 1 : 0) +
          (o.opp.compensation?.status === "uncertain" ? 1 : 0),
        0,
      ) +
      events.filter((e) => e.dateUncertain).length +
      links.filter((l) => l.verification === "unreadable").length;

    const industry = c.industry?.value;
    const location = c.locations[0]?.value;
    const photoCount = c.photoIds.length;
    return {
      id: c.id,
      name: c.name.value,
      aliases: c.aliases,
      industry,
      location,
      description: c.description?.value,
      meta: [industry, location, `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`].filter(Boolean).join(" · "),
      photoCount,
      saved: lib.interestedIds.has(c.id),
      opps,
      events,
      contacts,
      links,
      generalApplyLinks: links.filter((l) => l.purpose === "application_form" && l.opportunityIds.length === 0),
      actions,
      nextDate: upcoming[0],
      uncertainCount,
      updatedAt: c.updatedAt,
      company: c,
    };
  });
}

const STATUS_ORDER: Record<RecruitmentStatus, number> = { open: 0, upcoming: 1, not_specified: 2, closed: 3 };

/** Open first, then by nearest date; undated after dated. */
export function compareOpps(a: OppView, b: OppView) {
  if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  const da = a.deadline ?? a.opensAt ?? "9999";
  const db = b.deadline ?? b.opensAt ?? "9999";
  return da.localeCompare(db) || a.title.localeCompare(b.title);
}

// ── Search, filters, sort ───────────────────────────────────────────────

export interface CompanyFilters {
  statuses: RecruitmentStatus[];
  actions: ActionKind[];
  types: OpportunityType[];
  industries: string[];
  includeWithoutPositions: boolean;
}

export const DEFAULT_FILTERS: CompanyFilters = {
  statuses: [],
  actions: [],
  types: [],
  industries: [],
  includeWithoutPositions: true,
};

export type SortKey = "next_date" | "recent" | "name";

export function activeFilterCount(f: CompanyFilters) {
  return f.statuses.length + f.actions.length + f.types.length + f.industries.length + (f.includeWithoutPositions ? 0 : 1);
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFC");
}

function oppMatchesQuery(o: OppView, q: string) {
  return [o.title, ...o.opp.skills.map((s) => s.value), ...o.opp.requirements.map((r) => r.value)].some((t) => norm(t).includes(q));
}

function companyMatchesQuery(c: CompanyView, q: string) {
  if (!q) return true;
  const fields = [c.name, ...c.aliases, c.industry ?? "", ...c.contacts.map((x) => x.value.value)];
  return fields.some((t) => norm(t).includes(q)) || c.opps.some((o) => oppMatchesQuery(o, q));
}

function oppPassesFilters(o: OppView, f: CompanyFilters) {
  if (f.statuses.length && !f.statuses.includes(o.status)) return false;
  if (f.types.length && (!o.type || !f.types.includes(o.type))) return false;
  return true;
}

function companyPassesFilters(c: CompanyView, f: CompanyFilters) {
  if (f.industries.length && (!c.industry || !f.industries.includes(c.industry))) return false;
  if (f.actions.length && !f.actions.every((a) => c.actions.has(a))) return false;
  const oppFilters = f.statuses.length > 0 || f.types.length > 0;
  if (c.opps.length === 0) return f.includeWithoutPositions && !oppFilters;
  return !oppFilters || c.opps.some((o) => oppPassesFilters(o, f));
}

export function filterCompanies(views: CompanyView[], f: CompanyFilters, query: string): CompanyView[] {
  const q = norm(query.trim());
  return views.filter((c) => companyPassesFilters(c, f) && companyMatchesQuery(c, q));
}

export function sortCompanies(views: CompanyView[], sort: SortKey): CompanyView[] {
  const out = [...views];
  if (sort === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "recent") return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out.sort((a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") || a.name.localeCompare(b.name));
}

/** Positions view: the same data flattened, filtered per position. */
export function filterPositions(views: CompanyView[], f: CompanyFilters, query: string) {
  const q = norm(query.trim());
  return views
    .filter((c) => (!f.industries.length || (c.industry && f.industries.includes(c.industry))) && f.actions.every((a) => c.actions.has(a)))
    .flatMap((c) =>
      c.opps
        .filter((o) => oppPassesFilters(o, f))
        .filter((o) => !q || oppMatchesQuery(o, q) || norm(c.name).includes(q) || c.aliases.some((a) => norm(a).includes(q)))
        .map((o) => ({ company: c, opp: o })),
    )
    .sort((a, b) => compareOpps(a.opp, b.opp));
}

export function statusCounts(views: CompanyView[]): Record<RecruitmentStatus, number> {
  const counts: Record<RecruitmentStatus, number> = { open: 0, upcoming: 0, closed: 0, not_specified: 0 };
  for (const c of views) for (const o of c.opps) counts[o.status] += 1;
  return counts;
}
