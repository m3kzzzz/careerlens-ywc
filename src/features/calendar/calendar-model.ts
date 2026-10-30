import type { ISODate } from "@/domain/types";
import { initials } from "@/components/ui/company-avatar";
import type { CompanyView } from "@/features/companies/company-model";

/**
 * My Calendar data. Every marker comes from a date stored on a saved
 * company's opportunity or event; items without a known date are never
 * placed on the grid.
 */

export type CalKind = "deadline" | "opens" | "event";

export interface CalItem {
  iso: ISODate;
  kind: CalKind;
  companyId: string;
  companyName: string;
  initials: string;
  label: string;
  closed: boolean;
  /** The date was hard to read or sources disagree. */
  uncertain: boolean;
  opportunityId?: string;
}

export const KIND_COLOR: Record<CalKind, string> = { deadline: "#DC2626", opens: "#2563EB", event: "#7C3AED" };
export const KIND_LABEL: Record<CalKind, string> = { deadline: "Deadline", opens: "Opens", event: "Event" };

export function collectCalendarItems(companies: CompanyView[]): CalItem[] {
  const items: CalItem[] = [];
  for (const c of companies) {
    const base = { companyId: c.id, companyName: c.name, initials: initials(c.name) };
    for (const o of c.opps) {
      if (o.deadline) {
        items.push({ ...base, iso: o.deadline, kind: "deadline", label: o.title, closed: o.status === "closed", uncertain: o.deadlineUncertain, opportunityId: o.id });
      }
      if (o.opensAt) {
        items.push({ ...base, iso: o.opensAt, kind: "opens", label: `${o.title} opens`, closed: false, uncertain: o.opp.opensAt?.status === "uncertain", opportunityId: o.id });
      }
    }
    for (const e of c.events) {
      if (e.date) items.push({ ...base, iso: e.date, kind: "event", label: e.title, closed: false, uncertain: e.dateUncertain });
    }
  }
  return items.sort((a, b) => a.iso.localeCompare(b.iso) || a.companyName.localeCompare(b.companyName));
}

export function groupByDate(items: CalItem[]): Map<ISODate, CalItem[]> {
  const map = new Map<ISODate, CalItem[]>();
  for (const it of items) map.set(it.iso, [...(map.get(it.iso) ?? []), it]);
  return map;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoOf(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function localIso(d: Date): ISODate {
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface DayCell {
  iso: ISODate;
  day: number;
  inMonth: boolean;
}

/** Six Sunday-first weeks covering `month` (0-based), including leading/trailing days. */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const days: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      days.push({ iso: localIso(d), day: d.getDate(), inMonth: d.getMonth() === month });
    }
    weeks.push(days);
  }
  return weeks;
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Nov 2" – the compact date used in Interested company rows. */
export function shortMonthDay(iso: ISODate): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MON[m - 1]} ${d}`;
}

/** "Sat 31 October" */
export function longDayLabel(iso: ISODate): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${DOW[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Rows for one Interested company card: every position, dated or not. */
export function interestedRows(c: CompanyView, today: ISODate, selected: ISODate | null) {
  return c.opps.map((o) => {
    const closed = o.status === "closed";
    const days = o.deadline ? Math.round((Date.parse(o.deadline) - Date.parse(today)) / 86400000) : null;
    return {
      id: o.id,
      title: o.title,
      jobLink: o.jobLink,
      date: o.deadline ? shortMonthDay(o.deadline) + (closed ? " · closed" : "") : "No date",
      hasDate: !!o.deadline,
      soon: days !== null && !closed && days >= 0 && days <= 3,
      check: o.deadlineUncertain,
      highlighted: !!selected && o.deadline === selected,
    };
  });
}

/** "3 positions · next Nov 2" for Add and Edit rows. */
export function companySummary(c: CompanyView, today: ISODate) {
  const n = c.opps.length;
  const next = c.opps.map((o) => o.deadline).filter((d): d is ISODate => !!d && d >= today).sort()[0];
  return `${n ? `${n} position${n === 1 ? "" : "s"}` : "No positions yet"} · ${next ? `next ${shortMonthDay(next)}` : "no upcoming dates"}`;
}

/** Companies offered in the Add panel: not yet saved (or just added this session), matching the name query. */
export function addCandidates(all: CompanyView[], addedThisSession: Set<string>, query: string) {
  const candidates = all.filter((c) => !c.saved || addedThisSession.has(c.id));
  const q = query.trim().toLowerCase();
  const rows = candidates
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.aliases.some((a) => a.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    rows,
    allSaved: candidates.length === 0,
    noResults: candidates.length > 0 && !!q && rows.length === 0,
  };
}
