import type { LinkPurpose, Photo } from "@/domain/types";
import { normalizeCompanyName } from "@/lib/grouping/match";
import { classifyTarget, initialVerification } from "@/lib/links/classify";
import { displayUrl, parseTarget } from "@/lib/links/normalize";
import type { ExtractedLink, PhotoExtraction } from "@/lib/extraction/types";

/** A decoded QR code shown before (or without) the AI's reading of its context. */
function linkFromQr(text: string): ExtractedLink {
  const target = parseTarget(text);
  const rule = classifyTarget(target);
  return {
    origin: "qr",
    raw: text,
    targetKind: target.kind,
    normalized: target.normalized,
    display: displayUrl(target),
    domain: target.kind === "web" ? target.domain : undefined,
    purpose: rule.purpose,
    verification: initialVerification(target, rule),
    companyName: null,
    appliesToTitles: [],
  };
}

export type PhotoState = "queued" | "reading" | "retrying" | "done" | "no_company" | "not_recruitment" | "failed";

export interface BatchSummary {
  total: number;
  read: number; // done
  failed: number;
  retrying: number;
  finished: boolean;
  qr: { codes: number; photosWithCodes: number; photosScanned: number; unsupported: number };
  linkCounts: Partial<Record<LinkPurpose, number>>;
  links: (ExtractedLink & { photoIndex: number })[];
  discovered: { name: string; photoCount: number; titles: string[]; hasApplicationForm: boolean; uncertain: boolean }[];
}

export function photoState(photo: Photo, extraction: PhotoExtraction | undefined): PhotoState {
  if (photo.status === "failed") return "failed";
  if (photo.status === "done" && extraction) {
    if (!extraction.isRecruitmentMaterial) return "not_recruitment";
    if (extraction.companies.length === 0) return "no_company";
    return "done";
  }
  if (photo.status === "reading") return photo.retryAt ? "retrying" : "reading";
  return "queued";
}

/** Everything the processing screen shows, derived from stored rows only. */
export function summarizeBatch(photos: Photo[], extractions: Map<string, PhotoExtraction>): BatchSummary {
  const read = photos.filter((p) => p.status === "done").length;
  const failed = photos.filter((p) => p.status === "failed").length;
  const retrying = photos.filter((p) => p.status === "reading" && p.retryAt).length;

  const scanned = photos.filter((p) => p.qr);
  const qr = {
    codes: scanned.reduce((n, p) => n + (p.qr?.codes.length ?? 0), 0),
    photosWithCodes: scanned.filter((p) => (p.qr?.codes.length ?? 0) > 0).length,
    photosScanned: scanned.filter((p) => p.qr?.status === "done").length,
    unsupported: scanned.filter((p) => p.qr?.status === "unsupported").length,
  };

  const links = new Map<string, ExtractedLink & { photoIndex: number }>();
  const companies = new Map<string, BatchSummary["discovered"][number] & { photoIds: Set<string> }>();

  photos.forEach((photo, i) => {
    const ex = extractions.get(photo.id);
    if (!ex) {
      for (const code of photo.qr?.codes ?? []) {
        const l = linkFromQr(code.text);
        if (!links.has(l.normalized)) links.set(l.normalized, { ...l, photoIndex: i + 1 });
      }
      return;
    }
    // The AI-informed version (printed label, company) replaces a QR-only placeholder.
    for (const l of ex.links) {
      const existing = links.get(l.normalized);
      if (!existing || (existing.companyName === null && l.companyName !== null)) links.set(l.normalized, { ...l, photoIndex: i + 1 });
    }
    for (const c of ex.companies) {
      // Same normalization as grouping, so "Lumen Pay Co., Ltd." and "Lumen Pay" show as one.
      const key = normalizeCompanyName(c.name.value);
      const entry = companies.get(key) ?? {
        name: c.name.value,
        photoCount: 0,
        titles: [],
        hasApplicationForm: false,
        uncertain: false,
        photoIds: new Set<string>(),
      };
      entry.photoIds.add(photo.id);
      entry.photoCount = entry.photoIds.size;
      entry.uncertain ||= c.name.status === "uncertain";
      for (const o of ex.opportunities) {
        const owner = o.companyName ? normalizeCompanyName(o.companyName) : ex.companies.length === 1 ? key : null;
        if (owner === key && !entry.titles.includes(o.title.value)) entry.titles.push(o.title.value);
      }
      entry.hasApplicationForm ||= ex.links.some(
        (l) => l.purpose === "application_form" && (l.companyName ? normalizeCompanyName(l.companyName) : key) === key,
      );
      companies.set(key, entry);
    }
  });

  const linkList = [...links.values()];
  const linkCounts: BatchSummary["linkCounts"] = {};
  for (const l of linkList) linkCounts[l.purpose] = (linkCounts[l.purpose] ?? 0) + 1;

  return {
    total: photos.length,
    read,
    failed,
    retrying,
    finished: photos.length > 0 && read + failed === photos.length,
    qr,
    linkCounts,
    links: linkList,
    discovered: [...companies.values()].map((c) => ({
      name: c.name,
      photoCount: c.photoCount,
      titles: c.titles,
      hasApplicationForm: c.hasApplicationForm,
      uncertain: c.uncertain,
    })),
  };
}
