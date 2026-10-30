"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/upload/constants";
import { sha256Hex } from "@/lib/upload/hash";
import { planAdditions, type HashedCandidate, type InvalidCandidate, type SkippedFile } from "@/lib/upload/plan-additions";
import { summarizeSkipped, type SkipMessage } from "@/lib/upload/skip-messages";
import { validateImageFile } from "@/lib/upload/validate";
import { getSavedPhotoHashes } from "@/lib/db/queries";

export interface DraftPhoto {
  id: string;
  file: File;
  sha256: string;
  previewUrl: string;
}

interface BatchDraftValue {
  photos: DraftPhoto[];
  messages: SkipMessage[];
  /** True while files are being validated and hashed. */
  adding: boolean;
  /** Exact duplicates skipped so far for this draft (they never use a slot). */
  skippedDuplicates: number;
  slotsLeft: number;
  addFiles: (files: FileList | File[] | null | undefined) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  dismissMessages: () => void;
}

const BatchDraftContext = createContext<BatchDraftValue | null>(null);

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Holds the photos picked for the next batch. Lives in memory (above the
 * routes) so the draft survives moving between pages; it is persisted only
 * once the batch is organized.
 */
export function BatchDraftProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [messages, setMessages] = useState<SkipMessage[]>([]);
  const [adding, setAdding] = useState(false);
  const [skippedDuplicates, setSkippedDuplicates] = useState(0);

  // Mirror of `photos` so overlapping picks see each other's results.
  const photosRef = useRef<DraftPhoto[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: DraftPhoto[]) => {
    photosRef.current = next;
    setPhotos(next);
  }, []);

  const addFiles = useCallback(
    (input: FileList | File[] | null | undefined) => {
      const files = input ? Array.from(input) : [];
      if (files.length === 0) return Promise.resolve();

      const run = async () => {
        setAdding(true);
        try {
          const invalid: InvalidCandidate[] = [];
          const candidates: HashedCandidate[] = [];
          for (const file of files) {
            const reason = validateImageFile(file);
            if (reason) invalid.push({ file, reason });
            else candidates.push({ file, sha256: await sha256Hex(file) });
          }

          let savedHashes = new Map<string, string | null>();
          try {
            savedHashes = await getSavedPhotoHashes();
          } catch (err) {
            // Without IndexedDB we can still dedupe within the batch.
            console.warn("Could not read saved photos for duplicate check", err);
          }

          const plan = planAdditions({
            currentHashes: photosRef.current.map((p) => p.sha256),
            candidates,
            invalid,
            savedHashes,
            limit: MAX_PHOTOS_PER_BATCH,
          });

          const added: DraftPhoto[] = plan.accepted.map(({ file, sha256 }) => ({
            id: newId(),
            file,
            sha256,
            previewUrl: URL.createObjectURL(file),
          }));
          commit([...photosRef.current, ...added]);
          setMessages(summarizeSkipped(plan.skipped as SkippedFile<File>[]));
          const dupes = plan.skipped.filter((s) => s.reason === "already_saved" || s.reason === "duplicate_in_batch");
          if (dupes.length) setSkippedDuplicates((n) => n + dupes.length);
        } finally {
          setAdding(false);
        }
      };

      queue.current = queue.current.then(run, run);
      return queue.current;
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      const target = photosRef.current.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      commit(photosRef.current.filter((p) => p.id !== id));
    },
    [commit],
  );

  const clear = useCallback(() => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    commit([]);
    setMessages([]);
    setSkippedDuplicates(0);
  }, [commit]);

  const dismissMessages = useCallback(() => setMessages([]), []);

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const value = useMemo<BatchDraftValue>(
    () => ({
      photos,
      messages,
      adding,
      skippedDuplicates,
      slotsLeft: MAX_PHOTOS_PER_BATCH - photos.length,
      addFiles,
      remove,
      clear,
      dismissMessages,
    }),
    [photos, messages, adding, skippedDuplicates, addFiles, remove, clear, dismissMessages],
  );

  return <BatchDraftContext.Provider value={value}>{children}</BatchDraftContext.Provider>;
}

export function useBatchDraft(): BatchDraftValue {
  const ctx = useContext(BatchDraftContext);
  if (!ctx) throw new Error("useBatchDraft must be used inside <BatchDraftProvider>");
  return ctx;
}
