"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBatch, runBatch } from "@/features/processing/batch-runner";
import { useLibrarySummary } from "@/lib/db/use-library-summary";
import { useBatchDraft } from "./batch-draft-context";
import { BatchView } from "./batch-view";
import { StartView } from "./start-view";

export function UploadScreen() {
  const draft = useBatchDraft();
  const summary = useLibrarySummary();
  const router = useRouter();
  const [organizeNote, setOrganizeNote] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);

  const batchNumber = summary?.nextBatchNumber ?? 1;
  const onFiles = (files: File[]) => {
    setOrganizeNote(null);
    void draft.addFiles(files);
  };

  if (draft.photos.length === 0) {
    return (
      <StartView
        batchNumber={batchNumber}
        summary={summary}
        adding={draft.adding}
        messages={draft.messages}
        onFiles={onFiles}
        onDismissMessages={draft.dismissMessages}
      />
    );
  }

  return (
    <BatchView
      batchNumber={batchNumber}
      photos={draft.photos}
      summary={summary}
      adding={draft.adding || organizing}
      messages={draft.messages}
      organizeNote={organizeNote}
      onFiles={onFiles}
      onRemove={(id) => {
        setOrganizeNote(null);
        draft.remove(id);
      }}
      onCancel={() => {
        const n = draft.photos.length;
        if (window.confirm(`Remove ${n === 1 ? "this photo" : `all ${n} photos`} from Batch ${batchNumber}?`)) {
          setOrganizeNote(null);
          draft.clear();
        }
      }}
      onOrganize={async () => {
        setOrganizing(true);
        setOrganizeNote(null);
        try {
          const batchId = await createBatch(draft.photos, draft.skippedDuplicates);
          router.push(`/batches/${batchId}`);
          void runBatch(batchId);
          draft.clear();
        } catch (err) {
          console.error("Couldn't start batch", err);
          setOrganizeNote(
            err instanceof Error && err.name === "ConstraintError"
              ? "One of these photos was just saved in another batch. Remove it and try again."
              : "Couldn't save this batch on this device. Check that storage isn't full or blocked, then try again.",
          );
        } finally {
          setOrganizing(false);
        }
      }}
      onDismissMessages={draft.dismissMessages}
    />
  );
}
