"use client";

import { useState } from "react";
import { ImageOff, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { isHeic } from "@/lib/upload/validate";
import type { DraftPhoto } from "./batch-draft-context";

interface PhotoTileProps {
  photo: DraftPhoto;
  index: number;
  onRemove: (id: string) => void;
  variant: "mobile" | "desktop";
}

/** Thumbnail of a picked photo with its number badge and a remove button. */
export function PhotoTile({ photo, index, onRemove, variant }: PhotoTileProps) {
  const [failed, setFailed] = useState(false);
  const n = index + 1;
  const desktop = variant === "desktop";

  return (
    <div
      className={cn(
        "relative aspect-[4/5] overflow-hidden border border-line bg-[#d0c9be]",
        desktop ? "rounded-[10px] bg-surface" : "rounded-xl",
      )}
    >
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-chip p-2 text-center text-muted">
          <ImageOff size={20} aria-hidden="true" />
          <span className="text-[11px] leading-tight">
            {isHeic(photo.file) ? "HEIC preview not supported in this browser" : "Preview unavailable"}
          </span>
        </div>
      ) : (
        // Object URLs aren't supported by next/image optimization; a plain img is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.previewUrl}
          alt={`Photo ${n}: ${photo.file.name}`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          draggable={false}
        />
      )}

      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-ink/72 font-semibold text-white text-[11px]",
          desktop ? "left-2 top-2 h-[22px] min-w-[22px] px-1.5" : "left-1.5 top-1.5 h-5 min-w-5 px-[5px]",
        )}
      >
        {n}
      </span>

      <button
        type="button"
        aria-label={`Remove photo ${n}`}
        onClick={() => onRemove(photo.id)}
        className={cn(
          "absolute flex items-center justify-center",
          desktop
            ? "right-1.5 top-1.5 size-7 rounded-full bg-white/94 text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.2)] hover:bg-white"
            : "right-0.5 top-0.5 size-8", // 32px touch target around a 22px dot
        )}
      >
        {desktop ? (
          <X size={13} strokeWidth={2.4} aria-hidden="true" />
        ) : (
          <span className="flex size-[22px] items-center justify-center rounded-full bg-white/94 text-ink-2 shadow-thumb">
            <X size={11} strokeWidth={2.8} aria-hidden="true" />
          </span>
        )}
      </button>
    </div>
  );
}
