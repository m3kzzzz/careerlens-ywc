import { MAX_FILE_BYTES, MAX_PHOTOS_PER_BATCH } from "./constants";
import type { SkippedFile } from "./plan-additions";

export interface SkipMessage {
  key: string;
  tone: "info" | "warning";
  title: string;
  detail: string;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function names(files: { name: string }[], max = 2) {
  const shown = files.slice(0, max).map((f) => f.name);
  const rest = files.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/** Turn skipped files into the short notices shown under the photo grid. */
export function summarizeSkipped<F extends { name: string }>(skipped: SkippedFile<F>[]): SkipMessage[] {
  const by = (reason: SkippedFile["reason"]) => skipped.filter((s) => s.reason === reason);
  const out: SkipMessage[] = [];

  const saved = by("already_saved");
  if (saved.length) {
    const companies = [...new Set(saved.map((s) => s.existingCompanyName).filter(Boolean))] as string[];
    out.push({
      key: "already_saved",
      tone: "info",
      title: `${plural(saved.length, "duplicate")} skipped.`,
      detail:
        companies.length === 1
          ? `${names(saved.map((s) => s.file))} is already in your dashboard under ${companies[0]}. It doesn't use a slot.`
          : `${names(saved.map((s) => s.file))} ${saved.length === 1 ? "is" : "are"} already saved from an earlier batch. ${saved.length === 1 ? "It doesn't" : "They don't"} use a slot.`,
    });
  }

  const inBatch = by("duplicate_in_batch");
  if (inBatch.length) {
    out.push({
      key: "duplicate_in_batch",
      tone: "info",
      title: `${plural(inBatch.length, "duplicate")} skipped.`,
      detail: `${names(inBatch.map((s) => s.file))} ${inBatch.length === 1 ? "is" : "are"} already in this batch.`,
    });
  }

  const over = by("over_limit");
  if (over.length) {
    out.push({
      key: "over_limit",
      tone: "warning",
      title: `${plural(over.length, "photo")} not added.`,
      detail: `A batch holds ${MAX_PHOTOS_PER_BATCH} photos. Organize this one, then add the rest as a new batch.`,
    });
  }

  const unsupported = by("unsupported_type");
  if (unsupported.length) {
    out.push({
      key: "unsupported_type",
      tone: "warning",
      title: `${plural(unsupported.length, "file")} not supported.`,
      detail: `${names(unsupported.map((s) => s.file))}: use JPG, PNG, WebP or HEIC photos.`,
    });
  }

  const tooLarge = by("too_large");
  if (tooLarge.length) {
    out.push({
      key: "too_large",
      tone: "warning",
      title: `${plural(tooLarge.length, "photo")} too large.`,
      detail: `${names(tooLarge.map((s) => s.file))}: each photo must be under ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`,
    });
  }

  const empty = by("empty");
  if (empty.length) {
    out.push({
      key: "empty",
      tone: "warning",
      title: `${plural(empty.length, "file")} empty.`,
      detail: `${names(empty.map((s) => s.file))} couldn't be read.`,
    });
  }

  return out;
}
