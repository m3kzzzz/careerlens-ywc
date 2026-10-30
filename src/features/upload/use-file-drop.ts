"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drag-and-drop handlers for a drop target. Also stops the browser from
 * navigating to a file dropped outside the target.
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [isDragging, setDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!enabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!enabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!enabled || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) onFiles(files);
    },
  };

  return { isDragging, handlers };
}
