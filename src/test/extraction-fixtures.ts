import type { Photo } from "@/domain/types";
import type { ExtractedLink, ExtractedOpportunity, PhotoExtraction } from "@/lib/extraction/types";

/** Test-only builders for already post-processed photo extractions. */

export function photo(id: string, over: Partial<Photo> = {}): Photo {
  return {
    id,
    batchId: "b1",
    sha256: id,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1,
    blob: new Blob(),
    prepared: true,
    qr: { status: "done", codes: [] },
    addedAt: "2026-10-30T09:00:00Z",
    status: "done",
    companyId: null,
    attempts: 1,
    ...over,
  };
}

export function exCompany(name: string, over: Partial<PhotoExtraction["companies"][number]> = {}) {
  return { name: { value: name, status: "auto" as const }, aliases: [], locations: [], perks: [], domains: [], ...over };
}

export function exOpp(title: string, over: Partial<ExtractedOpportunity> = {}): ExtractedOpportunity {
  return { companyName: null, title: { value: title, status: "auto" }, status: "not_specified", unparsedDates: [], requirements: [], skills: [], ...over };
}

export function exLink(raw: string, normalized: string, over: Partial<ExtractedLink> = {}): ExtractedLink {
  return {
    origin: "qr",
    raw,
    targetKind: "web",
    normalized,
    display: normalized,
    purpose: "careers",
    verification: "from_photo",
    companyName: null,
    appliesToTitles: [],
    ...over,
  };
}

export function extraction(over: Partial<PhotoExtraction> = {}): PhotoExtraction {
  return {
    schemaVersion: 1,
    model: "test",
    extractedAt: "2026-10-30T09:00:00Z",
    isRecruitmentMaterial: true,
    readability: "good",
    language: "en",
    companies: [],
    opportunities: [],
    events: [],
    contacts: [],
    links: [],
    ...over,
  };
}
