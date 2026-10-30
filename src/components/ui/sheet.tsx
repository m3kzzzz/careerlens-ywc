"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Modal panel: a bottom sheet on mobile, a right-hand side panel on desktop
 * (the design's pattern for Filters and Add companies). Closes on Escape and
 * backdrop click, locks page scroll and returns focus when closed.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Focus the search field when there is one (Add companies), else the panel itself.
    const search = panelRef.current?.querySelector<HTMLElement>('input[type="search"]');
    (search ?? panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/45 lg:bg-ink/35" onClick={onClose} aria-hidden="true" />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "pb-safe absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.18)] outline-none",
          "lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:border-l lg:border-line lg:shadow-[-16px_0_40px_rgba(0,0,0,0.12)]",
          className,
        )}
      >
        <div className="flex justify-center pb-0.5 pt-2.5 lg:hidden" aria-hidden="true">
          <span className="h-[5px] w-10 rounded-full bg-line-strong" />
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
