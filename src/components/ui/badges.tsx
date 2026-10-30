import { CalendarClock, ClipboardCheck, Globe, BriefcaseBusiness, HelpCircle, AtSign, Ticket } from "lucide-react";
import type { LinkPurpose, LinkVerification, RecruitmentStatus } from "@/domain/types";
import { cn } from "@/lib/cn";
import { deadlineLabel, deadlineUrgency } from "@/lib/dates/deadline";

/** Badges and chips from the approved design system. */

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold";

const STATUS: Record<RecruitmentStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "border border-success-line bg-success-soft text-success" },
  upcoming: { label: "Upcoming", cls: "border border-info-line bg-info-soft text-info" },
  closed: { label: "Closed", cls: "border border-line bg-chip text-ink-3" },
  not_specified: { label: "Not specified", cls: "border border-dashed border-line-strong text-muted" },
};

export function StatusBadge({ status }: { status: RecruitmentStatus }) {
  const s = STATUS[status];
  return <span className={cn(pill, "px-[9px] py-px text-xs", s.cls)}>{s.label}</span>;
}

export function DeadlineBadge({ iso, uncertain }: { iso: string; uncertain?: boolean }) {
  const urgency = deadlineUrgency(iso);
  return (
    <span
      className={cn(
        pill,
        "px-[9px] py-[3px] text-xs",
        urgency === "critical" && "border border-danger-line bg-danger-soft text-danger",
        urgency === "soon" && "border border-warning-line bg-warning-soft text-warning-ink",
        (urgency === "later" || urgency === "past") && "border border-line bg-chip text-ink-2",
        uncertain && "border-dashed",
      )}
    >
      <CalendarClock size={12} aria-hidden="true" />
      {deadlineLabel(iso)}
    </span>
  );
}

export function NoDeadlineBadge() {
  return (
    <span className={cn(pill, "border border-dashed border-line-strong px-[9px] py-[3px] text-xs font-medium text-muted")}>
      No deadline mentioned
    </span>
  );
}

/** Small amber "Check" pill for uncertain values. */
export function CheckBadge({ title }: { title?: string }) {
  return (
    <span title={title} className={cn(pill, "bg-[#fef3c7] px-2 py-px text-[11px] text-warning-ink")}>
      Check
    </span>
  );
}

export function SourceChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-chip px-[7px] py-0.5 text-[11px] font-medium text-ink-2">{children}</span>;
}

export const PURPOSE: Record<LinkPurpose, { label: string; cls: string; Icon: typeof Globe }> = {
  application_form: { label: "Application form", cls: "border-primary-line bg-primary-soft text-primary-hover", Icon: ClipboardCheck },
  careers: { label: "Careers page", cls: "border-updated-line bg-updated-soft text-updated", Icon: BriefcaseBusiness },
  company_info: { label: "Website", cls: "border-line bg-chip text-ink-2", Icon: Globe },
  social_contact: { label: "Social / contact", cls: "border-social-line bg-social-soft text-social", Icon: AtSign },
  event_registration: { label: "Event sign-up", cls: "border-dashed border-[#a8a29e] bg-surface text-ink-3", Icon: Ticket },
  unknown: { label: "Other", cls: "border-dashed border-[#a8a29e] bg-surface text-ink-3", Icon: HelpCircle },
};

export function PurposeBadge({ purpose, count }: { purpose: LinkPurpose; count?: number }) {
  const p = PURPOSE[purpose];
  return (
    <span className={cn("inline-flex items-center gap-[5px] whitespace-nowrap rounded-lg border px-[9px] py-[3px] text-xs font-semibold", p.cls)}>
      <p.Icon size={13} aria-hidden="true" />
      {count !== undefined ? `${count} ${p.label}` : p.label}
    </span>
  );
}

const VERIFICATION: Record<LinkVerification, { label: string; cls: string }> = {
  verified: { label: "✓ Verified", cls: "bg-success-soft text-success" },
  from_photo: { label: "From photo", cls: "bg-chip text-ink-3" },
  unreadable: { label: "Couldn't read", cls: "bg-warning-soft text-warning-ink" },
  not_fetched: { label: "Not fetched", cls: "bg-chip text-ink-3" },
};

export function VerificationPill({ state }: { state: LinkVerification }) {
  const v = VERIFICATION[state];
  return <span className={cn(pill, "flex-none px-2 py-0.5 text-[11px]", v.cls)}>{v.label}</span>;
}
