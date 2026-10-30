"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  action?: { label: string; href: string };
}

/** One transient confirmation at a time (e.g. "Lumen Pay added to My Calendar · View"). */
export function useToast(timeoutMs = 4000) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const counter = useRef(0);
  const show = useCallback((text: string, action?: ToastMessage["action"]) => {
    counter.current += 1;
    setToast({ id: counter.current, text, action });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(t);
  }, [toast, timeoutMs]);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[94px] z-40 flex justify-center lg:inset-x-auto lg:bottom-8 lg:right-8">
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-[536px] items-center gap-2.5 rounded-[14px] bg-ink px-3.5 py-3 text-[13px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] lg:w-auto lg:gap-3.5 lg:rounded-xl lg:px-4 lg:text-sm"
        >
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.action && (
            <Link href={toast.action.href} className="flex-none font-semibold text-primary-dash hover:text-white">
              {toast.action.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
