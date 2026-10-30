import type { ContactKind, ISODate, LinkPurpose, LinkVerification, OpportunityType, RecruitmentStatus } from "@/domain/types";

/**
 * The validated, normalized result for ONE photo. Nothing here is merged or
 * grouped yet (that is Phase 3); every value carries its own confidence so the
 * UI and the grouping step can tell solid values from uncertain ones.
 */

export interface ExtractedValue<T> {
  value: T;
  status: "auto" | "uncertain";
  /** Why it is uncertain ("partly hidden by glare", "No year printed; assumed 2026"). */
  note?: string;
}

export interface ExtractedDate extends ExtractedValue<ISODate> {
  /** Exactly as printed on the brochure. */
  raw: string;
}

export interface ExtractedCompany {
  name: ExtractedValue<string>;
  aliases: string[];
  description?: string;
  industry?: string;
  locations: string[];
  perks: string[];
  /** Registrable domains from this photo's links and emails attributed to this company. */
  domains: string[];
  quote?: string;
}

export interface ExtractedOpportunity {
  companyName: string | null;
  title: ExtractedValue<string>;
  type?: OpportunityType;
  status: RecruitmentStatus;
  statusEvidence?: string;
  deadline?: ExtractedDate;
  opensAt?: ExtractedDate;
  /** Printed date text we could not turn into a calendar date. */
  unparsedDates: string[];
  duration?: string;
  location?: string;
  workMode?: "onsite" | "hybrid" | "remote";
  compensation?: ExtractedValue<string>;
  requirements: string[];
  skills: string[];
  howToApply?: string;
  quote?: string;
}

export interface ExtractedEvent {
  companyName: string | null;
  title: string;
  date?: ExtractedDate;
  time?: string;
  location?: string;
  quote?: string;
}

export interface ExtractedContact {
  companyName: string | null;
  kind: ContactKind;
  value: string;
  label?: string;
}

export interface ExtractedLink {
  origin: "qr" | "printed";
  raw: string;
  targetKind: "web" | "email" | "phone" | "text";
  /** De-duplication key. */
  normalized: string;
  display: string;
  /** Only for web targets. */
  domain?: string;
  purpose: LinkPurpose;
  verification: LinkVerification;
  companyName: string | null;
  label?: string;
  appliesToTitles: string[];
}

export interface PhotoExtraction {
  schemaVersion: 1;
  model: string;
  extractedAt: string;
  isRecruitmentMaterial: boolean;
  readability: "good" | "partial" | "poor";
  readabilityNote?: string;
  language: "th" | "en" | "mixed" | "other";
  companies: ExtractedCompany[];
  opportunities: ExtractedOpportunity[];
  events: ExtractedEvent[];
  contacts: ExtractedContact[];
  links: ExtractedLink[];
}

export type { DecodedQr } from "@/domain/types";
