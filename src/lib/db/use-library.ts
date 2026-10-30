"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { loadLibrary, type Library } from "./library";

export type LibraryState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; library: Library };

/** Live view of stored companies and interests. Updates whenever IndexedDB changes. */
export function useLibrary(): LibraryState {
  const result = useLiveQuery(async (): Promise<LibraryState> => {
    try {
      return { state: "ready", library: await loadLibrary() };
    } catch (err) {
      console.error("Couldn't read saved data", err);
      return { state: "error", message: "Couldn't read data saved on this device. Storage may be blocked in this browser." };
    }
  });
  return result ?? { state: "loading" };
}
