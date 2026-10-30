"use client";

import { StarIcon } from "@/components/icons/nav-icons";
import { cn } from "@/lib/cn";

/** Company-level Save / Interested toggle. Saved = in My Calendar. */
export function SaveToggle({
  name,
  saved,
  onToggle,
  variant = "card",
  disabled,
}: {
  name: string;
  saved: boolean;
  onToggle: () => void;
  variant?: "card" | "hero";
  disabled?: boolean;
}) {
  if (variant === "hero") {
    return (
      <button
        type="button"
        aria-pressed={saved}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border-[1.5px] text-[15px] font-semibold transition-colors disabled:opacity-60 lg:w-auto lg:px-5",
          saved
            ? "border-primary-dash bg-primary-soft text-primary-hover hover:bg-[#e0e7ff]"
            : "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover",
        )}
      >
        <StarIcon filled={saved} size={18} />
        {saved ? "Interested · in My Calendar" : "Save to My Calendar"}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `${name} is in My Calendar. Remove` : `Add ${name} to My Calendar`}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 flex-none items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors disabled:opacity-60",
        saved ? "border-primary-dash bg-primary-soft text-primary-hover" : "border-line-strong bg-surface text-ink-2 hover:bg-canvas",
      )}
    >
      <StarIcon filled={saved} />
      {saved ? "Interested" : "Save"}
    </button>
  );
}
