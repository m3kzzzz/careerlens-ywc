"use client";

import Link from "next/link";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { cn } from "@/lib/cn";
import { companyHref, type ActionKind, type CompanyView, type OppView } from "./company-model";
import { STATUS_META } from "./filters";
import { SaveToggle } from "./save-toggle";

const ACTION_CHIP: Record<ActionKind, { label: string; cls: string }> = {
  apply: { label: "Apply online", cls: "bg-primary-soft text-primary-hover" },
  careers: { label: "Careers page", cls: "bg-updated-soft text-updated" },
  event: { label: "Event", cls: "bg-social-soft text-social" },
  contact: { label: "Contact", cls: "bg-success-soft text-success" },
  learn: { label: "Company info", cls: "bg-chip text-ink-2" },
};
const ACTION_ORDER: ActionKind[] = ["apply", "careers", "event", "contact", "learn"];

export function OppStatusBadge({ status }: { status: OppView["status"] }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex flex-none items-center whitespace-nowrap rounded-full px-[7px] py-px text-[11px] font-semibold", m.badge, status === "not_specified" && "font-medium")}>
      {status === "not_specified" ? "Status not stated" : m.label}
    </span>
  );
}

const NOTE_TONE = { red: "text-danger", amber: "text-warning-ink", muted: "text-muted" };

export type BatchBadge = "New" | "Updated" | null;

/** Company card for M6 (mobile) and D4 (desktop). */
export function CompanyCard({
  company,
  badge,
  onToggleSave,
}: {
  company: CompanyView;
  badge: BatchBadge;
  onToggleSave: () => void;
}) {
  const href = companyHref(company.id);
  const shown = company.opps.slice(0, 2);
  const more = company.opps.length - shown.length;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-card lg:rounded-2xl">
      <div className="flex items-center gap-2 pb-2.5 pl-3.5 pr-3 pt-3.5 lg:items-start lg:gap-3 lg:px-4 lg:pb-2.5 lg:pt-4">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 text-ink lg:items-start">
          <CompanyAvatar name={company.name} className="size-[42px] rounded-xl text-sm lg:size-11 lg:text-[15px]" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 lg:gap-2">
              <span className="truncate text-base font-semibold lg:text-[17px] lg:tracking-[-0.01em]">{company.name}</span>
              {badge === "New" && <span className="flex-none rounded-full bg-primary px-[7px] text-[10px] font-semibold text-white">New</span>}
              {badge === "Updated" && (
                <span className="flex-none rounded-full border border-updated-line bg-updated-soft px-[7px] text-[10px] font-semibold text-updated">Updated</span>
              )}
            </span>
            <span className="block truncate text-xs text-muted">{company.meta}</span>
            {company.description && <span className="mt-1 hidden text-[13px] text-ink-2 lg:line-clamp-2">{company.description}</span>}
          </span>
        </Link>
        <SaveToggle name={company.name} saved={company.saved} onToggle={onToggleSave} />
      </div>

      <div className="flex-1 px-3.5 lg:px-4">
        {shown.map((o) => (
          <div key={o.id} className="flex flex-col gap-[3px] border-t border-chip py-[9px] lg:flex-row lg:items-center lg:gap-2.5 lg:py-2">
            <span className="text-sm font-medium lg:min-w-0 lg:flex-1 lg:truncate">{o.title}</span>
            <span className="flex flex-wrap items-center gap-1.5 lg:flex-none lg:flex-nowrap lg:gap-2.5">
              <span className="lg:order-2">
                <OppStatusBadge status={o.status} />
              </span>
              <span className={cn("text-xs font-medium lg:order-1 lg:whitespace-nowrap", NOTE_TONE[o.noteTone])}>{o.note}</span>
            </span>
          </div>
        ))}
        {company.opps.length === 0 && (
          <div className="mb-1 rounded-[10px] border border-dashed border-line bg-canvas px-3 py-2.5 text-xs text-ink-2 lg:mb-0 lg:text-[13px]">
            No positions in your photos yet.{" "}
            <span className="text-muted">
              {[company.contacts.length ? "Contacts" : null, company.links.length ? `${company.links.length} link${company.links.length === 1 ? "" : "s"}` : null]
                .filter(Boolean)
                .join(" and ") || "Company info"}{" "}
              saved.
            </span>
          </div>
        )}
        {more > 0 && (
          <Link href={href} className="block border-t border-chip pb-0.5 pt-1.5 text-xs font-semibold text-primary">
            +{more} more position{more === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3 pt-2.5 lg:mt-2 lg:border-t lg:border-chip lg:px-4 lg:pb-3.5 lg:pt-3">
        {ACTION_ORDER.filter((a) => company.actions.has(a)).map((a) => (
          <span key={a} className={cn("inline-flex items-center rounded-md px-[7px] py-px text-[11px] font-semibold", ACTION_CHIP[a].cls)}>
            {ACTION_CHIP[a].label}
          </span>
        ))}
        <Link href={href} className="ml-auto hidden text-[13px] font-semibold text-primary hover:text-primary-hover lg:inline">
          Open company →
        </Link>
      </div>
    </article>
  );
}
