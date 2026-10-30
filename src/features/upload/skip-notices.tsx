import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SkipMessage } from "@/lib/upload/skip-messages";

export function SkipNotices({ messages, onDismiss }: { messages: SkipMessage[]; onDismiss?: () => void }) {
  if (messages.length === 0) return null;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      {messages.map((m) => (
        <div
          key={m.key}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs text-ink-2 lg:rounded-[10px] lg:text-[13px]",
            m.tone === "warning" ? "border-warning-line bg-warning-soft" : "border-line bg-surface",
          )}
        >
          {m.tone === "warning" ? (
            <AlertTriangle size={16} className="mt-px flex-none text-warning" aria-hidden="true" />
          ) : (
            <Info size={16} className="mt-px flex-none text-muted" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{m.title}</b> {m.detail}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-my-1.5 -mr-1.5 flex size-8 flex-none items-center justify-center rounded-lg text-muted hover:text-ink"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
