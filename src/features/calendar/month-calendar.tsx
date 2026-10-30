"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ISODate } from "@/domain/types";
import { cn } from "@/lib/cn";
import { KIND_COLOR, KIND_LABEL, MONTHS, longDayLabel, monthGrid, type CalItem, type CalKind } from "./calendar-model";

const CHIP: Record<CalKind, string> = {
  deadline: "bg-danger-soft text-danger",
  opens: "bg-info-soft text-info",
  event: "bg-social-soft text-social",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthCalendarProps {
  year: number;
  month: number;
  today: ISODate;
  selected: ISODate | null;
  byDate: Map<ISODate, CalItem[]>;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (iso: ISODate) => void;
}

function dayAria(iso: ISODate, items: CalItem[], today: ISODate) {
  const [, m, d] = iso.split("-").map(Number);
  let label = `${d} ${MONTHS[m - 1]}`;
  if (items.length) label += `, ${items.length} saved item${items.length > 1 ? "s" : ""}`;
  if (iso === today) label += ", today";
  return label;
}

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3.5 text-[11px] text-muted lg:gap-[18px] lg:text-xs", className)}>
      {(Object.keys(KIND_COLOR) as CalKind[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-[5px] lg:gap-1.5">
          <span className="size-[7px] rounded-full lg:size-2" style={{ background: KIND_COLOR[k] }} />
          {KIND_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

/** Monthly grid. Mobile shows a dot per kind; desktop shows up to two chips per day. */
export function MonthCalendar({ year, month, today, selected, byDate, onPrev, onNext, onSelect }: MonthCalendarProps) {
  const weeks = monthGrid(year, month);
  const label = `${MONTHS[month]} ${year}`;

  return (
    <div className="rounded-[18px] border border-line bg-surface px-2.5 py-3 shadow-card lg:rounded-2xl lg:px-[18px] lg:pb-[18px] lg:pt-4">
      {/* Month header */}
      <div className="flex items-center justify-between px-0.5 pb-2 lg:gap-2 lg:pb-3">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-chip lg:order-2 lg:size-10 lg:rounded-[10px] lg:border lg:border-line"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 aria-live="polite" className="text-base font-semibold lg:order-1 lg:flex-1 lg:text-xl lg:tracking-[-0.01em]">
          {label}
        </h2>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-chip lg:order-3 lg:size-10 lg:rounded-[10px] lg:border lg:border-line"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-muted lg:pb-1.5 lg:text-left lg:text-xs">
        {WEEKDAYS.map((d) => (
          <span key={d} className="lg:pl-2">
            <span className="lg:hidden">{d.slice(0, 2)}</span>
            <span className="hidden lg:inline">{d}</span>
          </span>
        ))}
      </div>

      {/* Mobile grid: number + dots */}
      <div className="lg:hidden">
        {weeks.map((week) => (
          <div key={week[0].iso} className="grid grid-cols-7">
            {week.map((d) => {
              const items = byDate.get(d.iso) ?? [];
              const kinds = [...new Set(items.map((i) => i.kind))];
              const isSel = selected === d.iso;
              const isToday = d.iso === today;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => onSelect(d.iso)}
                  aria-label={dayAria(d.iso, items, today)}
                  aria-pressed={isSel}
                  className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg"
                >
                  <span
                    className={cn(
                      "flex h-7 w-8 items-center justify-center rounded-full text-sm tabular-nums",
                      isSel
                        ? "bg-primary font-bold text-white"
                        : isToday
                          ? "font-bold text-primary-hover shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
                          : cn(d.inMonth ? "text-ink" : "text-[#a8a29e]", items.length > 0 && "font-bold"),
                    )}
                  >
                    {d.day}
                  </span>
                  <span className="flex h-[5px] gap-0.5" aria-hidden="true">
                    {kinds.map((k) => (
                      <span key={k} className="size-[5px] rounded-full" style={{ background: KIND_COLOR[k] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Desktop grid: number + chips */}
      <div className="hidden border-l border-t border-line-soft lg:block">
        {weeks.map((week) => (
          <div key={week[0].iso} className="grid grid-cols-7">
            {week.map((d) => {
              const items = byDate.get(d.iso) ?? [];
              const isSel = selected === d.iso;
              const isToday = d.iso === today;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => onSelect(d.iso)}
                  aria-label={dayAria(d.iso, items, today)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex h-[104px] min-w-0 flex-col items-start gap-[3px] overflow-hidden border-b border-r border-line-soft p-1.5 text-left",
                    isSel ? "bg-primary-tint shadow-[inset_0_0_0_2px_var(--color-primary)]" : d.inMonth ? "bg-surface hover:bg-canvas" : "bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 flex-none items-center justify-center rounded-full text-[13px] tabular-nums",
                      isSel
                        ? "bg-primary font-bold text-white"
                        : isToday
                          ? "font-bold text-primary-hover shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
                          : d.inMonth
                            ? "font-medium text-ink"
                            : "text-[#a8a29e]",
                    )}
                  >
                    {d.day}
                  </span>
                  {items.slice(0, 2).map((it, i) => (
                    <span
                      key={`${it.companyId}-${it.label}-${i}`}
                      className={cn("block w-full truncate rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold leading-[1.35]", CHIP[it.kind])}
                    >
                      {it.initials} · {it.label}
                    </span>
                  ))}
                  {items.length > 2 && <span className="pl-1 text-[11px] font-semibold text-muted">+{items.length - 2} more</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <Legend className="justify-center pt-2 lg:hidden" />
      <div className="hidden items-center pt-3 lg:flex">
        <Legend />
        <span className="ml-auto text-xs text-muted">
          Only dates stated in your photos or verified pages. Undated items stay in the list below.
        </span>
      </div>
    </div>
  );
}

/** What falls on the selected day. */
export function SelectedDatePanel({
  selected,
  items,
  hasSaved,
}: {
  selected: ISODate | null;
  items: CalItem[];
  hasSaved: boolean;
}) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-3.5 py-3 lg:gap-3 lg:p-[18px]"
    >
      {selected ? (
        <>
          <div className="hidden text-xs font-semibold uppercase tracking-[0.04em] text-muted lg:block">Selected date</div>
          <div className="text-[13px] font-semibold lg:-mt-1.5 lg:text-lg">{longDayLabel(selected)}</div>
          {items.length === 0 ? (
            <div className="text-[13px] text-muted lg:text-sm">Nothing from your saved companies on this date.</div>
          ) : (
            items.map((it, i) => (
              <div
                key={`${it.companyId}-${it.label}-${i}`}
                className="flex items-start gap-2.5 lg:rounded-xl lg:border lg:border-line-soft lg:bg-canvas lg:px-3 lg:py-2.5"
              >
                <span className="mt-1.5 size-2 flex-none rounded-full lg:mt-[7px]" style={{ background: KIND_COLOR[it.kind] }} />
                {/* Mobile: one line */}
                <span className="min-w-0 flex-1 text-[13px] lg:hidden">
                  <b className="font-semibold">{it.companyName}</b> · {it.label}
                  {it.uncertain && <span className="text-warning-ink"> · date needs a check</span>}
                </span>
                <span className="flex-none text-[11px] font-semibold lg:hidden" style={{ color: KIND_COLOR[it.kind] }}>
                  {it.closed ? "Closed" : KIND_LABEL[it.kind]}
                </span>
                {/* Desktop: stacked */}
                <span className="hidden min-w-0 flex-1 lg:block">
                  <span className="block text-xs font-semibold" style={{ color: KIND_COLOR[it.kind] }}>
                    {it.closed ? "Closed" : KIND_LABEL[it.kind]}
                  </span>
                  <span className="block font-semibold">{it.label}</span>
                  <span className="block text-[13px] text-muted">
                    {it.companyName}
                    {it.uncertain && <span className="text-warning-ink"> · date needs a check</span>}
                  </span>
                </span>
              </div>
            ))
          )}
        </>
      ) : (
        <div className="text-[13px] text-muted lg:text-sm">
          {hasSaved ? "Tap a marked date to see what’s due." : "Dates appear here once you add companies."}
        </div>
      )}
    </section>
  );
}
