"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { cancelBatch, mergeIntoCompanies, retryPhotos } from "./batch-runner";
import { ExtractionCard } from "./extraction-card";
import { DiscoveredList, LinkList, LinkTypeChips, PhotoStatusTile, PhotoThumb, StageTracker, type GroupingStage } from "./processing-parts";
import { photoState, summarizeBatch } from "./summarize-batch";
import { useBatchData } from "./use-batch-data";

export function BatchScreen({ batchId }: { batchId: string }) {
  const data = useBatchData(batchId);
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  if (data.state === "loading") {
    return <div className="p-8 text-center text-muted" aria-busy="true">Loading batch…</div>;
  }
  if (data.state === "missing") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">This batch isn&apos;t on this device</h1>
        <p className="text-muted">It may have been cancelled, or saved in another browser. Batches are stored only where they were uploaded.</p>
        <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-[10px] bg-primary px-5 font-semibold text-white">
          Add photos
        </Link>
      </div>
    );
  }

  const { batch, photos, extractions, openReview, companyCount, groupedNames } = data;
  const summary = summarizeBatch(photos, extractions, groupedNames);
  const processing = batch.status === "processing" && !summary.finished;
  const percent = summary.total ? Math.round(((summary.read + summary.failed) / summary.total) * 100) : 0;
  const allFailed = summary.finished && summary.read === 0;

  const onCancel = async () => {
    const msg = processing
      ? `Stop and remove Batch ${batch.number}? Photos already read in this batch are removed too. Your earlier batches stay as they are.`
      : `Remove Batch ${batch.number} and its ${summary.total} photos from this device? Your earlier batches stay as they are.`;
    if (!window.confirm(msg)) return;
    setCancelling(true);
    await cancelBatch(batch.id);
    router.push("/");
  };

  const title = processing
    ? `Organizing ${summary.total} ${summary.total === 1 ? "photo" : "photos"}`
    : allFailed
      ? "We couldn't read this batch"
      : `Read ${summary.read} of ${summary.total} ${summary.total === 1 ? "photo" : "photos"}`;

  const grouped = batch.status === "done" || batch.status === "needs_review";
  const companiesText = `${companyCount} ${companyCount === 1 ? "company" : "companies"}`;
  const grouping: GroupingStage = grouped
    ? { state: "done", detail: openReview ? `${companiesText} · ${openReview} to check` : companiesText }
    : allFailed
      ? { state: "next", detail: "Nothing to group yet" }
      : batch.error
      ? { state: "warn", detail: batch.error }
      : { state: "active", detail: "Matching to your companies" };

  const subtitle = processing
    ? "You can leave this page. Progress is saved on this device."
    : allFailed
      ? batch.error ?? "None of the photos could be read."
      : grouped
        ? openReview
          ? `Grouped into ${companiesText}. ${openReview} ${openReview === 1 ? "thing needs" : "things need"} your input.`
          : `Grouped into ${companiesText}. Everything else was organized automatically.`
        : batch.error ?? "Grouping them into your companies…";

  const failedPhotos = photos.filter((p) => p.status === "failed");
  // After a successful batch, the next stop is Companies.
  const canContinue = !processing && summary.read > 0 && (grouped || !!batch.error);
  const primaryCta = "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white shadow-cta hover:bg-primary-hover lg:h-10 lg:rounded-lg lg:px-4 lg:text-sm";
  const secondaryCta = "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-canvas lg:h-10 lg:rounded-lg lg:px-4 lg:text-sm";
  const continueLink = !grouped ? (
    <button type="button" onClick={() => mergeIntoCompanies(batch.id)} className={primaryCta}>
      Try grouping again
    </button>
  ) : openReview ? (
    <>
      <Link href="/companies" className={secondaryCta}>
        Continue to companies
      </Link>
      <Link href="/review" className={primaryCta}>
        Review {openReview} {openReview === 1 ? "item" : "items"}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </>
  ) : (
    <Link href="/companies" className={primaryCta}>
      Continue to companies
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-[560px] pb-12 lg:max-w-[1200px] lg:px-8 lg:pb-20 lg:pt-9">
      {/* Mobile header (M3) */}
      <header className="flex h-14 items-center justify-between pl-4 pr-2 lg:hidden">
        <BatchPill number={batch.number} processing={processing} failed={allFailed} />
        {/* Once grouped, the photos are evidence for companies, so the batch can't be removed from here. */}
        {!grouped && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="inline-flex h-12 items-center px-2.5 font-medium text-ink-2 disabled:opacity-50"
          >
            {processing ? "Cancel" : "Remove"}
          </button>
        )}
      </header>

      <div className="flex flex-col gap-4 px-4 pt-1 lg:gap-6 lg:px-0 lg:pt-0">
        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="hidden lg:block">
              <BatchPill number={batch.number} processing={processing} failed={allFailed} />
            </span>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] lg:text-[30px]">{title}</h1>
            <p className={cn("text-[13px] lg:text-sm", allFailed ? "text-danger" : "text-muted")}>{subtitle}</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            {!grouped && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-3.5 font-medium text-ink-2 hover:bg-canvas disabled:opacity-50"
              >
                {processing ? "Cancel" : "Remove batch"}
              </button>
            )}
            {canContinue && continueLink}
          </div>
        </div>
        {canContinue && <div className="flex flex-col-reverse gap-2 lg:hidden">{continueLink}</div>}

        {/* Progress + stages */}
        <section className="flex flex-col gap-3 lg:gap-5 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:px-6 lg:py-5 lg:shadow-card">
          <div className="flex items-center gap-2.5 lg:gap-3.5">
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-primary-soft lg:h-2"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Photos processed"
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", processing ? "bg-lens-shimmer animate-shimmer" : allFailed ? "bg-warning" : "bg-success-dot")}
                style={{ width: `${Math.max(percent, processing ? 4 : 0)}%` }}
              />
            </div>
            <span className="font-semibold tabular-nums">{percent}%</span>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-3.5 py-3 lg:rounded-none lg:border-0 lg:p-0">
            <StageTracker summary={summary} grouping={grouping} />
          </div>
        </section>

        {failedPhotos.length > 0 && !processing && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-line bg-warning-soft px-3.5 py-3 text-[13px] text-warning-ink">
            <AlertTriangle size={16} className="flex-none" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <b className="font-semibold">
                {failedPhotos.length} {failedPhotos.length === 1 ? "photo" : "photos"} couldn&apos;t be read.
              </b>{" "}
              {failedPhotos[0].error?.message}
            </span>
            <button
              type="button"
              onClick={() => retryPhotos(batch.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-warning-line bg-surface px-3 font-semibold text-ink hover:bg-canvas"
            >
              <RotateCw size={14} aria-hidden="true" />
              Retry {failedPhotos.length === 1 ? "photo" : "failed photos"}
            </button>
          </div>
        )}

        {/* Mobile photo strip */}
        <div className="-mr-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {photos.map((p) => {
            const state = photoState(p, extractions.get(p.id));
            return (
              <div key={p.id} className="relative w-[60px] flex-none overflow-hidden rounded-[9px] border border-line">
                <PhotoThumb photo={p} />
                {state === "reading" && (
                  <div className="animate-scan absolute inset-x-0 h-[30%] bg-[linear-gradient(180deg,rgba(99,102,241,0),rgba(6,182,212,0.7))]" />
                )}
                <span
                  className={cn(
                    "absolute bottom-1 right-1 size-3.5 rounded-full border-2 border-white",
                    state === "done" && "bg-success-dot",
                    state === "reading" && "bg-primary",
                    state === "queued" && "bg-line-strong",
                    (state === "retrying" || state === "no_company" || state === "not_recruitment") && "bg-warning-dash",
                    state === "failed" && "bg-danger-dot",
                  )}
                  title={state}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* Desktop photo grid */}
          <section className="hidden min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-[14px] border border-line bg-surface px-6 pb-6 pt-5 shadow-card lg:flex">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Photos</h2>
              {batch.skippedDuplicateCount > 0 && (
                <span className="text-[13px] text-muted">
                  {batch.skippedDuplicateCount} {batch.skippedDuplicateCount === 1 ? "duplicate" : "duplicates"} skipped before upload
                </span>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
              {photos.map((p, i) => (
                <PhotoStatusTile key={p.id} photo={p} index={i} state={photoState(p, extractions.get(p.id))} extraction={extractions.get(p.id)} />
              ))}
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <Panel title="QR codes and links">
              <LinkTypeChips counts={summary.linkCounts} />
              <div className="hidden lg:block">
                <LinkList links={summary.links} />
              </div>
            </Panel>
            <Panel title={processing ? "Discovered so far" : "Discovered"} live={processing}>
              <DiscoveredList items={summary.discovered} />
            </Panel>
          </aside>
        </div>

        {/* Results */}
        {summary.read + summary.failed > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3">
              <h2 className="text-lg font-semibold">What we read</h2>
              <span className="text-xs text-muted">Values marked Check were hard to read. Nothing is filled in that wasn&apos;t printed.</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              {photos.map((p, i) =>
                p.status === "done" || p.status === "failed" ? (
                  <ExtractionCard key={p.id} photo={p} index={i} extraction={extractions.get(p.id)} />
                ) : null,
              )}
            </div>
          </section>
        )}

        {!processing && (
          <div className="flex flex-col items-center gap-2 pt-2 text-center text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-success" aria-hidden="true" />
              Saved on this device.
            </span>
            <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover">
              <ArrowLeft size={14} aria-hidden="true" />
              Add another batch
            </Link>
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <p className="mt-8 text-center text-[13px] text-muted">Photos are read by Google Gemini and saved on this device only.</p>
      </div>
    </div>
  );
}

function BatchPill({ number, processing, failed }: { number: number; processing: boolean; failed: boolean }) {
  if (processing) {
    return (
      <span className="bg-lens-shimmer animate-shimmer inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold text-white">
        <Sparkles size={11} fill="#fff" stroke="none" aria-hidden="true" />
        AI at work · Batch {number}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-semibold",
        failed ? "border-warning-line bg-warning-soft text-warning-ink" : "border-success-line bg-success-soft text-success",
      )}
    >
      Batch {number} · {failed ? "not read" : "read"}
    </span>
  );
}

function Panel({ title, live, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:p-5 lg:shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold lg:text-base">{title}</h2>
        {live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-hover">
            <span className="size-1.5 rounded-full bg-lens-from" />
            Live
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

