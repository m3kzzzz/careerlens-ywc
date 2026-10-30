import { cn } from "@/lib/cn";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/upload/constants";

/** The ten little dashed slots shown on the start screen. */
export function SlotMeter({ used, size = "sm" }: { used: number; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: MAX_PHOTOS_PER_BATCH }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[4px]",
            size === "sm" ? "h-5 w-3.5" : "h-6 w-[18px]",
            i < used ? "bg-primary" : "border-[1.5px] border-dashed border-line-strong",
          )}
        />
      ))}
    </div>
  );
}

/** Segmented progress bar for the batch preview: one segment per slot. */
export function SlotBar({ used }: { used: number }) {
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${used} of ${MAX_PHOTOS_PER_BATCH} photos`}>
      {Array.from({ length: MAX_PHOTOS_PER_BATCH }, (_, i) => (
        <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < used ? "bg-primary" : "bg-line")} />
      ))}
    </div>
  );
}
