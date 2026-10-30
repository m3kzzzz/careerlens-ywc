"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { CompaniesIcon } from "@/components/icons/nav-icons";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { Toast, useToast } from "@/components/ui/toast";
import { KIND_LABEL, collectCalendarItems, localIso, type CalKind } from "@/features/calendar/calendar-model";
import { setInterested } from "@/lib/db/interests";
import type { Library } from "@/lib/db/library";
import { useLibrary } from "@/lib/db/use-library";
import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-mounted";
import { CompanyCard, OppStatusBadge, type BatchBadge } from "./company-card";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  buildCompanyViews,
  filterCompanies,
  filterPositions,
  sortCompanies,
  type CompanyFilters,
  type CompanyView,
  type SortKey,
} from "./company-model";
import { DesktopFilterRow, FiltersSheet, filterCounts, toggle } from "./filters";
import { JobTitleLink } from "./job-title-link";

export function CompaniesScreen() {
  const mounted = useMounted();
  return mounted ? <CompaniesBody /> : <CompaniesLoading />;
}

function CompaniesLoading() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Loading your companies" className="flex flex-col gap-2.5 px-4 pt-3 lg:px-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-[18px] bg-chip" />
        ))}
      </div>
    </Frame>
  );
}

function CompaniesBody() {
  const data = useLibrary();
  const [now] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"companies" | "positions">("companies");
  const [filters, setFilters] = useState<CompanyFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("next_date");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const { toast, show } = useToast();

  const views = useMemo(() => (data.state === "ready" ? buildCompanyViews(data.library, now) : []), [data, now]);
  const counts = useMemo(() => filterCounts(views), [views]);
  const companies = useMemo(() => sortCompanies(filterCompanies(views, filters, query), sort), [views, filters, query, sort]);
  const positions = useMemo(() => filterPositions(views, filters, query), [views, filters, query]);

  if (data.state === "loading") return <CompaniesLoading />;
  if (data.state === "error") {
    return (
      <Frame>
        <p role="alert" className="mx-4 mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger lg:mx-0">
          {data.message}
        </p>
      </Frame>
    );
  }

  const lib = data.library;
  if (views.length === 0) return <NoCompanies lib={lib} />;

  const onToggleSave = async (c: CompanyView) => {
    setPending(c.id);
    try {
      await setInterested(c.id, !c.saved);
      show(c.saved ? `${c.name} removed from My Calendar` : `${c.name} added to My Calendar`, {
        label: "View",
        href: "/calendar",
      });
    } catch (err) {
      console.error(err);
      show("Couldn't save that change on this device. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const badgeFor = (c: CompanyView): BatchBadge =>
    !lib.latestBatchId ? null : c.company.createdInBatchId === lib.latestBatchId ? "New" : c.company.updatedInBatchId === lib.latestBatchId ? "Updated" : null;

  const opportunityCount = views.reduce((n, c) => n + c.opps.length, 0);
  const nFilters = activeFilterCount(filters);
  const resultCount = mode === "companies" ? companies.length : positions.length;
  const resultNoun = mode === "companies" ? (resultCount === 1 ? "company" : "companies") : resultCount === 1 ? "position" : "positions";
  const upcoming = collectCalendarItems(views).filter((i) => i.iso >= localIso(now) && !i.closed).slice(0, 7);

  const modeToggle = (
    <div role="group" aria-label="Browse by" className="flex flex-none rounded-[10px] bg-segment p-[3px] lg:rounded-[9px]">
      {(["companies", "positions"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "h-8 rounded-lg px-3 text-[13px] lg:h-[30px] lg:rounded-[7px]",
            mode === m ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "font-medium text-muted",
          )}
        >
          {m === "companies" ? "Companies" : "Positions"}
        </button>
      ))}
    </div>
  );

  return (
    <Frame>
      {/* Mobile header (M6) */}
      <header className="flex flex-col gap-2.5 border-b border-line bg-surface px-4 pb-2.5 pt-2 lg:hidden">
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Your companies</h1>
          <span className="text-xs text-muted">
            {views.length} {views.length === 1 ? "company" : "companies"} · {lib.photoCount} photos
          </span>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search companies, positions, skills" />
        <div className="flex items-center gap-2">
          {modeToggle}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="ml-auto inline-flex h-[38px] flex-none items-center gap-1.5 rounded-full bg-ink px-3 text-[13px] font-semibold text-white"
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            Filters{nFilters > 0 && ` · ${nFilters}`}
          </button>
        </div>
        <div className="-mr-4 flex gap-1.5 overflow-x-auto pb-0.5 pr-4">
          {(["open", "upcoming"] as const).map((s) => {
            const on = filters.statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilters({ ...filters, statuses: toggle(filters.statuses, s) })}
                className={cn(
                  "inline-flex h-[34px] flex-none items-center gap-1.5 rounded-full border px-3 text-[13px]",
                  on ? "border-primary bg-primary-soft font-medium text-primary-hover" : "border-line bg-surface text-ink-2",
                )}
              >
                <span className={cn("size-[7px] rounded-full", s === "open" ? "bg-success-dot" : "bg-[#2563eb]")} />
                {s === "open" ? "Open now" : "Upcoming"} · {counts.status[s]}
              </button>
            );
          })}
          {counts.industries.slice(0, 4).map(([industry]) => {
            const on = filters.industries.includes(industry);
            return (
              <button
                key={industry}
                type="button"
                aria-pressed={on}
                onClick={() => setFilters({ ...filters, industries: toggle(filters.industries, industry) })}
                className={cn(
                  "h-[34px] flex-none rounded-full border px-3 text-[13px]",
                  on ? "border-primary bg-primary-soft font-medium text-primary-hover" : "border-line bg-surface text-ink-2",
                )}
              >
                {industry}
              </button>
            );
          })}
        </div>
      </header>

      {lib.openReviewCount > 0 && (
        <div className="hidden items-center gap-3 rounded-[10px] border border-primary-line bg-surface py-2 pl-3 pr-2 text-[13px] lg:flex">
          <span className="min-w-0 flex-1 text-ink-2">
            <b className="font-semibold text-ink">Some results need a quick check.</b> Everything else was organized automatically.
          </span>
          <ToCheckLink count={lib.openReviewCount} />
        </div>
      )}

      {/* Desktop header + filter card (D4) */}
      <section className="hidden flex-col gap-3.5 lg:flex">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Your companies</h1>
            <span className="text-muted">
              {views.length} {views.length === 1 ? "company" : "companies"} · {opportunityCount}{" "}
              {opportunityCount === 1 ? "opportunity" : "opportunities"} · organized from {lib.photoCount} photos
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {modeToggle}
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink"
              >
                <option value="next_date">Next important date</option>
                <option value="recent">Recently added</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-3 shadow-card">
          <SearchBox value={query} onChange={setQuery} placeholder="Search companies, positions, programs, skills, contacts…" large />
          <DesktopFilterRow filters={filters} onChange={setFilters} counts={counts} />
          <p className="text-xs text-muted">
            Status is set only when a brochure or linked page states it. An application link alone never makes something “Open”.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-2.5 px-4 pt-3 lg:flex-row lg:flex-wrap lg:items-start lg:gap-6 lg:px-0 lg:pt-0">
        <div className="flex min-w-0 flex-col gap-2.5 lg:flex-[999_1_640px]">
          <div className="flex items-center justify-between text-xs text-muted lg:hidden">
            <span>
              Sorted by <b className="font-semibold text-ink">next important date</b>
            </span>
            {lib.openReviewCount > 0 && <ToCheckLink count={lib.openReviewCount} />}
          </div>

          {resultCount === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
              <div className="text-base font-semibold">No {resultNoun} match</div>
              <p className="max-w-xs text-[13px] text-muted">Try another search or clear the filters.</p>
              <button
                type="button"
                onClick={() => (setQuery(""), setFilters(DEFAULT_FILTERS))}
                className="mt-1 h-10 rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-canvas"
              >
                Clear search and filters
              </button>
            </div>
          ) : mode === "companies" ? (
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(400px,1fr))] lg:gap-4">
              {companies.map((c) => (
                <CompanyCard key={c.id} company={c} badge={badgeFor(c)} onToggleSave={() => pending !== c.id && onToggleSave(c)} />
              ))}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card lg:rounded-2xl">
              {positions.map(({ company, opp }) => (
                <li key={opp.id} className="flex items-start gap-3 border-t border-chip px-3.5 py-3 first:border-t-0 lg:items-center lg:px-4">
                  <CompanyAvatar name={company.name} className="mt-0.5 size-8 rounded-[9px] text-[11px] lg:mt-0" />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm">
                      <JobTitleLink title={opp.title} link={opp.jobLink} />
                    </div>
                    <div className="text-xs text-muted">
                      <Link href={`/companies/${encodeURIComponent(company.id)}`} className="hover:text-ink">
                        {company.name}
                      </Link>
                      {" · "}
                      <span className={cn(opp.noteTone === "red" && "text-danger", opp.noteTone === "amber" && "text-warning-ink")}>{opp.note}</span>
                    </div>
                  </div>
                  <OppStatusBadge status={opp.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop rail */}
        <aside className="hidden max-w-[320px] flex-[1_1_280px] flex-col gap-4 lg:flex">
          <section className="rounded-[14px] border border-line bg-surface p-[18px] shadow-card">
            <h2 className="mb-1 text-[15px] font-semibold">Upcoming dates</h2>
            <p className="mb-2 text-xs text-muted">Deadlines, openings and events across companies</p>
            {upcoming.length === 0 ? (
              <p className="border-t border-chip pt-2.5 text-[13px] text-muted">No upcoming dates in your photos.</p>
            ) : (
              <ol>
                {upcoming.map((d, i) => (
                  <UpcomingRow key={`${d.iso}-${d.companyId}-${i}`} iso={d.iso} kind={d.kind} title={d.label} company={d.companyName} />
                ))}
              </ol>
            )}
          </section>
          <section className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-chip px-4 py-3.5">
            <div className="text-xs font-bold tracking-[0.04em] text-muted">YOUR UPLOADS</div>
            <div className="text-[13px] text-ink-2">
              {lib.photoCount} photos · {lib.batchCount} {lib.batchCount === 1 ? "batch" : "batches"} · {lib.linkCount} links found
            </div>
            <Link href="/" className="text-[13px] font-medium text-primary hover:text-primary-hover">
              Upload another batch →
            </Link>
          </section>
        </aside>
      </div>

      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        counts={counts}
        resultCount={resultCount}
        resultNoun={resultNoun}
      />
      <Toast toast={toast} />
    </Frame>
  );
}

const KIND_BOX: Record<CalKind, string> = {
  deadline: "bg-danger-soft text-danger",
  opens: "bg-info-soft text-info",
  event: "bg-social-soft text-social",
};
const KIND_TEXT: Record<CalKind, string> = { deadline: "text-danger", opens: "text-info", event: "text-social" };
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function UpcomingRow({ iso, kind, title, company }: { iso: string; kind: CalKind; title: string; company: string }) {
  const [, m, d] = iso.split("-").map(Number);
  return (
    <li className="flex gap-3 border-t border-chip py-[9px]">
      <div className={cn("flex size-11 flex-none flex-col items-center justify-center rounded-[10px]", KIND_BOX[kind])}>
        <span className="text-[10px] font-bold tracking-[0.05em]">{MON[m - 1]}</span>
        <span className="text-base font-bold leading-none">{d}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[11px] font-bold uppercase tracking-[0.04em]", KIND_TEXT[kind])}>{KIND_LABEL[kind]}</div>
        <div className="truncate text-[13px] font-semibold">{title}</div>
        <div className="text-xs text-muted">{company}</div>
      </div>
    </li>
  );
}

function ToCheckLink({ count }: { count: number }) {
  return (
    <Link
      href="/review"
      className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink hover:bg-[#fef3c7] lg:py-1 lg:text-[13px] lg:font-medium"
    >
      <span className="size-1.5 rounded-full bg-warning-dash" aria-hidden="true" />
      {count} to check
    </Link>
  );
}

function SearchBox({ value, onChange, placeholder, large }: { value: string; onChange: (v: string) => void; placeholder: string; large?: boolean }) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 text-muted",
        large
          ? "h-[50px] gap-3 rounded-[10px] border-[1.5px] border-line px-4 focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--color-primary-soft)]"
          : "h-[46px] rounded-xl border border-line bg-canvas px-3 focus-within:border-primary",
      )}
    >
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search companies, positions, programs or skills"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
      />
    </label>
  );
}

/** N2: no companies yet (with an honest note when photos were read but not grouped). */
function NoCompanies({ lib }: { lib: Library }) {
  const ungrouped = lib.ungroupedBatchCount > 0;
  return (
    <Frame>
      <header className="border-b border-line bg-surface px-4 pb-3.5 pt-3 lg:hidden">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Your companies</h1>
      </header>
      <h1 className="hidden text-[28px] font-semibold tracking-[-0.02em] lg:block">Your companies</h1>
      <section
        aria-label="No companies yet"
        className="flex min-h-[calc(100dvh-58px-96px)] flex-col items-center justify-center gap-3.5 px-10 pb-10 text-center lg:min-h-[420px]"
      >
        <div aria-hidden="true" className="relative h-[104px] w-[120px]">
          <div className="absolute left-3.5 top-3.5 h-[86px] w-[74px] -rotate-8 rounded-[14px] border border-line bg-surface" />
          <div className="absolute left-[34px] top-1.5 flex h-[90px] w-[74px] flex-col gap-[7px] rounded-[14px] border border-line bg-surface p-3 shadow-[0_10px_22px_-12px_rgba(28,25,23,0.25)]">
            <span className="flex size-[26px] items-center justify-center rounded-lg bg-primary-soft text-primary">
              <CompaniesIcon size={15} />
            </span>
            <span className="h-1.5 w-[90%] rounded-[3px] bg-line" />
            <span className="h-1.5 w-[64%] rounded-[3px] bg-line-soft" />
          </div>
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.015em]">No companies yet</h2>
        <p className="max-w-[290px] text-sm text-muted lg:max-w-[420px]">
          {ungrouped
            ? "Your photos have been read and are being grouped into companies. If this doesn't finish, open the batch to try again."
            : "Upload brochure photos and each company gets its own page with opportunities, events and contacts."}
        </p>
        {ungrouped && lib.latestBatchId && (
          <Link href={`/batches/${lib.latestBatchId}`} className="text-sm font-semibold text-primary hover:text-primary-hover">
            Open the batch →
          </Link>
        )}
      </section>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[560px] lg:flex lg:max-w-[1280px] lg:flex-col lg:gap-5 lg:px-8 lg:pb-20 lg:pt-6">
      {children}
      <MobileBottomNav />
    </div>
  );
}
