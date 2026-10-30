"use client";

import { useEffect } from "react";
import { resumeInterruptedBatches } from "./batch-runner";

/** Mounted once in the root layout so processing continues across pages and resumes after a reload. */
export function BatchRunnerMount() {
  useEffect(() => {
    resumeInterruptedBatches().catch((err) => console.warn("Couldn't resume batches", err));
  }, []);
  return null;
}
