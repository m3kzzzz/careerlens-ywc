import type { FileRejection } from "./validate";

/** A file the user picked, already validated and hashed. */
export interface HashedCandidate<F = File> {
  file: F;
  sha256: string;
}

export interface InvalidCandidate<F = File> {
  file: F;
  reason: FileRejection;
}

export type SkipReason =
  | FileRejection
  | "duplicate_in_batch" // same bytes already in this draft batch
  | "already_saved" // same bytes saved from an earlier batch
  | "over_limit"; // batch is full

export interface SkippedFile<F = File> {
  file: F;
  reason: SkipReason;
  /** For "already_saved": the company that photo belongs to, if known. */
  existingCompanyName?: string | null;
}

export interface AdditionPlan<F = File> {
  accepted: HashedCandidate<F>[];
  skipped: SkippedFile<F>[];
}

/**
 * Decide which picked files join the draft batch.
 *
 * Order of checks per file: invalid → exact duplicate of a saved photo →
 * exact duplicate inside this batch (including earlier files in the same
 * pick) → batch limit. Duplicates never consume a slot.
 */
export function planAdditions<F>(input: {
  currentHashes: readonly string[];
  candidates: readonly HashedCandidate<F>[];
  invalid?: readonly InvalidCandidate<F>[];
  /** sha256 → company name (or null when the photo is saved but unassigned). */
  savedHashes: ReadonlyMap<string, string | null>;
  limit: number;
}): AdditionPlan<F> {
  const { currentHashes, candidates, invalid = [], savedHashes, limit } = input;

  const skipped: SkippedFile<F>[] = invalid.map(({ file, reason }) => ({ file, reason }));
  const accepted: HashedCandidate<F>[] = [];
  const seen = new Set(currentHashes);
  let free = Math.max(0, limit - currentHashes.length);

  for (const candidate of candidates) {
    if (savedHashes.has(candidate.sha256)) {
      skipped.push({
        file: candidate.file,
        reason: "already_saved",
        existingCompanyName: savedHashes.get(candidate.sha256) ?? null,
      });
      continue;
    }
    if (seen.has(candidate.sha256)) {
      skipped.push({ file: candidate.file, reason: "duplicate_in_batch" });
      continue;
    }
    if (free === 0) {
      skipped.push({ file: candidate.file, reason: "over_limit" });
      continue;
    }
    seen.add(candidate.sha256);
    accepted.push(candidate);
    free -= 1;
  }

  return { accepted, skipped };
}
