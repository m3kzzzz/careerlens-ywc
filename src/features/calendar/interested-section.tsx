"use client";

import Link from "next/link";
import { Check, Search } from "lucide-react";
import type { ISODate } from "@/domain/types";
import { CalendarIcon } from "@/components/icons/nav-icons";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { Sheet } from "@/components/ui/sheet";
import { companyHref, type CompanyView } from "@/features/companies/company-model";
import { JobTitleLink } from "@/features/companies/job-title-link";
import { cn } from "@/lib/cn";
import { addCandidates, companySummary, interestedRows } from "./calendar-model";

// ── Interested company card ─────────────────────────────────────────────

export function InterestedCard({ company, today, selected }: { company: CompanyView; today: ISODate; selected: ISODate | null }) {
  const rows = interestedRows(company, today, selected);
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface px-3.5 pb-1.5 pt-3 lg:px-4 lg:pb-2 lg:pt-3.5">
      <Link href={companyHref(company.id)} className="flex items-center gap-2.5 pb-1.5 text-ink">
        <CompanyAvatar name={company.name} className="size-7 rounded-lg text-[11px] lg:size-[30px]" />
        <h3 className="min-w-0 break-words text-base font-semibold lg:text-[17px]">{company.name}</h3>
      </Link>
      {rows.length === 0 ? (
        <div className="pb-2.5 pt-1.5 text-[13px] text-muted">No positions found yet</div>
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                "-mx-2 flex items-baseline gap-3 rounded-lg border-t border-chip px-2 py-[9px] text-sm leading-[1.35] lg:gap-4 lg:leading-[1.4]",
                r.highlighted && "bg-primary-soft",
              )}
            >
              <span className="min-w-0 flex-1 break-words">
                <JobTitleLink title={r.title} link={r.jobLink} />
              </span>
              <span
                className={cn(
                  "flex-none whitespace-nowrap text-right text-[13px] tabular-nums",
                  !r.hasDate ? "text-[#a8a29e]" : r.soon ? "font-semibold text-danger" : "font-medium text-ink-3",
                )}
              >
                {r.date}
                {r.check && (
                  <span
                    title="Hard to read or sources disagree. Check it on the company page."
                    aria-label="needs check"
                    className="ml-[5px] inline-block size-1.5 rounded-full bg-warning-dash align-[2px]"
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// ── Edit mode row ───────────────────────────────────────────────────────

export function EditRow({
  company,
  today,
  selected,
  onToggle,
}: {
  company: CompanyView;
  today: ISODate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-16 cursor-pointer items-center gap-3 rounded-[14px] px-3.5 py-2.5 lg:px-4 lg:py-3",
        selected ? "border-[1.5px] border-[#fca5a5] bg-danger-soft" : "border border-line bg-surface",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="size-[22px] flex-none accent-danger lg:size-5"
      />
      <CompanyAvatar name={company.name} className="size-[30px] rounded-lg text-[11px] lg:size-8 lg:rounded-[9px] lg:text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-semibold">{company.name}</span>
        <span className={cn("block text-xs", selected ? "text-danger" : "text-muted")}>
          {selected ? "Will be removed from My Calendar" : companySummary(company, today)}
        </span>
      </span>
    </label>
  );
}

// ── Add companies panel ─────────────────────────────────────────────────

export function AddCompaniesPanel({
  open,
  companies,
  today,
  query,
  addedThisSession,
  onQuery,
  onAdd,
  onClose,
}: {
  open: boolean;
  companies: CompanyView[];
  today: ISODate;
  query: string;
  addedThisSession: Set<string>;
  onQuery: (q: string) => void;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const { rows, allSaved, noResults } = addCandidates(companies, addedThisSession, query);

  return (
    <Sheet open={open} onClose={onClose} label="Add companies" className="h-[680px] lg:h-auto">
      <div className="flex items-center justify-between pb-2 pl-4 pr-2 pt-1 lg:pb-2.5 lg:pl-6 lg:pr-4 lg:pt-[18px]">
        <h2 className="text-lg font-semibold lg:text-xl">Add companies</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-3 text-[15px] font-semibold text-primary lg:h-[38px] lg:rounded-lg lg:bg-primary lg:px-4 lg:text-sm lg:text-white lg:hover:bg-primary-hover"
        >
          Done
        </button>
      </div>
      <div className="px-4 pb-2.5 lg:px-6 lg:pb-3">
        <label className="flex h-[46px] items-center gap-2.5 rounded-xl border-[1.5px] border-primary bg-surface px-3 text-muted shadow-[0_0_0_4px_var(--color-primary-soft)] lg:h-11 lg:rounded-[10px]">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search your companies"
            placeholder="Search your companies"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none lg:text-[15px]"
          />
        </label>
        <div className="pt-1.5 text-xs text-muted">
          Only companies from your uploaded photos<span className="hidden lg:inline">. Nothing is searched online.</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 lg:px-6">
        {rows.map((c) => {
          const added = addedThisSession.has(c.id);
          return (
            <div key={c.id} className="flex min-h-16 items-center gap-3 border-b border-chip py-2">
              <CompanyAvatar name={c.name} className="size-9 rounded-[10px] text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{c.name}</span>
                <span className="block text-xs text-muted">{companySummary(c, today)}</span>
              </span>
              {added ? (
                <span className="inline-flex h-10 flex-none items-center gap-[5px] rounded-[10px] bg-success-soft px-3 text-sm font-semibold text-success lg:h-9 lg:rounded-lg">
                  <Check size={14} strokeWidth={2.8} aria-hidden="true" />
                  Added
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(c.id)}
                  aria-label={`Add ${c.name} to My Calendar`}
                  className="h-10 flex-none rounded-[10px] border border-primary-line bg-surface px-3.5 text-sm font-semibold text-primary-hover hover:bg-primary-soft lg:h-9 lg:rounded-lg"
                >
                  + Add
                </button>
              )}
            </div>
          );
        })}

        {noResults && (
          <div className="flex flex-col items-center gap-2 px-3 py-9 text-center lg:py-12">
            <div className="text-base font-semibold">No companies match “{query.trim()}”</div>
            <div className="max-w-[300px] text-[13px] text-muted lg:text-sm">
              Check the spelling or try another name. Only companies from your uploaded photos can be added.
            </div>
            <button
              type="button"
              onClick={() => onQuery("")}
              className="mt-1 h-10 rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-canvas lg:h-[38px] lg:rounded-lg"
            >
              Clear search
            </button>
          </div>
        )}

        {allSaved && (
          <div className="flex flex-col items-center gap-2 px-3 py-9 text-center lg:py-12">
            <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-[13px] bg-success-soft text-success">
              <Check size={22} strokeWidth={2.6} />
            </span>
            <div className="text-base font-semibold">
              {companies.length ? "You're tracking every company" : "No companies to add yet"}
            </div>
            <div className="max-w-[300px] text-[13px] text-muted lg:text-sm">
              {companies.length
                ? "All companies from your uploads are already in My Calendar. Upload more brochures to find new ones."
                : "Companies appear here after your brochure photos are organized."}
            </div>
            {!companies.length && (
              <Link href="/" className="mt-1 text-sm font-semibold text-primary hover:text-primary-hover">
                Go to Upload
              </Link>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── Empty saved state ───────────────────────────────────────────────────

export function NoSavedCompanies({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface px-[18px] py-[22px] text-center lg:gap-2.5 lg:rounded-2xl lg:px-6 lg:py-9">
      <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-[13px] bg-primary-soft text-primary lg:size-12 lg:rounded-[14px]">
        <CalendarIcon size={22} />
      </span>
      <div className="text-base font-semibold lg:text-lg">No companies saved yet</div>
      <div className="max-w-[280px] text-[13px] text-muted lg:max-w-[420px] lg:text-sm">
        Choose the companies you want to follow. Their deadlines and events will appear on the calendar
        <span className="hidden lg:inline"> above</span>.
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 h-[46px] rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover lg:h-[42px] lg:rounded-lg lg:px-[18px] lg:text-sm"
      >
        + Add companies
      </button>
    </div>
  );
}
