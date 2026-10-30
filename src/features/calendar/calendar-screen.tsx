"use client";

import { useCallback, useMemo, useState } from "react";
import type { ISODate } from "@/domain/types";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { buildCompanyViews } from "@/features/companies/company-model";
import { removeInterests, saveCompanies } from "@/lib/db/interests";
import { useLibrary } from "@/lib/db/use-library";
import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-mounted";
import { collectCalendarItems, groupByDate, localIso } from "./calendar-model";
import { MonthCalendar, SelectedDatePanel } from "./month-calendar";
import { AddCompaniesPanel, EditRow, InterestedCard, NoSavedCompanies } from "./interested-section";

/**
 * My Calendar: one page. Monthly calendar on top, Interested companies below.
 * Everything is derived from saved company ids + stored opportunities/events.
 */
export function CalendarScreen() {
  const mounted = useMounted();
  return mounted ? <CalendarBody /> : <CalendarLoading />;
}

function CalendarLoading() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading your calendar" className="flex flex-col gap-3.5">
        <div className="h-[372px] animate-pulse rounded-[18px] bg-chip lg:h-[740px]" />
        <div className="h-24 animate-pulse rounded-2xl bg-chip" />
      </div>
    </Shell>
  );
}

function CalendarBody() {
  const data = useLibrary();
  const [now] = useState(() => new Date());
  const today = localIso(now);

  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<ISODate | null>(null);
  const [mode, setMode] = useState<"normal" | "edit">("normal");
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const views = useMemo(() => (data.state === "ready" ? buildCompanyViews(data.library, now) : []), [data, now]);
  const saved = useMemo(() => views.filter((v) => v.saved).sort((a, b) => a.name.localeCompare(b.name)), [views]);
  const byDate = useMemo(() => groupByDate(collectCalendarItems(saved)), [saved]);

  const openAdd = useCallback(() => {
    setQuery("");
    setAdded(new Set());
    setAddOpen(true);
  }, []);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  if (data.state === "loading") return <CalendarLoading />;
  if (data.state === "error") {
    return (
      <Shell>
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {data.message}
        </p>
      </Shell>
    );
  }

  const isEdit = mode === "edit";
  const selectedItems = selected ? (byDate.get(selected) ?? []) : [];

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError("Couldn't save that change on this device. Please try again.");
    }
  };

  const onAdd = (id: string) =>
    run(async () => {
      await saveCompanies([id]);
      setAdded((s) => new Set(s).add(id));
    });

  const onRemove = () =>
    run(async () => {
      if (toRemove.size === 0) return;
      await removeInterests([...toRemove]);
      setToRemove(new Set());
      setMode("normal");
    });

  const removeCount = toRemove.size;

  return (
    <Shell>
      {error && (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Monthly calendar (+ selected date) */}
      <section aria-label="Monthly calendar" className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-5">
        <div className="min-w-0 lg:flex-[999_1_640px]">
          <MonthCalendar
            year={view.y}
            month={view.m}
            today={today}
            selected={selected}
            byDate={byDate}
            onPrev={() => setView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
            onNext={() => setView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
            onSelect={setSelected}
          />
        </div>
        <div className="min-w-0 lg:flex-[1_1_300px]">
          <SelectedDatePanel selected={selected} items={selectedItems} hasSaved={saved.length > 0} />
        </div>
      </section>

      {/* Interested companies */}
      <section aria-label="Interested companies" className="flex flex-col gap-2.5 pt-1 lg:gap-3.5 lg:pt-0">
        <div className="flex min-h-10 flex-wrap items-center gap-2 lg:gap-3">
          <h2 className="text-[17px] font-semibold lg:text-xl lg:tracking-[-0.01em]">
            {isEdit ? "Select to remove" : "Interested companies"}
          </h2>
          <span className="hidden text-[13px] text-muted lg:inline">
            {isEdit ? (removeCount ? `${removeCount} selected` : "None selected") : saved.length ? `${saved.length} saved` : ""}
          </span>
          <span className="flex-1" />
          {isEdit ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-[13px] text-muted lg:inline">Removes from My Calendar only. Nothing is deleted from Companies.</span>
              <SmallButton onClick={() => (setMode("normal"), setToRemove(new Set()))}>Cancel</SmallButton>
              <button
                type="button"
                onClick={onRemove}
                disabled={removeCount === 0}
                className="hidden h-[38px] rounded-lg bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 lg:inline-block"
              >
                {removeCount ? `Remove selected (${removeCount})` : "Remove selected"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openAdd}
                className="h-[38px] rounded-[10px] border border-primary-line bg-primary-soft px-3.5 text-sm font-semibold text-primary-hover hover:bg-[#e0e7ff] lg:rounded-lg"
              >
                + Add
              </button>
              <SmallButton onClick={() => (setMode("edit"), setToRemove(new Set()))} disabled={saved.length === 0}>
                Edit
              </SmallButton>
            </div>
          )}
        </div>

        {!isEdit && saved.length === 0 && <NoSavedCompanies onAdd={openAdd} />}

        {!isEdit && saved.length > 0 && (
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] lg:items-start lg:gap-4">
            {saved.map((c) => (
              <InterestedCard key={c.id} company={c} today={today} selected={selected} />
            ))}
          </div>
        )}

        {isEdit && (
          <>
            <p className="text-xs text-muted lg:hidden">
              Removes companies from My Calendar only. Their photos, details and your edits stay in Companies.
            </p>
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] lg:gap-3">
              {saved.map((c) => (
                <EditRow
                  key={c.id}
                  company={c}
                  today={today}
                  selected={toRemove.has(c.id)}
                  onToggle={() =>
                    setToRemove((s) => {
                      const next = new Set(s);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <div className="flex gap-2.5 pt-1 lg:hidden">
              <button
                type="button"
                onClick={() => (setMode("normal"), setToRemove(new Set()))}
                className="h-[50px] flex-1 rounded-[13px] border border-line-strong bg-surface text-[15px] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={removeCount === 0}
                className="h-[50px] flex-[1.4] rounded-[13px] bg-danger text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {removeCount ? `Remove selected (${removeCount})` : "Remove selected"}
              </button>
            </div>
          </>
        )}
      </section>

      <AddCompaniesPanel
        open={addOpen}
        companies={views}
        today={today}
        query={query}
        addedThisSession={added}
        onQuery={setQuery}
        onAdd={onAdd}
        onClose={closeAdd}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[560px] lg:max-w-[1280px]">
      <header className="flex h-14 items-center border-b border-line bg-surface px-4 lg:hidden">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">My Calendar</h1>
      </header>
      <main className="flex flex-col gap-3.5 px-4 pt-3.5 lg:gap-7 lg:px-8 lg:pb-20 lg:pt-7">
        <h1 className="hidden text-[28px] font-semibold tracking-[-0.02em] lg:block">My Calendar</h1>
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}

function SmallButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-[38px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-canvas lg:rounded-lg",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      {children}
    </button>
  );
}
