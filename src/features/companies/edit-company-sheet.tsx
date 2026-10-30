"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PURPOSE } from "@/components/ui/badges";
import { Sheet } from "@/components/ui/sheet";
import { fieldValue } from "@/lib/grouping/plan-commit";
import { removeLink, removeOpportunity, renameCompany, updateLinkUrl, updateOpportunity } from "@/lib/review/corrections";
import { cn } from "@/lib/cn";
import type { CompanyView, OppView } from "./company-model";

/**
 * Correct what the AI read. Every save marks the value "Edited by you";
 * later batches never overwrite it, and removed items aren't re-added.
 */
export function EditCompanySheet({ open, onClose, company }: { open: boolean; onClose: () => void; company: CompanyView }) {
  return (
    <Sheet open={open} onClose={onClose} label={`Edit ${company.name}`} className="h-[88dvh] lg:h-auto">
      <div className="flex items-center justify-between pb-2 pl-4 pr-2 pt-1 lg:pl-6 lg:pr-4 lg:pt-[18px]">
        <h2 className="text-lg font-semibold lg:text-xl">Edit details</h2>
        <button type="button" onClick={onClose} className="h-11 px-3 text-[15px] font-semibold text-primary">
          Done
        </button>
      </div>
      <p className="px-4 pb-3 text-xs text-muted lg:px-6">Your edits are kept when you upload more photos. Original photos stay as evidence.</p>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-8 lg:px-6">
        <NameEditor company={company} />
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold tracking-[0.05em] text-muted">POSITIONS</h3>
          {company.opps.length === 0 && <p className="text-[13px] text-muted">No positions.</p>}
          {company.opps.map((o) => (
            <PositionEditor key={o.id} o={o} />
          ))}
        </section>
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold tracking-[0.05em] text-muted">LINKS</h3>
          {company.links.length === 0 && <p className="text-[13px] text-muted">No links.</p>}
          {company.links.map((l) => (
            <LinkEditor key={l.id} id={l.id} url={l.rawUrl} purpose={PURPOSE[l.purpose].label} />
          ))}
        </section>
      </div>
    </Sheet>
  );
}

function useSaver() {
  const [state, setState] = useState<{ busy: boolean; error: string | null; saved: boolean }>({ busy: false, error: null, saved: false });
  const run = async (fn: () => Promise<void>) => {
    setState({ busy: true, error: null, saved: false });
    try {
      await fn();
      setState({ busy: false, error: null, saved: true });
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : "Couldn't save.", saved: false });
    }
  };
  return { ...state, run };
}

const input = "h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink lg:text-sm";
const smallBtn = "inline-flex h-11 flex-none items-center justify-center rounded-[10px] border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-canvas disabled:opacity-45";

function Status({ error, saved }: { error: string | null; saved: boolean }) {
  if (error) return <p role="alert" className="text-xs text-danger">{error}</p>;
  if (saved) return <p role="status" className="text-xs text-success">Saved · edited by you</p>;
  return null;
}

function NameEditor({ company }: { company: CompanyView }) {
  const [name, setName] = useState(company.name);
  const s = useSaver();
  return (
    <section className="flex flex-col gap-1.5">
      <label htmlFor="edit-company-name" className="text-xs font-bold tracking-[0.05em] text-muted">
        COMPANY NAME
      </label>
      <div className="flex gap-2">
        <input id="edit-company-name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <button type="button" className={smallBtn} disabled={s.busy || !name.trim() || name.trim() === company.name} onClick={() => s.run(() => renameCompany(company.id, name))}>
          Save
        </button>
      </div>
      <Status error={s.error} saved={s.saved} />
    </section>
  );
}

function PositionEditor({ o }: { o: OppView }) {
  const [title, setTitle] = useState(o.title);
  const [deadline, setDeadline] = useState(fieldValue(o.opp.deadline) ?? "");
  const [opens, setOpens] = useState(fieldValue(o.opp.opensAt) ?? "");
  const s = useSaver();
  const dirty = title.trim() !== o.title || deadline !== (fieldValue(o.opp.deadline) ?? "") || opens !== (fieldValue(o.opp.opensAt) ?? "");

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border p-3", o.deadlineUncertain || o.titleUncertain ? "border-warning-line bg-warning-soft/50" : "border-line")}>
      <input aria-label="Position title" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Deadline{o.deadlineUncertain && <span className="text-warning-ink"> · needs a check</span>}
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Applications open
          <input type="date" value={opens} onChange={(e) => setOpens(e.target.value)} className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(smallBtn, "border-primary bg-primary text-white hover:bg-primary-hover")}
          disabled={s.busy || !dirty || !title.trim()}
          onClick={() =>
            s.run(() =>
              updateOpportunity(o.id, {
                title,
                deadline: deadline === (fieldValue(o.opp.deadline) ?? "") ? undefined : deadline || null,
                opensAt: opens === (fieldValue(o.opp.opensAt) ?? "") ? undefined : opens || null,
              }),
            )
          }
        >
          Save
        </button>
        {deadline && (
          <button type="button" className={smallBtn} onClick={() => setDeadline("")}>
            Clear deadline
          </button>
        )}
        <button
          type="button"
          className={cn(smallBtn, "ml-auto border-danger-line text-danger")}
          disabled={s.busy}
          onClick={() => window.confirm(`Remove “${o.title}”? It won't come back from later photos.`) && s.run(() => removeOpportunity(o.id))}
        >
          <Trash2 size={15} aria-hidden="true" />
          <span className="sr-only">Remove position</span>
        </button>
      </div>
      <Status error={s.error} saved={s.saved} />
    </div>
  );
}

function LinkEditor({ id, url, purpose }: { id: string; url: string; purpose: string }) {
  const [value, setValue] = useState(url);
  const s = useSaver();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{purpose}</span>
      <div className="flex gap-2">
        <input aria-label={`${purpose} address`} value={value} onChange={(e) => setValue(e.target.value)} className={input} />
        <button type="button" className={smallBtn} disabled={s.busy || value.trim() === url || !value.trim()} onClick={() => s.run(() => updateLinkUrl(id, value))}>
          Save
        </button>
        <button
          type="button"
          className={cn(smallBtn, "border-danger-line text-danger")}
          disabled={s.busy}
          onClick={() => window.confirm("Remove this link? It won't come back from later photos.") && s.run(() => removeLink(id))}
        >
          <Trash2 size={15} aria-hidden="true" />
          <span className="sr-only">Remove link</span>
        </button>
      </div>
      <Status error={s.error} saved={s.saved} />
    </div>
  );
}
