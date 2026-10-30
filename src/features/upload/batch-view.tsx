"use client";

import { ArrowRight, ImageIcon, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/upload/constants";
import type { LibrarySummary } from "@/lib/db/queries";
import type { SkipMessage } from "@/lib/upload/skip-messages";
import type { DraftPhoto } from "./batch-draft-context";
import { FilePicker } from "./file-picker";
import { PhotoTile } from "./photo-tile";
import { SkipNotices } from "./skip-notices";
import { SlotBar } from "./slot-meter";
import { useFileDrop } from "./use-file-drop";

export interface BatchViewProps {
  batchNumber: number;
  photos: DraftPhoto[];
  summary: LibrarySummary | undefined;
  adding: boolean;
  messages: SkipMessage[];
  /** Shown under the Organize button, e.g. when organizing isn't available. */
  organizeNote: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onCancel: () => void;
  onOrganize: () => void;
  onDismissMessages: () => void;
}

/** Batch with photos: M2 on mobile, D1b on desktop. */
export function BatchView(props: BatchViewProps) {
  return (
    <>
      <BatchMobile {...props} />
      <BatchDesktop {...props} />
    </>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function mergeCaption(summary: LibrarySummary | undefined) {
  return summary && summary.companyCount > 0
    ? `Merges into your ${plural(summary.companyCount, "company", "companies")} · add another batch anytime`
    : "You can add another batch anytime";
}

function BatchMobile({
  batchNumber,
  photos,
  summary,
  adding,
  messages,
  organizeNote,
  onFiles,
  onRemove,
  onCancel,
  onOrganize,
  onDismissMessages,
}: BatchViewProps) {
  const slotsLeft = MAX_PHOTOS_PER_BATCH - photos.length;
  const full = slotsLeft === 0;

  return (
    <div className="mx-auto w-full max-w-[560px] lg:hidden">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface pl-1 pr-1.5">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel batch"
          className="flex size-12 items-center justify-center rounded-xl text-ink active:bg-chip"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold">Batch {batchNumber}</span>
        <span className="w-12 text-center text-[13px] font-semibold text-primary-hover">
          {photos.length}/{MAX_PHOTOS_PER_BATCH}
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3.5">
        <div className="flex flex-col gap-2">
          <SlotBar used={photos.length} />
          <span className="text-[13px] text-muted" aria-live="polite">
            {adding
              ? "Checking photos…"
              : full
                ? "Batch is full. Organize it, then start another."
                : `Different companies in one batch is fine. ${plural(slotsLeft, "slot")} left.`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <PhotoTile key={p.id} photo={p} index={i} onRemove={onRemove} variant="mobile" />
          ))}
          {!full && (
            <>
              <FilePicker
                mode="library"
                onFiles={onFiles}
                disabled={adding}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-primary-dash bg-primary-tint text-[13px] font-semibold text-primary-hover active:bg-primary-soft aria-disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon size={22} strokeWidth={1.9} aria-hidden="true" />
                )}
                Add photos
              </FilePicker>
            </>
          )}
        </div>

        <SkipNotices messages={messages} onDismiss={onDismissMessages} />
      </div>

      {/* Spacer for the sticky action bar. */}
      <div aria-hidden="true" className="h-[132px]" />

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2 px-4 pb-6 pt-3">
          <OrganizeButton count={photos.length} disabled={adding} onClick={onOrganize} variant="mobile" />
          <span className={cn("text-center text-xs", organizeNote ? "text-warning-ink" : "text-muted")} aria-live="polite">
            {organizeNote ?? mergeCaption(summary)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BatchDesktop({
  batchNumber,
  photos,
  adding,
  messages,
  organizeNote,
  onFiles,
  onRemove,
  onCancel,
  onOrganize,
  onDismissMessages,
}: BatchViewProps) {
  const slotsLeft = MAX_PHOTOS_PER_BATCH - photos.length;
  const { isDragging, handlers } = useFileDrop(onFiles, !adding && slotsLeft > 0);

  return (
    <main className="mx-auto hidden max-w-[1040px] flex-col gap-6 px-8 pb-20 pt-10 lg:flex">
      <section
        aria-label={`Batch ${batchNumber}`}
        {...handlers}
        className={cn(
          "overflow-hidden rounded-[18px] border bg-surface shadow-panel transition-colors",
          isDragging ? "border-primary ring-4 ring-primary-soft" : "border-line",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-6 py-[22px]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-semibold tracking-[-0.015em]">Batch {batchNumber} is ready</h1>
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-hover">
                {photos.length} / {MAX_PHOTOS_PER_BATCH} photos
              </span>
            </div>
            <span className="text-sm text-muted">
              Any mix of companies is fine. We&apos;ll sort them and merge into your dashboard.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-lg px-3 font-medium text-ink-2 hover:bg-chip"
            >
              Clear batch
            </button>
            <OrganizeButton count={photos.length} disabled={adding} onClick={onOrganize} variant="desktop" />
          </div>
        </div>

        <div className="flex flex-col gap-[18px] bg-surface-2 p-6">
          {organizeNote && (
            <p role="status" className="rounded-[10px] border border-warning-line bg-warning-soft px-3 py-2.5 text-[13px] text-warning-ink">
              {organizeNote}
            </p>
          )}
          <div className="grid grid-cols-5 gap-4">
            {photos.map((p, i) => (
              <figure key={p.id} className="flex min-w-0 flex-col gap-1.5">
                <PhotoTile photo={p} index={i} onRemove={onRemove} variant="desktop" />
                <figcaption className="truncate text-xs text-muted" title={p.file.name}>
                  {p.file.name}
                </figcaption>
              </figure>
            ))}
            {Array.from({ length: slotsLeft }, (_, i) => (
              <FilePicker
                key={`slot-${i}`}
                mode="library"
                withExtensions
                onFiles={onFiles}
                disabled={adding}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-primary-line bg-primary-tint-2 text-[13px] font-medium text-primary transition-colors hover:border-primary-dash hover:bg-primary-tint aria-disabled:opacity-60"
              >
                {adding && i === 0 ? (
                  <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Plus size={22} strokeWidth={1.8} aria-hidden="true" />
                )}
                Add photo
                <span className="text-[11px] font-normal text-muted">Slot {photos.length + i + 1}</span>
              </FilePicker>
            ))}
          </div>
          <SkipNotices messages={messages} onDismiss={onDismissMessages} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-3.5 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2">
            <RefreshCw size={15} aria-hidden="true" />
            After this batch, you can upload another one anytime.
          </span>
          <span>{slotsLeft > 0 ? "Drop more photos anywhere on this card · JPG, PNG, WebP, HEIC" : "Batch is full"}</span>
        </div>
      </section>
      <p className="text-center text-xs text-muted">Photos are read by Google Gemini and saved on this device only.</p>
    </main>
  );
}

function OrganizeButton({
  count,
  disabled,
  onClick,
  variant,
}: {
  count: number;
  disabled: boolean;
  onClick: () => void;
  variant: "mobile" | "desktop";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || count === 0}
      className={cn(
        "flex items-center justify-center gap-2 bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-45",
        variant === "mobile"
          ? "h-[54px] w-full rounded-[14px] text-base shadow-cta-mobile"
          : "h-[52px] gap-2.5 rounded-xl px-[26px] text-base shadow-cta",
      )}
    >
      Organize {plural(count, "photo")}
      <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
