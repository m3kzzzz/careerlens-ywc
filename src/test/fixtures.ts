import type { Company, Field, Link, Opportunity, RecruitmentEvent } from "@/domain/types";
import type { Library } from "@/lib/db/library";

/** Test-only builders. Never imported by app code. */

const f = <T,>(value: T, status: Field<T>["status"] = "auto"): Field<T> => ({ value, status, sources: [] });

export function company(id: string, name: string, over: Partial<Company> = {}): Company {
  return {
    id,
    name: f(name),
    aliases: [],
    domains: [],
    description: undefined,
    industry: undefined,
    locations: [],
    perks: [],
    photoIds: ["p1"],
    createdInBatchId: "b1",
    updatedInBatchId: "b1",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

export function opportunity(
  id: string,
  companyId: string,
  title: string,
  over: Partial<Opportunity> & { deadlineIso?: string; deadlineStatus?: Field<string>["status"] } = {},
): Opportunity {
  const { deadlineIso, deadlineStatus, ...rest } = over;
  return {
    id,
    companyId,
    title: f(title),
    type: undefined,
    status: deadlineIso ? "open" : "not_specified",
    deadline: deadlineIso ? f(deadlineIso, deadlineStatus) : undefined,
    opensAt: undefined,
    duration: undefined,
    location: undefined,
    workMode: undefined,
    compensation: undefined,
    requirements: [],
    skills: [],
    howToApply: undefined,
    sources: [{ kind: "photo", photoId: "p1" }],
    ...rest,
  };
}

export function link(id: string, companyId: string, rawUrl: string, over: Partial<Link> = {}): Link {
  return {
    id,
    companyId,
    rawUrl,
    normalizedUrl: rawUrl.replace(/^https?:\/\/(www\.)?/, ""),
    origin: "qr",
    purpose: "careers",
    verification: "from_photo",
    opportunityIds: [],
    sources: [],
    ...over,
  };
}

export function event(id: string, companyId: string, title: string, dateIso?: string): RecruitmentEvent {
  return {
    id,
    companyId,
    title: f(title),
    date: dateIso ? f(dateIso) : undefined,
    time: undefined,
    location: undefined,
    sources: [],
  };
}

export function library(over: Partial<Library> = {}): Library {
  return {
    companies: [],
    opportunities: [],
    links: [],
    events: [],
    contacts: [],
    interestedIds: new Set(),
    photoCount: 0,
    batchCount: 0,
    ungroupedBatchCount: 0,
    linkCount: 0,
    openReviewCount: 0,
    ...over,
  };
}
