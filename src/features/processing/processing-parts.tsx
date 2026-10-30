"use client";

import { useState } from "react";
import { AlertTriangle, Check, ImageOff, Loader2, RotateCw } from "lucide-react";
import type { LinkPurpose, Photo } from "@/domain/types";
import { PurposeBadge, VerificationPill } from "@/components/ui/badges";
import { avatarClass, initials } from "@/components/ui/company-avatar";
import { cn } from "@/lib/cn";
import type { PhotoExtraction } from "@/lib/extraction/types";
import { MAX_AUTO_ATTEMPTS } from "./retry-policy";
import { photoUrl } from "./photo-url";
import type { BatchSummary, PhotoState } from "./summarize-batch";

// ── Photo thumbnails ─────────────────────────────────────────────────────

export function PhotoThumb({ photo, className }: { photo: Photo; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden bg-[#d0c9be]", className)}>
      {failed ? (
        <div className="flex h-full items-center justify-center bg-chip text-muted">
          <ImageOff size={18} aria-hidden="true" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(photo)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

const CHIP: Record<PhotoState, string> = {
  done: "bg-white text-success",
  reading: "bg-primary text-white",
  retrying: "border border-[#fcd34d] bg-warning-soft text-warning-ink",
  queued: "bg-white text-ink-3",
  no_company: "border border-[#fcd34d] bg-warning-soft text-warning-ink",
  not_recruitment: "border border-[#fcd34d] bg-warning-soft text-warning-ink",
  failed: "border border-danger-line bg-danger-soft text-danger",
};

export function photoStatusLabel(state: PhotoState, photo: Photo): string {
  const qr = photo.qr?.codes.length ?? 0;
  switch (state) {
    case "done":
      return qr ? `Read · ${qr} QR` : "Read";
    case "reading":
      return photo.prepared ? "Reading" : "Preparing";
    case "retrying":
      return photo.error?.code === "rate_limited" ? "Waiting · Gemini limit" : `Retrying · ${photo.attempts}/${MAX_AUTO_ATTEMPTS}`;
    case "queued":
      return "Waiting";
    case "no_company":
      return "No company name";
    case "not_recruitment":
      return "Not a brochure";
    case "failed":
      return "Couldn't read";
  }
}

export function PhotoStatusTile({
  photo,
  index,
  state,
  extraction,
}: {
  photo: Photo;
  index: number;
  state: PhotoState;
  extraction?: PhotoExtraction;
}) {
  const active = state === "reading";
  const warn = state === "retrying" || state === "no_company" || state === "not_recruitment" || state === "failed";
  const detected =
    state === "failed"
      ? photo.error?.message
      : state === "retrying"
        ? "Reading again…"
        : state === "no_company"
          ? "Company unknown"
          : extraction?.companies.map((c) => c.name.value).join(", ");

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="relative overflow-hidden rounded-[10px] border border-line">
        <PhotoThumb photo={photo} />
        <span className="absolute left-2 top-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-ink/72 px-1.5 text-[11px] font-semibold text-white">
          {index + 1}
        </span>
        {active && (
          <>
            <div className="absolute inset-0 bg-primary/8" />
            <div className="animate-scan absolute inset-x-0 h-[30%] bg-[linear-gradient(180deg,rgba(99,102,241,0)_0%,rgba(99,102,241,0.28)_70%,rgba(6,182,212,0.7)_100%)]" />
          </>
        )}
        <span
          className={cn(
            "absolute bottom-2 left-2 inline-flex max-w-[calc(100%-16px)] items-center gap-1 truncate rounded-full px-2 py-[3px] text-[11px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
            CHIP[state],
          )}
        >
          {state === "done" && <Check size={11} strokeWidth={3} aria-hidden="true" />}
          {active && <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
          {state === "retrying" && <RotateCw size={11} aria-hidden="true" />}
          {warn && state !== "retrying" && <AlertTriangle size={11} aria-hidden="true" />}
          {photoStatusLabel(state, photo)}
        </span>
      </div>
      <figcaption className="flex min-w-0 flex-col">
        {detected && (
          <span className={cn("truncate text-[13px] font-medium", warn ? "text-warning-ink" : "text-ink")} title={detected}>
            {detected}
          </span>
        )}
        <span className="truncate text-xs text-muted" title={photo.fileName}>
          {photo.fileName}
        </span>
      </figcaption>
    </figure>
  );
}

// ── Stage tracker ───────────────────────────────────────────────────────

type StageState = "done" | "active" | "next" | "warn";

function StageIcon({ state }: { state: StageState }) {
  if (state === "done")
    return (
      <span className="flex size-6 flex-none items-center justify-center rounded-full border border-success-line bg-success-soft text-success lg:size-8">
        <Check size={13} strokeWidth={2.8} aria-hidden="true" />
      </span>
    );
  if (state === "active")
    return (
      <span className="flex size-6 flex-none items-center justify-center rounded-full bg-primary-soft text-lens-from lg:size-8">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      </span>
    );
  if (state === "warn")
    return (
      <span className="flex size-6 flex-none items-center justify-center rounded-full border border-warning-line bg-warning-soft text-warning lg:size-8">
        <AlertTriangle size={13} aria-hidden="true" />
      </span>
    );
  return <span className="size-6 flex-none rounded-full border border-line bg-chip lg:size-8" />;
}

export interface GroupingStage {
  state: "next" | "active" | "done" | "warn";
  detail: string;
}

export function StageTracker({ summary, grouping }: { summary: BatchSummary; grouping: GroupingStage }) {
  const { total, read, failed, retrying, finished, qr } = summary;
  const readingDetail = [
    `${read} of ${total} read`,
    retrying ? `${retrying} retrying` : null,
    failed ? `${failed} couldn't be read` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const scanned = qr.photosScanned + qr.unsupported;
  const qrDetail =
    qr.codes > 0
      ? `${qr.codes} ${qr.codes === 1 ? "code" : "codes"} found in ${qr.photosWithCodes} ${qr.photosWithCodes === 1 ? "photo" : "photos"}`
      : scanned >= total
        ? "No QR codes found"
        : scanned > 0
          ? "None found yet"
          : "Waiting";

  const stages: { title: string; detail: string; state: StageState }[] = [
    {
      title: "Reading photos",
      detail: readingDetail,
      state: finished ? (failed === total ? "warn" : "done") : "active",
    },
    {
      title: "Scanning QR codes",
      detail: qr.unsupported ? `${qrDetail} · ${qr.unsupported} not scannable here` : qrDetail,
      state: scanned >= total ? "done" : "active",
    },
    {
      title: "Grouping companies",
      detail: finished ? grouping.detail : "After reading",
      state: finished ? grouping.state : "next",
    },
  ];

  return (
    <ol className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:gap-4">
      {stages.map((s) => (
        <li key={s.title} className="flex items-center gap-3 lg:items-start">
          <StageIcon state={s.state} />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 lg:block">
            <div
              className={cn(
                "font-medium lg:font-semibold",
                s.state === "active" && "font-semibold text-primary-hover",
                s.state === "next" && "text-muted",
              )}
            >
              {s.title}
            </div>
            <div className="text-right text-xs text-muted lg:text-left lg:text-[13px]">{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Discovered companies and links ───────────────────────────────────────

export function DiscoveredList({ items }: { items: BatchSummary["discovered"] }) {
  if (items.length === 0) return <p className="text-[13px] text-muted">Companies appear here as photos are read.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => {
        const detail = [
          `${c.photoCount} ${c.photoCount === 1 ? "photo" : "photos"}`,
          c.titles.length === 1 ? c.titles[0] : c.titles.length > 1 ? `${c.titles.length} positions` : null,
          c.hasApplicationForm ? "application form found" : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={c.name}
            className={cn(
              "flex items-center gap-3 rounded-[14px] border p-2.5 px-3 lg:rounded-[10px] lg:p-3",
              c.uncertain ? "border-dashed border-[#fcd34d] bg-warning-soft" : "border-line bg-surface",
            )}
          >
            <span
              className={cn(
                "flex size-[34px] flex-none items-center justify-center rounded-[9px] text-xs font-semibold lg:size-9 lg:text-[13px]",
                c.uncertain ? "bg-[#fef3c7] text-warning-ink" : avatarClass(c.name),
              )}
            >
              {c.uncertain ? "?" : initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.name}</div>
              <div className={cn("truncate text-xs lg:text-[13px]", c.uncertain ? "text-warning-ink" : "text-muted")}>
                {c.uncertain ? "Name was hard to read · we'll ask you" : detail}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const PURPOSE_ORDER: LinkPurpose[] = ["application_form", "careers", "company_info", "social_contact", "event_registration", "unknown"];

export function LinkTypeChips({ counts }: { counts: BatchSummary["linkCounts"] }) {
  const present = PURPOSE_ORDER.filter((p) => counts[p]);
  if (present.length === 0) return <p className="text-[13px] text-muted">No links found yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map((p) => (
        <PurposeBadge key={p} purpose={p} count={counts[p]} />
      ))}
    </div>
  );
}

export function LinkList({ links }: { links: BatchSummary["links"] }) {
  if (links.length === 0) return <p className="text-[13px] text-muted">No QR codes or printed links found yet.</p>;
  return (
    <ul className="flex flex-col">
      {links.map((l) => (
        <li key={l.normalized} className="flex items-center gap-2.5 border-t border-chip py-[9px] first:border-t-0">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex items-center gap-1.5">
              <PurposeBadge purpose={l.purpose} />
              <span className="truncate text-xs text-muted">
                {l.companyName ?? "Company unknown"} · Photo {l.photoIndex}
              </span>
            </div>
            <div className="truncate text-[13px] font-medium" title={l.raw}>
              {l.display}
            </div>
          </div>
          <VerificationPill state={l.verification} />
        </li>
      ))}
    </ul>
  );
}
