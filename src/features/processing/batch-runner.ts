"use client";

import type { Photo } from "@/domain/types";
import { getDB } from "@/lib/db";
import { commitBatch } from "@/lib/grouping/commit-batch";
import type { ExtractError } from "@/lib/extraction/api-contract";
import { PhotoPrepError, preparePhoto } from "@/lib/image/prepare-photo";
import { requestExtraction } from "./extract-client";
import { isBatchFatal, retryDelayMs } from "./retry-policy";

/**
 * Reads the photos of a batch: prepare (downscale + QR) → /api/extract → store.
 *
 * All state lives in IndexedDB, so the UI is a live view of it and a reload
 * simply resumes. Results are keyed by photo id, so retries never duplicate
 * data, and nothing outside this batch is ever modified.
 */

const CONCURRENCY = 2;
/** When Gemini rate-limits one request, every worker waits; hammering would only extend the limit. */
let pausedUntil = 0;
const controllers = new Map<string, AbortController>();

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createBatch(
  photos: { file: File; sha256: string }[],
  skippedDuplicateCount: number,
): Promise<string> {
  const db = getDB();
  const batchId = newId();
  const now = new Date().toISOString();
  await db.transaction("rw", db.batches, db.photos, async () => {
    const last = await db.batches.orderBy("number").last();
    const rows: Photo[] = photos.map(({ file, sha256 }) => ({
      id: newId(),
      batchId,
      sha256,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      blob: file,
      prepared: false,
      qr: null,
      takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
      addedAt: now,
      status: "queued",
      companyId: null,
      attempts: 0,
    }));
    await db.batches.add({
      id: batchId,
      number: (last?.number ?? 0) + 1,
      createdAt: now,
      status: "processing",
      photoIds: rows.map((r) => r.id),
      skippedDuplicateCount,
    });
    await db.photos.bulkAdd(rows);
  });
  return batchId;
}

export function isBatchRunning(batchId: string) {
  return controllers.has(batchId);
}

export async function runBatch(batchId: string): Promise<void> {
  if (controllers.has(batchId)) return;
  const ctrl = new AbortController();
  controllers.set(batchId, ctrl);
  const db = getDB();

  try {
    await db.batches.update(batchId, { status: "processing", error: undefined });
    // A reload interrupts in-flight photos; queue them again.
    await db.photos
      .where("batchId")
      .equals(batchId)
      .filter((p) => p.status === "reading")
      .modify({ status: "queued", retryAt: undefined });

    let fatal: ExtractError | null = null;

    const claim = () =>
      db.transaction("rw", db.photos, async () => {
        const photo = await db.photos
          .where("batchId")
          .equals(batchId)
          .filter((p) => p.status === "queued")
          .first();
        if (photo) await db.photos.update(photo.id, { status: "reading" });
        return photo;
      });

    const worker = async () => {
      while (!ctrl.signal.aborted && !fatal) {
        const photo = await claim();
        if (!photo) return;
        const err = await processPhoto(photo, ctrl.signal);
        if (err) fatal = err;
      }
    };

    // Loop so photos re-queued (Retry) while we were finishing are picked up.
    do {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } while (
      !ctrl.signal.aborted &&
      !fatal &&
      (await db.photos.where("batchId").equals(batchId).filter((p) => p.status === "queued").count()) > 0
    );

    if (fatal) {
      const error = { code: (fatal as ExtractError).code, message: (fatal as ExtractError).message };
      await db.photos
        .where("batchId")
        .equals(batchId)
        .filter((p) => p.status === "queued")
        .modify({ status: "failed", error });
    }
    if (!ctrl.signal.aborted) await finalize(batchId);
  } finally {
    controllers.delete(batchId);
  }
}

/** Returns an error only when it should stop the whole batch. */
async function processPhoto(photo: Photo, signal: AbortSignal): Promise<ExtractError | null> {
  const db = getDB();
  let { blob, qr } = photo;

  if (!photo.prepared) {
    try {
      const prep = await preparePhoto(photo.blob, photo.fileName);
      blob = prep.blob;
      qr = prep.qr;
      await db.photos.update(photo.id, {
        blob: prep.blob,
        mimeType: prep.blob.type,
        prepared: true,
        qr: prep.qr,
        width: prep.width,
        height: prep.height,
      });
    } catch (err) {
      const message = err instanceof PhotoPrepError ? err.message : "This photo couldn't be opened.";
      await db.photos.update(photo.id, { status: "failed", error: { code: "unreadable", message } });
      return null;
    }
  }

  let attempts = photo.attempts;
  for (;;) {
    if (signal.aborted) return requeue(photo.id);
    if (pausedUntil > Date.now()) await sleep(pausedUntil - Date.now(), signal);
    if (signal.aborted) return requeue(photo.id);
    attempts += 1;
    await db.photos.update(photo.id, { attempts, retryAt: undefined });

    let res;
    try {
      res = await requestExtraction(blob, qr?.codes ?? [], signal);
    } catch {
      return requeue(photo.id); // aborted
    }

    if (res.ok) {
      const extraction = res.extraction;
      await db.transaction("rw", db.photos, db.extractions, async () => {
        if (!(await db.photos.get(photo.id))) return; // batch was cancelled meanwhile
        await db.extractions.put({ photoId: photo.id, batchId: photo.batchId, extraction });
        await db.photos.update(photo.id, { status: "done", error: undefined, retryAt: undefined });
      });
      return null;
    }

    const error = { code: res.error.code, message: res.error.message };
    if (isBatchFatal(res.error)) {
      await db.photos.update(photo.id, { status: "failed", error });
      return res.error;
    }
    const delay = retryDelayMs(res.error, attempts);
    if (delay === null) {
      await db.photos.update(photo.id, { status: "failed", error, retryAt: undefined });
      return null;
    }
    await db.photos.update(photo.id, { error, retryAt: Date.now() + delay });
    if (res.error.code === "rate_limited") pausedUntil = Math.max(pausedUntil, Date.now() + delay);
    await sleep(delay, signal);
  }
}

async function requeue(photoId: string) {
  await getDB().photos.update(photoId, { status: "queued", retryAt: undefined });
  return null;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
}

async function finalize(batchId: string) {
  const db = getDB();
  const photos = await db.photos.where("batchId").equals(batchId).toArray();
  if (photos.some((p) => p.status === "queued" || p.status === "reading")) return;
  const done = photos.filter((p) => p.status === "done").length;
  await db.batches.update(
    batchId,
    done > 0
      ? { status: "extracted", error: undefined }
      : { status: "failed", error: photos[0]?.error?.message ?? "No photo could be read." },
  );
  if (done > 0) await mergeIntoCompanies(batchId);
}

/** Group the read photos into companies. A failure here keeps the batch "extracted" so it can be retried. */
export async function mergeIntoCompanies(batchId: string) {
  try {
    await commitBatch(batchId);
  } catch (err) {
    console.error("Couldn't merge batch into companies", err);
    await getDB().batches.update(batchId, { error: "Couldn't organize the results into companies. Try again." });
  }
}

export async function retryPhotos(batchId: string, photoIds?: string[]) {
  const db = getDB();
  await db.photos
    .where("batchId")
    .equals(batchId)
    .filter((p) => p.status === "failed" && (!photoIds || photoIds.includes(p.id)))
    .modify({ status: "queued", attempts: 0, error: undefined, retryAt: undefined });
  void runBatch(batchId);
}

/** Stop and remove a batch. Data from earlier batches is never touched. */
export async function cancelBatch(batchId: string) {
  controllers.get(batchId)?.abort();
  const db = getDB();
  await db.transaction("rw", db.batches, db.photos, db.extractions, async () => {
    await db.extractions.where("batchId").equals(batchId).delete();
    await db.photos.where("batchId").equals(batchId).delete();
    await db.batches.delete(batchId);
  });
}

/** Resume batches interrupted by a reload or closed tab. */
export async function resumeInterruptedBatches() {
  const db = getDB();
  const batches = await db.batches.where("status").anyOf("processing", "extracted").toArray();
  for (const b of batches) void (b.status === "processing" ? runBatch(b.id) : mergeIntoCompanies(b.id));
}
