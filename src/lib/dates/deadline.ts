import type { ISODate } from "@/domain/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utc(iso: ISODate) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `today` to `iso` (negative when past). Both are local calendar dates. */
export function daysUntil(iso: ISODate, today: Date = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((utc(iso) - t) / 86400000);
}

/** "2 Nov", or "2 Nov 2027" when not in the current year. */
export function formatShortDate(iso: ISODate, today: Date = new Date()): string {
  const [y, m, d] = iso.split("-").map(Number);
  return y === today.getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

export type DeadlineUrgency = "past" | "critical" | "soon" | "later";

/** Design system: ≤ 3 days red, 4–7 days amber, otherwise neutral. */
export function deadlineUrgency(iso: ISODate, today: Date = new Date()): DeadlineUrgency {
  const days = daysUntil(iso, today);
  if (days < 0) return "past";
  if (days <= 3) return "critical";
  if (days <= 7) return "soon";
  return "later";
}

export function deadlineLabel(iso: ISODate, today: Date = new Date()): string {
  const days = daysUntil(iso, today);
  const date = formatShortDate(iso, today);
  if (days < 0) return `Closed ${date}`;
  if (days === 0) return `Closes today`;
  if (days === 1) return `Closes tomorrow`;
  if (days <= 7) return `Closes ${date} · ${days} days left`;
  return `Closes ${date}`;
}
