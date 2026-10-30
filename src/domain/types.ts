/**
 * CareerLens domain model.
 *
 * Everything the AI extracts is stored as a `Field<T>` so the UI can tell
 * auto-extracted, uncertain, user-edited and missing values apart, and every
 * value can be traced back to the photo or webpage it came from.
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD (Gregorian, already converted from Buddhist Era)
export type ISODateTime = string;

// ── Provenance ───────────────────────────────────────────────────────────

export type SourceRef =
  | { kind: "photo"; photoId: ID; quote?: string }
  | { kind: "webpage"; linkId: ID; url: string; quote?: string; fetchedAt: ISODateTime }
  | { kind: "user"; editedAt: ISODateTime };

/**
 * auto       – extracted with high confidence
 * uncertain  – extracted, but low confidence or partly unreadable ("Check")
 * confirmed  – two independent sources agree, or a readable linked page confirms it
 * edited     – set by the user; never overwritten by a later batch
 */
export type FieldStatus = "auto" | "uncertain" | "confirmed" | "edited";

export interface Field<T> {
  value: T;
  status: FieldStatus;
  sources: SourceRef[];
  /** Why the value is uncertain, shown next to the "Check" badge. */
  note?: string;
}

/** A missing value is simply `undefined` – the UI renders "Not mentioned". */
export type MaybeField<T> = Field<T> | undefined;

// ── Batches and photos ───────────────────────────────────────────────────

/**
 * processing   – photos are being read
 * extracted    – every photo was read (some may have failed); grouping comes next
 * needs_review – grouped, with items waiting in Review
 * done         – merged into the dashboard
 * failed       – no photo could be read; previously saved data is untouched
 */
export type BatchStatus = "processing" | "extracted" | "needs_review" | "done" | "failed";

export interface Batch {
  id: ID;
  number: number; // "Batch 2"
  createdAt: ISODateTime;
  status: BatchStatus;
  photoIds: ID[];
  /** Photos skipped before upload because their SHA-256 already exists. */
  skippedDuplicateCount: number;
  error?: string;
}

export type PhotoProcessingStatus = "queued" | "reading" | "done" | "failed";

/** A QR code decoded in the browser. */
export interface DecodedQr {
  text: string;
  /** Where it sits on the photo, e.g. "bottom-right". Helps the model match printed labels. */
  region: string;
}

export interface PhotoQrScan {
  /** "unsupported": this browser couldn't decode the image (e.g. HEIC outside Safari). */
  status: "done" | "unsupported" | "failed";
  codes: DecodedQr[];
}

export interface Photo {
  id: ID;
  batchId: ID;
  /** Lower-case hex SHA-256 of the original file bytes; used for exact-duplicate detection. */
  sha256: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /**
   * The original file until the photo is prepared; afterwards the downscaled,
   * EXIF-stripped JPEG that is sent to the AI and shown in the UI.
   */
  blob: Blob;
  prepared: boolean;
  qr: PhotoQrScan | null;
  width?: number;
  height?: number;
  takenAt?: ISODateTime; // from EXIF or file lastModified
  addedAt: ISODateTime;
  status: PhotoProcessingStatus;
  /** Null until grouped; stays null when the photo needs assignment in Review. */
  companyId: ID | null;
  /** Extraction attempts so far (automatic retries included). */
  attempts: number;
  /** True once this photo's extraction has been merged into company data. */
  committed?: boolean;
  /** Set while waiting to retry after a transient error. */
  retryAt?: number;
  error?: { code: string; message: string };
}

// ── Links (QR codes and printed URLs) ───────────────────────────────────

export type LinkPurpose =
  | "application_form" // Google Forms, MS Forms, ATS apply pages
  | "careers" // careers pages, job boards
  | "company_info" // homepage / about
  | "social_contact" // LinkedIn, Facebook, Instagram, LINE OA, TikTok, email, phone
  | "event_registration"
  | "unknown"; // short links, PDFs, vCards, anything unverified

/**
 * from_photo  – decoded or printed, never opened
 * verified    – read from the linked page, or confirmed by two sources
 * unreadable  – we tried to fetch it and couldn't (login, blocked, timeout…)
 * not_fetched – deliberately not fetched (social media, short links, unsafe targets)
 */
export type LinkVerification = "from_photo" | "verified" | "unreadable" | "not_fetched";

export interface Link {
  id: ID;
  companyId: ID | null;
  /** Original URL exactly as decoded/printed. */
  rawUrl: string;
  /** Normalized URL used for de-duplication. */
  normalizedUrl: string;
  origin: "qr" | "printed";
  purpose: LinkPurpose;
  verification: LinkVerification;
  /** Opportunity this link applies to, only when evidence ties it to one. */
  opportunityIds: ID[];
  pageTitle?: string;
  sources: SourceRef[];
}

// ── Companies, opportunities, events, contacts ─────────────────────────

export interface Company {
  id: ID;
  name: Field<string>;
  aliases: string[];
  /** Registrable domains seen on links/emails – strong evidence for grouping. */
  domains: string[];
  description: MaybeField<string>;
  industry: MaybeField<string>;
  locations: Field<string>[];
  perks: Field<string>[];
  photoIds: ID[];
  createdInBatchId: ID;
  updatedInBatchId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type OpportunityType =
  | "internship"
  | "full_time"
  | "part_time"
  | "graduate_program"
  | "program_camp"
  | "other";

/** Per opportunity, never per company. Default is "not_specified". */
export type RecruitmentStatus = "open" | "upcoming" | "closed" | "not_specified";

export interface Opportunity {
  id: ID;
  companyId: ID;
  title: Field<string>;
  type: MaybeField<OpportunityType>;
  status: RecruitmentStatus;
  deadline: MaybeField<ISODate>;
  opensAt: MaybeField<ISODate>;
  duration: MaybeField<string>;
  location: MaybeField<string>;
  workMode: MaybeField<"onsite" | "hybrid" | "remote">;
  compensation: MaybeField<string>;
  requirements: Field<string>[];
  skills: Field<string>[];
  howToApply: MaybeField<string>;
  sources: SourceRef[];
}

export interface RecruitmentEvent {
  id: ID;
  companyId: ID;
  title: Field<string>;
  date: MaybeField<ISODate>;
  time: MaybeField<string>;
  location: MaybeField<string>;
  registrationLinkId?: ID;
  sources: SourceRef[];
}

export type ContactKind = "email" | "phone" | "line" | "booth" | "person" | "other";

export interface Contact {
  id: ID;
  companyId: ID;
  kind: ContactKind;
  value: Field<string>;
  label?: string;
  sources: SourceRef[];
}

// ── Review ───────────────────────────────────────────────────────────────

/** Only these four reach the Review screen; smaller issues are flagged on the company page. */
export type ReviewKind =
  | "deadline_conflict"
  | "unclear_application_link"
  | "uncertain_company_match"
  | "photo_without_company";

export type ReviewState = "open" | "resolved" | "skipped";

export interface ReviewItem {
  id: ID;
  batchId: ID;
  kind: ReviewKind;
  state: ReviewState;
  createdAt: ISODateTime;
  /** Kind-specific payload; narrowed in the review feature module. */
  payload: Record<string, unknown>;
}

/**
 * A company the user marked "Interested". Stored apart from the company record
 * so a new batch (which may update the company) never clears the choice, and
 * removing it from My Calendar never touches the company's data.
 */
export interface Interest {
  companyId: ID;
  savedAt: ISODateTime;
}

/** Audit trail of user edits so later batches never silently overwrite them. */
export interface UserEdit {
  id: ID;
  entity: "company" | "opportunity" | "event" | "contact" | "link" | "photo";
  entityId: ID;
  field: string;
  previous: unknown;
  next: unknown;
  editedAt: ISODateTime;
}
