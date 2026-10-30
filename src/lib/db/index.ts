import Dexie, { type EntityTable } from "dexie";
import type {
  Batch,
  Company,
  Contact,
  Interest,
  Link,
  Opportunity,
  Photo,
  RecruitmentEvent,
  ReviewItem,
  UserEdit,
} from "@/domain/types";
import type { PhotoExtraction } from "@/lib/extraction/types";

/** The validated AI result for one photo, stored as-is so retries are idempotent. */
export interface ExtractionRecord {
  photoId: string;
  batchId: string;
  extraction: PhotoExtraction;
}

/**
 * Local-only persistence (IndexedDB). Data lives in this browser on this
 * device; there is no sync.
 */
export class CareerLensDB extends Dexie {
  batches!: EntityTable<Batch, "id">;
  photos!: EntityTable<Photo, "id">;
  companies!: EntityTable<Company, "id">;
  opportunities!: EntityTable<Opportunity, "id">;
  links!: EntityTable<Link, "id">;
  events!: EntityTable<RecruitmentEvent, "id">;
  contacts!: EntityTable<Contact, "id">;
  reviewItems!: EntityTable<ReviewItem, "id">;
  userEdits!: EntityTable<UserEdit, "id">;
  extractions!: EntityTable<ExtractionRecord, "photoId">;
  interests!: EntityTable<Interest, "companyId">;

  constructor() {
    super("careerlens");
    this.version(1).stores({
      batches: "id, number, status, createdAt",
      photos: "id, &sha256, batchId, companyId, status",
      companies: "id, *aliases, *domains, updatedAt",
      opportunities: "id, companyId, status",
      links: "id, &normalizedUrl, companyId, purpose",
      events: "id, companyId",
      contacts: "id, companyId, kind",
      reviewItems: "id, batchId, kind, state",
      userEdits: "id, [entity+entityId], editedAt",
    });
    this.version(2).stores({
      extractions: "photoId, batchId",
    });
    this.version(3).stores({
      interests: "companyId, savedAt",
    });
  }
}

let instance: CareerLensDB | null = null;

/** Tests only: forget the cached connection, as a page reload would. */
export function resetDBForTests() {
  instance?.close();
  instance = null;
}

/** Lazily created so server rendering never touches IndexedDB. */
export function getDB(): CareerLensDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  instance ??= new CareerLensDB();
  return instance;
}
