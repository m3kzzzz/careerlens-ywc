"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2 } from "lucide-react";
import type { Company, ISODate, Photo, ReviewItem, SourceRef } from "@/domain/types";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { PhotoThumb } from "@/features/processing/processing-parts";
import { getDB } from "@/lib/db";
import { formatShortDate } from "@/lib/dates/deadline";
import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/use-mounted";
import {
  assignPhoto,
  resolveApplicationLink,
  resolveCompanyMatch,
  resolveDeadline,
  skipItem,
  suggestCompanyForPhoto,
} from "@/lib/review/actions";

interface ReviewData {
  items: ReviewItem[];
  companies: Map<string, Company>;
  oppCount: Map<string, number>;
  photos: Map<string, Photo>;
  quotes: Map<string, string>;
}

const APPLY_KINDS = new Set(["deadline_conflict", "unclear_application_link"]);

export function ReviewScreen() {
  const mounted = useMounted();
  return mounted ? <ReviewBody /> : <Frame><div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-chip" /></Frame>;
}

function ReviewBody() {
  const data = useLiveQuery(async (): Promise<ReviewData> => {
    const db = getDB();
    const items = (await db.reviewItems.where("state").equals("open").toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [companies, opps, extractions] = await Promise.all([db.companies.toArray(), db.opportunities.toArray(), db.extractions.toArray()]);
    const photoIds = items.flatMap((i) => [i.payload.photoId, ...((i.payload.photoIds as string[]) ?? [])]).filter((x): x is string => typeof x === "string" && !!x);
    const photos = (await db.photos.bulkGet(photoIds)).filter((p): p is Photo => !!p);
    const oppCount = new Map<string, number>();
    for (const o of opps) oppCount.set(o.companyId, (oppCount.get(o.companyId) ?? 0) + 1);
    const quotes = new Map<string, string>();
    for (const r of extractions) {
      const q = r.extraction.opportunities.map((o) => o.quote ?? o.title.value).filter(Boolean).slice(0, 2).join(" · ");
      if (q) quotes.set(r.photoId, q);
    }
    return { items, companies: new Map(companies.map((c) => [c.id, c])), oppCount, photos: new Map(photos.map((p) => [p.id, p])), quotes };
  });
  const [handled, setHandled] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <Frame><div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-chip" /></Frame>;

  const total = data.items.length + handled;
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setHandled((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    }
  };

  if (data.items.length === 0) {
    return (
      <Frame>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{handled ? "All checked" : "Nothing needs your input"}</h1>
          <p className="max-w-sm text-muted">Everything else was organized automatically. Smaller unverified details are flagged on each company page.</p>
          <Link href="/companies" className="mt-2 inline-flex h-11 items-center rounded-[10px] bg-primary px-5 font-semibold text-white hover:bg-primary-hover">
            Continue to companies →
          </Link>
        </div>
      </Frame>
    );
  }

  const groups = [
    { title: "AFFECTS HOW YOU APPLY", items: data.items.filter((i) => APPLY_KINDS.has(i.kind)) },
    { title: "AFFECTS HOW PHOTOS ARE ORGANIZED", items: data.items.filter((i) => !APPLY_KINDS.has(i.kind)) },
  ].filter((g) => g.items.length);
  let n = handled;

  return (
    <Frame>
      <header className="flex flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] lg:text-[28px]">
            {data.items.length} {data.items.length === 1 ? "thing needs" : "things need"} your input
          </h1>
          <p className="text-[13px] text-muted lg:text-sm">Sorted by what affects you most. Everything else was organized automatically.</p>
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="text-muted">
            {handled} of {total} resolved
          </span>
          <Link href="/companies" className="font-medium text-ink-2 hover:text-ink">
            Skip, review later
          </Link>
        </div>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-3">
          <h2 className="text-xs font-bold tracking-[0.05em] text-muted">{g.title}</h2>
          {g.items.map((item) => {
            n += 1;
            const props = { item, data, index: n, total, act };
            if (item.kind === "uncertain_company_match") return <CompanyMatchCard key={item.id} {...props} />;
            if (item.kind === "photo_without_company") return <PhotoAssignCard key={item.id} {...props} />;
            if (item.kind === "deadline_conflict") return <DeadlineCard key={item.id} {...props} />;
            return <AppLinkCard key={item.id} {...props} />;
          })}
        </section>
      ))}
      <p className="text-center text-xs text-muted">Anything you skip stays marked “Needs check”.</p>
    </Frame>
  );
}

interface CardProps {
  item: ReviewItem;
  data: ReviewData;
  index: number;
  total: number;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}

function Card({ kind, question, detail, index, total, children }: { kind: string; question: string; detail?: React.ReactNode; index: number; total: number; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-[18px] border border-dashed border-[#fcd34d] bg-surface p-4 lg:rounded-2xl lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.05em] text-warning-ink">{kind}</div>
          <h3 className="text-[17px] font-semibold leading-snug">{question}</h3>
          {detail && <p className="mt-0.5 text-[13px] text-muted">{detail}</p>}
        </div>
        <span className="flex-none text-xs text-muted">
          {index} of {total}
        </span>
      </div>
      {children}
    </article>
  );
}

const btn = {
  primary: "inline-flex min-h-11 items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-45",
  secondary: "inline-flex min-h-11 items-center justify-center rounded-[12px] border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-45",
  ghost: "inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-ink-2 hover:text-ink",
};

function CompanyBox({ label, company, name, domains, count }: { label: string; company?: Company; name: string; domains: string[]; count?: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-line bg-canvas p-3">
      <span className="text-[10px] font-bold tracking-[0.05em] text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <CompanyAvatar name={company?.name.value ?? name} className="size-8 rounded-[9px] text-[11px]" />
        <span className="min-w-0 break-words font-semibold">{company?.name.value ?? name}</span>
      </div>
      <span className="break-all text-xs text-muted">
        {domains.length ? domains.join(" · ") : "No website found"}
        {count !== undefined && ` · ${count} ${count === 1 ? "position" : "positions"}`}
      </span>
    </div>
  );
}

function CompanyMatchCard({ item, data, index, total, act }: CardProps) {
  const p = item.payload as { newCompanyId: string; candidateId: string; newName: string; candidateName: string; newDomains: string[]; candidateDomains: string[]; reasons: string[]; photoIds: string[] };
  const candidate = data.companies.get(p.candidateId);
  const fresh = data.companies.get(p.newCompanyId);
  const photo = data.photos.get(p.photoIds?.[0] ?? "");
  return (
    <Card kind="UNCERTAIN COMPANY MATCH" question={`Is ${p.newName} the same as ${candidate?.name.value ?? p.candidateName}?`} detail={p.reasons.join(" · ")} index={index} total={total}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <CompanyBox label="ALREADY SAVED" company={candidate} name={p.candidateName} domains={candidate?.domains ?? p.candidateDomains} count={data.oppCount.get(p.candidateId) ?? 0} />
        <span className="self-center text-xs font-bold text-muted">VS</span>
        <CompanyBox label="FROM THIS BATCH" company={fresh} name={p.newName} domains={fresh?.domains ?? p.newDomains} count={data.oppCount.get(p.newCompanyId) ?? 0} />
      </div>
      {photo && <PhotoThumb photo={photo} className="w-24 rounded-lg border border-line" />}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={() => act(() => resolveCompanyMatch(item.id, "separate"))}>
          Different companies
        </button>
        <button type="button" className={btn.primary} onClick={() => act(() => resolveCompanyMatch(item.id, "merge"))}>
          Same company, merge
        </button>
      </div>
    </Card>
  );
}

function PhotoAssignCard({ item, data, index, total, act }: CardProps) {
  const photoId = item.payload.photoId as string;
  const photo = data.photos.get(photoId);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [newName, setNewName] = useState("");
  useEffect(() => {
    let alive = true;
    suggestCompanyForPhoto(photoId).then((id) => alive && setSuggested(id));
    return () => {
      alive = false;
    };
  }, [photoId]);
  const options = useMemo(() => [...data.companies.values()].sort((a, b) => a.name.value.localeCompare(b.name.value)), [data.companies]);
  const suggestion = suggested ? data.companies.get(suggested) : undefined;
  const quote = data.quotes.get(photoId);

  return (
    <Card kind="PHOTO WITHOUT A COMPANY" question="Which company is this photo from?" detail="No company name, logo or website was found on it." index={index} total={total}>
      <div className="flex gap-3">
        {photo && <PhotoThumb photo={photo} className="w-28 flex-none rounded-lg border border-line" />}
        <div className="flex min-w-0 flex-col gap-1.5 text-[13px]">
          {quote && <p className="italic text-ink-2">“{quote}”</p>}
          {suggestion && <p className="text-muted">Likely <b className="font-semibold text-ink">{suggestion.name.value}</b>: taken within minutes of its brochure.</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {suggestion && (
          <button type="button" className={btn.primary} onClick={() => act(() => assignPhoto(item.id, { companyId: suggestion.id }))}>
            Assign to {suggestion.name.value}
          </button>
        )}
        <div className="flex gap-2">
          <select aria-label="Choose a company" value={other} onChange={(e) => setOther(e.target.value)} className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-surface px-3 text-sm">
            <option value="">Other company…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.value}
              </option>
            ))}
          </select>
          <button type="button" disabled={!other} className={btn.secondary} onClick={() => act(() => assignPhoto(item.id, { companyId: other }))}>
            Assign
          </button>
        </div>
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Or type a new company name" aria-label="New company name" className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-surface px-3 text-base lg:text-sm" />
          <button type="button" disabled={!newName.trim()} className={btn.secondary} onClick={() => act(() => assignPhoto(item.id, { newCompanyName: newName }))}>
            Create
          </button>
        </div>
        <button type="button" className={cn(btn.ghost, "self-start")} onClick={() => act(() => skipItem(item.id))}>
          Skip this photo
        </button>
      </div>
    </Card>
  );
}

function sourceText(sources: SourceRef[]) {
  const s = sources[0];
  if (!s) return "";
  if (s.kind === "photo") return s.quote ? `Brochure photo · “${s.quote}”` : "Brochure photo";
  if (s.kind === "webpage") return "Linked page";
  return "Your edit";
}

function DeadlineCard({ item, data, index, total, act }: CardProps) {
  const p = item.payload as { companyId: string; title: string; options: { value: ISODate; sources: SourceRef[] }[] };
  const company = data.companies.get(p.companyId);
  const [choice, setChoice] = useState<ISODate>(p.options[0]?.value);
  return (
    <Card kind="CONFLICTING DEADLINE" question={`When does ${p.title} close?`} detail={`${company?.name.value ?? "This company"} · the sources give different dates.`} index={index} total={total}>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choose the correct deadline</legend>
        {p.options.map((o) => (
          <label key={o.value} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3", choice === o.value ? "border-primary bg-primary-tint" : "border-line")}>
            <input type="radio" name={item.id} checked={choice === o.value} onChange={() => setChoice(o.value)} className="size-5 accent-primary" />
            <span className="min-w-0">
              <span className="block font-semibold">{formatShortDate(o.value)} {o.value.slice(0, 4)}</span>
              <span className="block text-xs text-muted">{sourceText(o.sources)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} onClick={() => act(() => resolveDeadline(item.id, choice))}>
          Use {formatShortDate(choice)}
        </button>
        <button type="button" className={btn.secondary} onClick={() => act(() => resolveDeadline(item.id, "later"))}>
          Keep both, decide later
        </button>
      </div>
    </Card>
  );
}

function AppLinkCard({ item, data, index, total, act }: CardProps) {
  const p = item.payload as { linkId: string; companyId: string; url: string; label?: string; options: { id: string; title: string }[] };
  const company = data.companies.get(p.companyId);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Card kind="UNCLEAR APPLICATION LINK" question="Which position does this form apply to?" detail={`${company?.name.value ?? "This company"} · the form isn't tied to one position on the brochure.`} index={index} total={total}>
      <div className="rounded-xl border border-primary-line bg-primary-tint px-3 py-2.5 text-[13px]">
        <div className="text-[11px] font-semibold text-primary-hover">Application form</div>
        <div className="break-all font-medium">{p.url}</div>
        {p.label && <div className="text-xs text-muted">Printed next to it: “{p.label}”</div>}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold text-muted">Choose positions</legend>
        {p.options.map((o) => (
          <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1">
            <input type="checkbox" checked={picked.includes(o.id)} onChange={() => setPicked((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))} className="size-5 accent-primary" />
            <span>{o.title}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!picked.length} className={btn.primary} onClick={() => act(() => resolveApplicationLink(item.id, picked))}>
          Save
        </button>
        <button type="button" className={btn.secondary} onClick={() => act(() => resolveApplicationLink(item.id, []))}>
          Not sure, show it as company-wide
        </button>
      </div>
    </Card>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-16 pt-4 lg:px-8 lg:pt-8">
      <div className="flex items-center justify-between lg:hidden">
        <span className="font-semibold">Quick check</span>
        <Link href="/companies" className="flex h-11 items-center px-2 font-medium text-ink-2">
          Later
        </Link>
      </div>
      {children}
    </div>
  );
}
