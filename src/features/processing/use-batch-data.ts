"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { Batch, Photo } from "@/domain/types";
import { getDB } from "@/lib/db";
import type { PhotoExtraction } from "@/lib/extraction/types";

export type BatchData =
  | { state: "loading" }
  | { state: "missing" }
  | {
      state: "ready";
      batch: Batch;
      photos: Photo[];
      extractions: Map<string, PhotoExtraction>;
      /** Review items from this batch still waiting for the user. */
      openReview: number;
      /** Companies this batch's photos were grouped into. */
      companyCount: number;
    };

/** Live view of one batch straight from IndexedDB. */
export function useBatchData(batchId: string): BatchData {
  const data = useLiveQuery(async () => {
    const db = getDB();
    const batch = await db.batches.get(batchId);
    if (!batch) return { state: "missing" as const };
    const [photos, records, openReview] = await Promise.all([
      db.photos.where("batchId").equals(batchId).toArray(),
      db.extractions.where("batchId").equals(batchId).toArray(),
      db.reviewItems.where("batchId").equals(batchId).filter((r) => r.state === "open").count(),
    ]);
    const order = new Map(batch.photoIds.map((id, i) => [id, i]));
    photos.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return {
      state: "ready" as const,
      batch,
      photos,
      extractions: new Map(records.map((r) => [r.photoId, r.extraction])),
      openReview,
      companyCount: new Set(photos.map((p) => p.companyId).filter(Boolean)).size,
    };
  }, [batchId]);
  return data ?? { state: "loading" };
}
