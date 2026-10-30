"use client";

import Link from "next/link";
import { ChevronRight, ImageIcon, QrCode, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { cn } from "@/lib/cn";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/upload/constants";
import type { LibrarySummary } from "@/lib/db/queries";
import { FilePicker } from "./file-picker";
import { SkipNotices } from "./skip-notices";
import { useFileDrop } from "./use-file-drop";
import type { SkipMessage } from "@/lib/upload/skip-messages";

interface StartViewProps {
  batchNumber: number;
  summary: LibrarySummary | undefined;
  adding: boolean;
  messages: SkipMessage[];
  onFiles: (files: File[]) => void;
  onDismissMessages: () => void;
}

/** Empty batch: M1 on mobile, D1a on desktop. */
export function StartView(props: StartViewProps) {
  return (
    <>
      <StartMobile {...props} />
      <StartDesktop {...props} />
    </>
  );
}

function StartMobile({ summary, adding, messages, onFiles, onDismissMessages }: StartViewProps) {
  const hasLibrary = !!summary && summary.companyCount > 0;
  // N1: first visit (nothing saved yet) explains the flow; M1: returning users see their batch number.
  const firstTime = !!summary && summary.batchCount === 0 && summary.companyCount === 0;
  return (
    <div className="mx-auto w-full max-w-[560px] lg:hidden">
      <header className="flex h-14 items-center justify-between px-4">
        <Logo size="sm" />
      </header>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <div>
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em]">
            Snap the brochures.
            <br />
            We&apos;ll sort them.
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Up to {MAX_PHOTOS_PER_BATCH} photos per batch, from any mix of companies.
          </p>
        </div>

        {/* One picker: phones offer camera or gallery from the system sheet. */}
        <FilePicker
          mode="library"
          onFiles={onFiles}
          disabled={adding}
          className="relative flex h-[148px] flex-col justify-end gap-0.5 overflow-hidden rounded-[20px] bg-primary p-[18px] text-white shadow-hero transition-colors active:bg-primary-hover aria-disabled:opacity-70"
        >
          <span className="absolute left-[18px] top-[18px] flex size-[52px] items-center justify-center rounded-2xl bg-white/16">
            <ImageIcon size={26} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span
            aria-hidden="true"
            className="absolute -right-[30px] -top-[30px] size-[140px] rounded-full bg-[linear-gradient(135deg,rgba(99,102,241,0),rgba(6,182,212,0.45))]"
          />
          <span className="text-xl font-semibold tracking-[-0.01em]">Upload photos</span>
          <span className="text-[13px] text-white/85" aria-live="polite">
            {adding ? "Checking photos…" : "Take new photos or choose from your gallery"}
          </span>
        </FilePicker>

        <SkipNotices messages={messages} onDismiss={onDismissMessages} />

        {hasLibrary && (
          <Link href="/companies" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted">Your companies</div>
              <div className="text-[15px] font-semibold">
                {summary.companyCount} {summary.companyCount === 1 ? "company" : "companies"} ·{" "}
                {summary.opportunityCount} {summary.opportunityCount === 1 ? "opportunity" : "opportunities"}
              </div>
            </div>
            <ChevronRight size={18} className="text-muted" aria-hidden="true" />
          </Link>
        )}

        {firstTime ? (
          <ol className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5">
            {[
              ["Snap or upload", "brochures from any companies"],
              ["AI sorts them", "and reads text and QR codes"],
              ["Browse", "companies, deadlines and events"],
            ].map(([bold, rest], i) => (
              <li key={bold} className="flex items-center gap-3">
                <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-hover">
                  {i + 1}
                </span>
                <span className="text-[13px]">
                  <b className="font-semibold">{bold}</b> <span className="text-muted">{rest}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-start gap-2.5 px-0.5 text-xs text-muted">
            <QrCode size={15} className="mt-px flex-none text-lens-from" aria-hidden="true" />
            <span>Tip: keep QR codes sharp in the photo. We&apos;ll check where each one leads.</span>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}

function StartDesktop({ summary, adding, messages, onFiles, onDismissMessages }: StartViewProps) {
  const { isDragging, handlers } = useFileDrop(onFiles, !adding);
  const hasLibrary = !!summary && summary.batchCount > 0;

  return (
    <main className="mx-auto hidden max-w-[1040px] flex-col gap-9 px-8 pb-20 pt-12 lg:flex">
      <section className="flex flex-col items-center gap-3.5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-[5px] pl-1.5 pr-3 text-[13px] font-medium text-ink-2">
          <span className="bg-lens flex size-[18px] items-center justify-center rounded-full">
            <Sparkles size={10} fill="#fff" stroke="none" aria-hidden="true" />
          </span>
          AI reads text, scans QR codes and sorts by company
        </span>
        <h1 className="max-w-[720px] text-[46px] font-semibold leading-[1.08] tracking-[-0.03em]">
          Turn brochures into career opportunities.
        </h1>
        <p className="max-w-[620px] text-[17px] text-muted">
          Upload a batch of up to {MAX_PHOTOS_PER_BATCH} job fair photos, from any mix of companies. Add more batches
          whenever you like. Everything merges into one dashboard.
        </p>
      </section>

      <section aria-label="Upload a batch" className="flex flex-col rounded-[18px] border border-line bg-surface p-3 shadow-panel">
        <div
          {...handlers}
          className={cn(
            "flex flex-col items-center gap-3.5 rounded-xl border-2 border-dashed px-8 pb-10 pt-12 text-center transition-colors",
            isDragging ? "border-primary bg-primary-soft" : "border-primary-dash bg-primary-tint",
          )}
        >
          <span className="flex size-16 items-center justify-center rounded-[18px] border border-[#e0e7ff] bg-surface text-primary shadow-[0_6px_16px_-8px_rgba(79,70,229,0.4)]">
            <Upload size={28} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="text-[22px] font-semibold tracking-[-0.015em]">
            {isDragging ? "Drop to add to this batch" : `Drop up to ${MAX_PHOTOS_PER_BATCH} brochure photos`}
          </span>
          <span className="text-[15px] text-ink-2">Different companies in one batch is fine. No sorting needed.</span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <FilePicker
              mode="library"
              withExtensions
              onFiles={onFiles}
              disabled={adding}
              className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-primary px-[26px] text-base font-semibold text-white shadow-cta transition-colors hover:bg-primary-hover aria-disabled:opacity-60"
            >
              <ImageIcon size={18} strokeWidth={2} aria-hidden="true" />
              Upload photos
            </FilePicker>
          </div>
          <span className="text-[13px] text-muted">
            {adding ? "Checking photos…" : "or drag and drop anywhere in this box · JPG, PNG, WebP or HEIC"}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 px-3 pb-1.5 pt-4">
          <span className="inline-flex items-center gap-2 text-[13px] text-muted">
            <RefreshCw size={15} aria-hidden="true" />
            {hasLibrary
              ? `Merges into your dashboard · ${summary.companyCount} ${summary.companyCount === 1 ? "company" : "companies"} saved`
              : "Merges into your dashboard · add more batches anytime"}
          </span>
        </div>
        {messages.length > 0 && (
          <div className="px-3 pb-1.5 pt-3">
            <SkipNotices messages={messages} onDismiss={onDismissMessages} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-4">
        {[
          ["Upload a batch", `Up to ${MAX_PHOTOS_PER_BATCH} photos, any companies, any order.`],
          ["AI organizes it", "Reads text, decodes QR codes, groups by company."],
          ["Add more anytime", "New batches merge in. Duplicates are skipped."],
        ].map(([title, body], i) => (
          <div key={title} className="flex gap-3.5 px-2 py-1">
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-hover">
              {i + 1}
            </span>
            <div>
              <div className="mb-0.5 font-semibold">{title}</div>
              <div className="text-muted">{body}</div>
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-muted">Photos are read by Google Gemini and saved on this device only.</p>
    </main>
  );
}
