"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getLibrarySummary, type LibrarySummary } from "./queries";

const EMPTY: LibrarySummary = { batchCount: 0, nextBatchNumber: 1, photoCount: 0, companyCount: 0, opportunityCount: 0 };

/** Live counts from IndexedDB. `undefined` while loading. */
export function useLibrarySummary(): LibrarySummary | undefined {
  return useLiveQuery(async () => {
    try {
      return await getLibrarySummary();
    } catch {
      return EMPTY;
    }
  });
}
