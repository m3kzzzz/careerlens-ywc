import type { Company, Contact, Link, Opportunity, RecruitmentEvent } from "@/domain/types";
import { getDB } from "./index";

/** Everything the Companies and My Calendar screens read, in one snapshot. */
export interface Library {
  companies: Company[];
  opportunities: Opportunity[];
  links: Link[];
  events: RecruitmentEvent[];
  contacts: Contact[];
  interestedIds: Set<string>;
  photoCount: number;
  batchCount: number;
  /** Batches whose photos were read but not yet grouped into companies. */
  ungroupedBatchCount: number;
  linkCount: number;
  /** Most recent batch that finished reading; drives the New / Updated badges. */
  latestBatchId?: string;
  /** Review items still waiting for the user, across batches. */
  openReviewCount: number;
}

export async function loadLibrary(): Promise<Library> {
  const db = getDB();
  const [companies, opportunities, links, events, contacts, interests, photoCount, batches, openReviewCount] = await Promise.all([
    db.companies.toArray(),
    db.opportunities.toArray(),
    db.links.toArray(),
    db.events.toArray(),
    db.contacts.toArray(),
    db.interests.toArray(),
    db.photos.count(),
    db.batches.toArray(),
    db.reviewItems.where("state").equals("open").count(),
  ]);
  const companyIds = new Set(companies.map((c) => c.id));
  return {
    companies,
    opportunities,
    links,
    events,
    contacts,
    // An interest whose company no longer exists (e.g. merged away) is ignored, not shown.
    interestedIds: new Set(interests.map((i) => i.companyId).filter((id) => companyIds.has(id))),
    photoCount,
    batchCount: batches.filter((b) => b.status !== "processing" && b.status !== "failed").length,
    ungroupedBatchCount: batches.filter((b) => b.status === "extracted").length,
    linkCount: links.length,
    latestBatchId: batches
      .filter((b) => b.status !== "processing" && b.status !== "failed")
      .sort((a, b) => b.number - a.number)[0]?.id,
    openReviewCount,
  };
}
