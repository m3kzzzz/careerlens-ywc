"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { OpportunityType, RecruitmentStatus } from "@/domain/types";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { DEFAULT_FILTERS, type ActionKind, type CompanyFilters, type CompanyView } from "./company-model";

export const STATUS_META: Record<RecruitmentStatus, { label: string; hint: string; badge: string; chip: string; dot: string }> = {
  open: {
    label: "Open",
    hint: "Accepting applications now",
    badge: "border border-success-line bg-success-soft text-success",
    chip: "border-success-line text-success",
    dot: "bg-success-dot",
  },
  upcoming: {
    label: "Upcoming",
    hint: "Announced, not open yet",
    badge: "border border-info-line bg-info-soft text-info",
    chip: "border-info-line text-info",
    dot: "bg-[#2563eb]",
  },
  closed: {
    label: "Closed",
    hint: "Deadline stated and passed",
    badge: "border border-line bg-chip text-ink-3",
    chip: "border-line text-ink-3",
    dot: "bg-[#a8a29e]",
  },
  not_specified: {
    label: "Not specified",
    hint: "No status in the sources",
    badge: "border border-dashed border-line-strong text-muted",
    chip: "border-dashed border-line-strong text-muted",
    dot: "",
  },
};

export const ACTION_META: Record<Exclude<ActionKind, "learn">, { label: string; cls: string }> = {
  apply: { label: "Apply online", cls: "border-primary-line text-primary-hover" },
  careers: { label: "Explore careers page", cls: "border-updated-line text-updated" },
  event: { label: "Attend an event", cls: "border-social-line text-social" },
  contact: { label: "Contact a recruiter", cls: "border-success-line text-success" },
};

export const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  graduate_program: "Graduate program",
  program_camp: "Program / camp",
  other: "Other",
};

const STATUSES: RecruitmentStatus[] = ["open", "upcoming", "closed", "not_specified"];

export interface FilterCounts {
  status: Record<RecruitmentStatus, number>;
  actions: Record<string, number>;
  types: [OpportunityType, number][];
  industries: [string, number][];
  withoutPositions: number;
}

export function filterCounts(views: CompanyView[]): FilterCounts {
  const status: Record<RecruitmentStatus, number> = { open: 0, upcoming: 0, closed: 0, not_specified: 0 };
  const actions: Record<string, number> = {};
  const types = new Map<OpportunityType, number>();
  const industries = new Map<string, number>();
  for (const c of views) {
    for (const o of c.opps) {
      status[o.status] += 1;
      if (o.type) types.set(o.type, (types.get(o.type) ?? 0) + 1);
    }
    for (const a of c.actions) actions[a] = (actions[a] ?? 0) + 1;
    if (c.industry) industries.set(c.industry, (industries.get(c.industry) ?? 0) + 1);
  }
  return {
    status,
    actions,
    types: [...types.entries()].sort((a, b) => b[1] - a[1]),
    industries: [...industries.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    withoutPositions: views.filter((v) => v.opps.length === 0).length,
  };
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-[38px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium lg:h-[34px]",
        on ? "border-primary bg-primary-soft text-primary-hover" : cn("bg-surface text-ink-2 hover:bg-canvas", className ?? "border-line"),
      )}
    >
      {on && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </button>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <legend className="mb-2 text-xs font-bold tracking-[0.05em] text-muted">{children}</legend>;
}

function ActionChips({ f, counts, onChange }: { f: CompanyFilters; counts: FilterCounts; onChange: (f: CompanyFilters) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(ACTION_META) as (keyof typeof ACTION_META)[]).map((a) => (
        <Chip key={a} on={f.actions.includes(a)} className={ACTION_META[a].cls} onClick={() => onChange({ ...f, actions: toggle(f.actions, a) })}>
          {ACTION_META[a].label} · {counts.actions[a] ?? 0}
        </Chip>
      ))}
    </div>
  );
}

function TypeChips({ f, counts, onChange }: { f: CompanyFilters; counts: FilterCounts; onChange: (f: CompanyFilters) => void }) {
  if (!counts.types.length) return <p className="text-[13px] text-muted">No opportunity types found yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {counts.types.map(([t, n]) => (
        <Chip key={t} on={f.types.includes(t)} onClick={() => onChange({ ...f, types: toggle(f.types, t) })}>
          {TYPE_LABEL[t]} · {n}
        </Chip>
      ))}
    </div>
  );
}

function IndustryChips({ f, counts, onChange }: { f: CompanyFilters; counts: FilterCounts; onChange: (f: CompanyFilters) => void }) {
  if (!counts.industries.length) return <p className="text-[13px] text-muted">No industries found yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {counts.industries.map(([i, n]) => (
        <Chip key={i} on={f.industries.includes(i)} onClick={() => onChange({ ...f, industries: toggle(f.industries, i) })}>
          {i} · {n}
        </Chip>
      ))}
    </div>
  );
}

function IncludeSwitch({ f, counts, onChange, compact }: { f: CompanyFilters; counts: FilterCounts; onChange: (f: CompanyFilters) => void; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={f.includeWithoutPositions}
        onClick={() => onChange({ ...f, includeWithoutPositions: !f.includeWithoutPositions })}
        className={cn(
          "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
          f.includeWithoutPositions ? "border-primary-line bg-primary-soft text-primary-hover" : "border-line bg-surface text-ink-2",
        )}
      >
        {f.includeWithoutPositions && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
        Include companies without positions
      </button>
    );
  }
  return (
    <label className="relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-line-soft bg-canvas px-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Include companies with no positions</span>
        <span className="block text-xs text-muted">Company info, contacts and links only · {counts.withoutPositions}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={f.includeWithoutPositions}
        onChange={() => onChange({ ...f, includeWithoutPositions: !f.includeWithoutPositions })}
        className="peer absolute size-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[26px] w-11 flex-none rounded-full p-[3px] peer-focus-visible:outline-2 peer-focus-visible:outline-primary",
          f.includeWithoutPositions ? "justify-end bg-primary" : "justify-start bg-line-strong",
        )}
      >
        <span className="size-5 rounded-full bg-white" />
      </span>
    </label>
  );
}

/** Mobile filters (M7) as a bottom sheet. Desktop opens the same panel at the side. */
export function FiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  counts,
  resultCount,
  resultNoun,
}: {
  open: boolean;
  onClose: () => void;
  filters: CompanyFilters;
  onChange: (f: CompanyFilters) => void;
  counts: FilterCounts;
  resultCount: number;
  resultNoun: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Filters" className="h-[760px] lg:h-auto">
      <div className="flex items-center justify-between pb-1 pl-4 pr-2 pt-0.5 lg:pt-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="h-11 px-2.5 font-medium text-primary">
          Reset
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-4">
        <fieldset>
          <legend className="text-xs font-bold tracking-[0.05em] text-muted">RECRUITMENT STATUS</legend>
          <p className="mb-1.5 mt-0.5 text-xs text-muted">Set only when a brochure or linked page says so. Everything else is “Not specified”.</p>
          {STATUSES.map((s) => (
            <label key={s} className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-chip">
              <span className={cn("rounded-full px-[9px] py-px text-xs font-semibold", STATUS_META[s].badge)}>{STATUS_META[s].label}</span>
              <span className="min-w-0 flex-1 text-xs text-muted">{STATUS_META[s].hint}</span>
              <span className="text-[13px] text-muted">{counts.status[s]}</span>
              <input
                type="checkbox"
                checked={filters.statuses.includes(s)}
                onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
                className="size-[22px] accent-primary"
              />
            </label>
          ))}
        </fieldset>
        <IncludeSwitch f={filters} counts={counts} onChange={onChange} />
        <fieldset>
          <Legend>WHAT I CAN DO</Legend>
          <ActionChips f={filters} counts={counts} onChange={onChange} />
        </fieldset>
        <fieldset>
          <Legend>OPPORTUNITY TYPE</Legend>
          <TypeChips f={filters} counts={counts} onChange={onChange} />
        </fieldset>
        <fieldset>
          <Legend>INDUSTRY</Legend>
          <IndustryChips f={filters} counts={counts} onChange={onChange} />
        </fieldset>
      </div>
      <div className="border-t border-line-soft px-4 pb-6 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-[54px] w-full items-center justify-center rounded-[14px] bg-primary text-base font-semibold text-white hover:bg-primary-hover"
        >
          Show {resultCount} {resultNoun}
        </button>
      </div>
    </Sheet>
  );
}

/** Desktop dropdown holding one filter group. */
function FilterMenu({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px]",
          count ? "border-primary-line bg-primary-soft font-medium text-primary-hover" : "border-line bg-surface text-ink-2 hover:bg-canvas",
        )}
      >
        {label}
        {count > 0 && ` · ${count}`}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[340px] rounded-[10px] border border-line bg-surface p-3 shadow-popover">
          {children}
        </div>
      )}
    </div>
  );
}

/** Desktop filter row (D4): status chips, grouped menus, and the include toggle. */
export function DesktopFilterRow({
  filters,
  onChange,
  counts,
}: {
  filters: CompanyFilters;
  onChange: (f: CompanyFilters) => void;
  counts: FilterCounts;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-0.5 text-xs font-bold tracking-[0.05em] text-muted">STATUS</span>
      {STATUSES.map((s) => {
        const on = filters.statuses.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
            className={cn(
              "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
              on ? "border-primary bg-primary-soft text-primary-hover" : cn("bg-surface hover:bg-canvas", STATUS_META[s].chip),
            )}
          >
            {on ? <Check size={13} strokeWidth={2.6} aria-hidden="true" /> : STATUS_META[s].dot && <span className={cn("size-[7px] rounded-full", STATUS_META[s].dot)} />}
            {STATUS_META[s].label} · {counts.status[s]}
          </button>
        );
      })}
      <span className="mx-0.5 h-[22px] w-px bg-line" aria-hidden="true" />
      <FilterMenu label="Industry" count={filters.industries.length}>
        <IndustryChips f={filters} counts={counts} onChange={onChange} />
      </FilterMenu>
      <FilterMenu label="Opportunity type" count={filters.types.length}>
        <TypeChips f={filters} counts={counts} onChange={onChange} />
      </FilterMenu>
      <FilterMenu label="What I can do" count={filters.actions.length}>
        <ActionChips f={filters} counts={counts} onChange={onChange} />
      </FilterMenu>
      <IncludeSwitch f={filters} counts={counts} onChange={onChange} compact />
    </div>
  );
}
