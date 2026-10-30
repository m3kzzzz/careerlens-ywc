"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, ClipboardCheck, Mail, MapPin, MessageCircle, Phone, User } from "lucide-react";
import type { Contact, Link as StoredLink, Photo, SourceRef } from "@/domain/types";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { PURPOSE, VerificationPill } from "@/components/ui/badges";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { Toast, useToast } from "@/components/ui/toast";
import { PhotoThumb } from "@/features/processing/processing-parts";
import { getDB } from "@/lib/db";
import { setInterested } from "@/lib/db/interests";
import { useLibrary } from "@/lib/db/use-library";
import { daysUntil, formatShortDate } from "@/lib/dates/deadline";
import { cn } from "@/lib/cn";
import { linkHref } from "@/lib/links/normalize";
import { useMounted } from "@/lib/use-mounted";
import { OppStatusBadge } from "./company-card";
import { buildCompanyViews, type CompanyView, type EventView, type OppView } from "./company-model";
import { TYPE_LABEL } from "./filters";
import { EditCompanySheet } from "./edit-company-sheet";
import { SaveToggle } from "./save-toggle";

export function CompanyDetailScreen({ companyId }: { companyId: string }) {
  const mounted = useMounted();
  return mounted ? <DetailBody companyId={companyId} /> : <DetailLoading />;
}

function DetailLoading() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Loading company" className="flex flex-col gap-3 px-4 pt-4 lg:px-0">
        <div className="h-44 animate-pulse rounded-2xl bg-chip" />
        <div className="h-64 animate-pulse rounded-2xl bg-chip" />
      </div>
    </Frame>
  );
}

function DetailBody({ companyId }: { companyId: string }) {
  const data = useLibrary();
  const [now] = useState(() => new Date());
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const company = useMemo(
    () => (data.state === "ready" ? buildCompanyViews(data.library, now).find((c) => c.id === companyId) : undefined),
    [data, now, companyId],
  );
  const photos = useLiveQuery(
    async () => (company ? (await getDB().photos.bulkGet(company.company.photoIds)).filter((p): p is Photo => !!p) : []),
    [company?.company.photoIds.join(",")],
  );

  if (data.state === "loading") return <DetailLoading />;
  if (data.state === "error") {
    return (
      <Frame>
        <p role="alert" className="mx-4 mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger lg:mx-0">
          {data.message}
        </p>
      </Frame>
    );
  }
  if (!company) {
    return (
      <Frame>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
          <h1 className="text-xl font-semibold">This company isn&apos;t on this device</h1>
          <p className="text-muted">It may have been merged into another company, or saved in a different browser.</p>
          <Link href="/companies" className="font-semibold text-primary hover:text-primary-hover">
            Back to companies
          </Link>
        </div>
      </Frame>
    );
  }

  const photoIndex = new Map(company.company.photoIds.map((id, i) => [id, i + 1]));
  const sourceLabel = (sources: SourceRef[]) => {
    const labels = [
      ...new Set(
        sources.map((s) => (s.kind === "photo" ? `Photo ${photoIndex.get(s.photoId) ?? "?"}` : s.kind === "webpage" ? "linked page" : "your edit")),
      ),
    ];
    return labels.length ? `from ${labels.join(", ")}` : "";
  };

  const onToggle = async () => {
    setBusy(true);
    try {
      await setInterested(company.id, !company.saved);
      show(company.saved ? `${company.name} removed from My Calendar` : `${company.name} added to My Calendar`, { label: "View", href: "/calendar" });
    } catch (err) {
      console.error(err);
      show("Couldn't save that change on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const today = now;
  const openOpps = company.opps.filter((o) => o.status === "open");
  const nextDeadline = company.opps.filter((o) => o.deadline && o.status !== "closed" && daysUntil(o.deadline, today) >= 0).map((o) => o.deadline!).sort()[0];
  const nextEvent = company.events.find((e) => e.date && daysUntil(e.date, today) >= 0);
  const datedThings = [nextDeadline ? `deadlines (${formatShortDate(nextDeadline, today)})` : null, nextEvent ? `events (${formatShortDate(nextEvent.date!, today)})` : null].filter(Boolean);
  const saveHint = company.saved
    ? datedThings.length
      ? `Its ${datedThings.join(" and ")} show in My Calendar. Tap to remove.`
      : "Listed in My Calendar. No dates are known yet. Tap to remove."
    : "Adds this company’s deadlines and events to My Calendar.";

  const unverified = collectUnverified(company);

  return (
    <Frame>
      {/* Mobile header */}
      <header className="flex h-14 items-center bg-surface px-1 lg:hidden">
        <Link href="/companies" aria-label="Back to companies" className="flex size-12 items-center justify-center text-ink">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <span className="min-w-0 flex-1 truncate text-center font-semibold">{company.name}</span>
        <button type="button" onClick={() => setEditing(true)} className="flex h-12 items-center px-3 font-medium text-primary">
          Edit
        </button>
      </header>
      {/* Desktop breadcrumb */}
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-[13px] text-muted lg:flex">
        <button type="button" onClick={() => setEditing(true)} className="order-last ml-auto h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas">
          Edit details
        </button>
        <Link href="/companies" className="hover:text-ink">
          Companies
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{company.name}</span>
      </nav>

      {/* Hero */}
      <section className="flex flex-col gap-4 border-b border-line bg-surface px-4 pb-4 pt-1 lg:rounded-2xl lg:border lg:p-6 lg:shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3.5">
            <CompanyAvatar name={company.name} className="size-14 rounded-2xl text-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5">
                <h1 className="break-words text-[23px] font-semibold leading-[1.15] tracking-[-0.02em] lg:text-[28px]">{company.name}</h1>
                {company.aliases.length > 0 && <span className="thai hidden text-muted lg:inline">{company.aliases.join(" · ")}</span>}
              </div>
              <div className="text-[13px] text-muted">{[company.industry, company.location].filter(Boolean).join(" · ") || company.meta}</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 lg:items-end">
            <SaveToggle name={company.name} saved={company.saved} onToggle={onToggle} variant="hero" disabled={busy} />
            <div className="text-center text-xs text-muted lg:max-w-[300px] lg:text-right">{saveHint}</div>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          <SummaryItem href="#apply" icon={<ClipboardCheck size={14} />} tone="primary">
            {company.opps.length === 0 ? (
              "No positions in your photos yet"
            ) : (
              <>
                <b className="font-semibold">
                  {openOpps.length ? `${openOpps.length} position${openOpps.length === 1 ? "" : "s"} open` : `${company.opps.length} position${company.opps.length === 1 ? "" : "s"}`}
                </b>
                {nextDeadline && (
                  <>
                    {" "}
                    · next deadline{" "}
                    <b className="font-semibold text-warning-ink">
                      {formatShortDate(nextDeadline, today)} ({daysUntil(nextDeadline, today)} days)
                    </b>
                  </>
                )}
              </>
            )}
          </SummaryItem>
          {nextEvent && (
            <SummaryItem href="#events" icon={<CalendarDays size={14} />} tone="social">
              {nextEvent.title} on <b className="font-semibold">{formatShortDate(nextEvent.date!, today)}</b>
            </SummaryItem>
          )}
          {unverified.length > 0 && (
            <SummaryItem href="#check" icon={<span className="text-xs font-bold">!</span>} tone="warning">
              {unverified.length} {unverified.length === 1 ? "detail isn't" : "details aren't"} verified yet
            </SummaryItem>
          )}
        </ul>
      </section>

      <div className="flex flex-col gap-6 p-4 lg:flex-row lg:flex-wrap lg:items-start lg:p-0">
        <div className="flex min-w-0 flex-col gap-6 lg:flex-[999_1_620px]">
          {/* 1. Apply */}
          <section id="apply" className="flex scroll-mt-4 flex-col gap-2.5 lg:gap-3">
            <h2 className="text-[17px] font-semibold lg:text-[19px]">Apply</h2>
            {company.opps.length === 0 && company.generalApplyLinks.length === 0 && company.generalCareerLinks.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-[13px] text-muted">
                No positions or application links were found in your photos for this company.
              </p>
            )}
            {company.opps.map((o) => (
              <OpportunityCard key={o.id} o={o} sourceLabel={sourceLabel(o.opp.sources)} />
            ))}
            {company.generalApplyLinks.map((l) => (
              <article key={l.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 lg:rounded-2xl lg:p-4">
                <div className="font-semibold">General application form</div>
                <p className="text-xs text-muted">Not tied to one position in your photos. {sourceLabel(l.sources)}</p>
                <ExternalButton href={l.rawUrl} tone="primary">
                  Open application form
                </ExternalButton>
                <VerificationNote link={l} />
              </article>
            ))}
            {company.generalCareerLinks.map((l) => {
              const label = l.sources.find((s) => s.kind === "photo")?.quote;
              return (
                <article key={l.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 lg:rounded-2xl lg:p-4">
                  <div className="font-semibold">Explore careers</div>
                  <p className="text-xs text-muted">
                    {label ? `Printed as “${label}”. ` : ""}A careers channel, not a direct application form.
                  </p>
                  <ExternalButton href={l.rawUrl} tone="careers">
                    Open {l.normalizedUrl.split("/")[0]}
                  </ExternalButton>
                </article>
              );
            })}
          </section>

          {/* 2. Events */}
          {company.events.length > 0 && (
            <section id="events" className="flex scroll-mt-4 flex-col gap-2.5 lg:gap-3">
              <h2 className="text-[17px] font-semibold lg:text-[19px]">Events</h2>
              {company.events.map((e) => (
                <EventCard key={e.id} e={e} sourceLabel={sourceLabel(e.event.sources)} />
              ))}
            </section>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:flex-[1_1_340px] lg:gap-4">
          {/* 3. Contact */}
          <ContactSection company={company} sourceLabel={sourceLabel} />

          {/* 4. About */}
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-semibold lg:hidden">About {company.name}</h2>
            <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-3.5 lg:rounded-2xl lg:p-[18px]">
              <h2 className="hidden text-base font-semibold lg:block">About {company.name}</h2>
              {company.description ? (
                <p className="text-ink-2">
                  {company.description}{" "}
                  <span className="text-[11px] text-muted">{sourceLabel(company.company.description?.sources ?? [])}</span>
                </p>
              ) : (
                <p className="text-[13px] text-muted">No description in your photos.</p>
              )}
              {company.company.perks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {company.company.perks.map((p) => (
                    <span key={p.value} className="rounded-md bg-chip px-[9px] py-0.5 text-xs">
                      {p.value}
                    </span>
                  ))}
                </div>
              )}
              <AboutLinks links={company.links} />
            </div>
          </section>

          {/* 5. Not verified yet */}
          {unverified.length > 0 && (
            <section id="check" className="flex scroll-mt-4 flex-col gap-2.5">
              <h2 className="text-[17px] font-semibold lg:hidden">
                Not verified yet <span className="text-warning-ink">{unverified.length}</span>
              </h2>
              <div className="overflow-hidden rounded-[18px] border border-warning-line bg-surface lg:rounded-2xl">
                <h2 className="hidden px-[18px] pb-1.5 pt-4 text-base font-semibold lg:block">
                  Not verified yet <span className="text-warning-ink">{unverified.length}</span>
                </h2>
                {unverified.map((u, i) => (
                  <div key={i} className="flex items-start gap-2.5 border-b border-[#fef3c7] px-3.5 py-3 last:border-b-0 lg:px-[18px]">
                    <AlertTriangle size={15} className="mt-0.5 flex-none text-warning" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className="font-semibold">{u.title}</b>
                      <span className="block text-xs text-muted">{u.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* 6. All links & sources */}
      <div className="px-4 pb-4 lg:px-0">
        <AllLinksAndSources company={company} photos={photos ?? []} photoIndex={photoIndex} />
      </div>
      <EditCompanySheet open={editing} onClose={() => setEditing(false)} company={company} />
      <Toast toast={toast} />
    </Frame>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────

function SummaryItem({ href, icon, tone, children }: { href: string; icon: React.ReactNode; tone: "primary" | "social" | "warning"; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="flex items-center gap-2.5 text-[13px] text-ink lg:text-sm">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 flex-none items-center justify-center rounded-full",
            tone === "primary" && "bg-primary-soft text-primary",
            tone === "social" && "bg-social-soft text-social",
            tone === "warning" && "bg-[#fef3c7] text-warning-ink",
          )}
        >
          {icon}
        </span>
        <span className="flex-1">{children}</span>
      </a>
    </li>
  );
}

function ExternalButton({ href: raw, tone, children }: { href: string; tone: "primary" | "careers" | "neutral"; children: React.ReactNode }) {
  const href = linkHref(raw);
  if (!href) return <span className="text-xs text-muted">This link can&apos;t be opened: “{raw}”</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center justify-center gap-2 rounded-[13px] px-4 py-2 text-center font-semibold leading-snug",
        tone === "primary" && "min-h-[50px] bg-primary text-[15px] text-white hover:bg-primary-hover lg:min-h-11 lg:rounded-[10px] lg:text-sm",
        tone === "careers" && "min-h-[46px] rounded-xl border border-updated-line bg-updated-soft text-updated hover:bg-[#cffafe] lg:min-h-10 lg:rounded-[10px] lg:text-sm",
        tone === "neutral" && "min-h-10 rounded-[10px] border border-line-strong bg-surface text-sm text-ink hover:bg-canvas",
      )}
    >
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}

function VerificationNote({ link }: { link: StoredLink }) {
  if (link.verification === "verified") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Check size={13} aria-hidden="true" />
        Verified{link.pageTitle ? `: page title is “${link.pageTitle}”` : " on the linked page"}
      </span>
    );
  }
  if (link.verification === "unreadable") return <span className="text-xs text-warning-ink">We couldn&apos;t read this page. Check the details there.</span>;
  return <span className="text-xs text-muted">From your photo. We haven&apos;t opened this page.</span>;
}

function OpportunityCard({ o, sourceLabel }: { o: OppView; sourceLabel: string }) {
  const [open, setOpen] = useState(false);
  const opp = o.opp;
  const meta = [o.type ? TYPE_LABEL[o.type] : null, opp.duration?.value, [opp.location?.value, opp.workMode?.value].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const chips = [...new Set([...opp.skills.map((s) => s.value), ...opp.requirements.map((r) => r.value).filter((r) => r.length <= 32)])].slice(0, 6);
  const hasDetails = opp.requirements.length > 0 || !!opp.howToApply || !!opp.compensation;
  const minimal = !o.deadline && !o.opensAt && !o.applyLink && !o.careersLink && !hasDetails && chips.length === 0;

  if (minimal) {
    return (
      <article id={`position-${o.id}`} className="flex scroll-mt-4 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 lg:px-4">
        <div className="min-w-0 flex-1">
          <div className="break-words font-semibold">{o.title}</div>
          <div className="text-xs text-muted">Mentioned {sourceLabel ? sourceLabel.replace(/^from /, "on ") : "in your photos"}. No dates or application link found.</div>
        </div>
        <OppStatusBadge status={o.status} />
      </article>
    );
  }

  return (
    <article
      id={`position-${o.id}`}
      className={cn("scroll-mt-4 overflow-hidden rounded-[18px] border bg-surface lg:rounded-2xl", o.applyLink ? "border-primary-line" : "border-line")}
    >
      <div className="flex flex-col gap-2 px-3.5 pb-3 pt-3.5 lg:px-4 lg:pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <OppStatusBadge status={o.status} />
          <span className={cn("text-[13px] font-semibold", o.noteTone === "red" ? "text-danger" : o.noteTone === "amber" ? "text-warning-ink" : "text-muted")}>
            {o.note}
          </span>
          {o.deadlineUncertain && <span className="text-[11px] text-warning-ink">· date needs a check</span>}
          {sourceLabel && <span className="text-[11px] text-muted">· {sourceLabel}</span>}
        </div>
        <h3 className={cn("break-words text-[17px] font-semibold leading-[1.3]", o.titleUncertain && "text-warning-ink")}>
          {o.titleUncertain ? <span className="border-b-2 border-dotted border-warning">{o.title}</span> : o.title}
        </h3>
        {meta && <div className="text-[13px] text-muted">{meta}</div>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-md bg-chip px-2 py-0.5 text-xs text-ink-2">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 lg:px-4 lg:pb-4">
        {o.applyLink ? (
          <>
            <ExternalButton href={o.applyLink.rawUrl} tone="primary">
              Apply for {o.title}
            </ExternalButton>
            <VerificationNote link={o.applyLink} />
          </>
        ) : o.careersLink ? (
          <>
            <ExternalButton href={o.careersLink.rawUrl} tone="careers">
              Explore careers page
            </ExternalButton>
            <span className="text-[11px] text-muted">
              A careers listing, not a direct application form.
              {o.careersLink.verification !== "verified" && " We haven't read it, so check the role is listed there."}
            </span>
          </>
        ) : null}
        {hasDetails && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-line text-sm font-medium text-ink-2 hover:bg-canvas"
          >
            {open ? "Hide details" : "Requirements & details"}
            <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line-soft bg-canvas px-3.5 py-3 text-[13px] lg:px-4">
          {opp.requirements.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold tracking-[0.04em] text-muted">REQUIREMENTS</span>
              <span className="text-ink-2">{opp.requirements.map((r) => r.value).join(" · ")}</span>
            </div>
          )}
          {opp.howToApply && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold tracking-[0.04em] text-muted">HOW TO APPLY</span>
              <span className="text-ink-2">{opp.howToApply.value}</span>
            </div>
          )}
          {opp.compensation && (
            <div className={cn("flex flex-col gap-0.5 rounded-[10px] px-2.5 py-2", opp.compensation.status === "uncertain" && "bg-warning-soft")}>
              <span className="text-ink-2">
                Pay{" "}
                <b className={cn("font-semibold", opp.compensation.status === "uncertain" && "border-b-2 border-dotted border-warning text-warning-ink")}>
                  {opp.compensation.value}
                </b>
              </span>
              {opp.compensation.status === "uncertain" && (
                <span className="text-[11px] text-warning-ink">Unverified{opp.compensation.note ? ` · ${opp.compensation.note}` : ""}</span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function EventCard({ e, sourceLabel }: { e: EventView; sourceLabel: string }) {
  const [, m, d] = e.date?.split("-").map(Number) ?? [];
  const ev = e.event;
  return (
    <article className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-3.5 lg:rounded-2xl lg:p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 flex-none flex-col items-center justify-center rounded-xl bg-social-soft text-social">
          {e.date ? (
            <>
              <span className="text-[10px] font-bold">{MON[m - 1]}</span>
              <span className="text-lg font-bold leading-none">{d}</span>
            </>
          ) : (
            <CalendarDays size={18} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words font-semibold">{e.title}</div>
          <div className="text-xs text-muted">
            {[e.date ? null : "No date given", ev.time?.value, ev.location?.value, sourceLabel].filter(Boolean).join(" · ")}
            {e.dateUncertain && <span className="text-warning-ink"> · date needs a check</span>}
          </div>
        </div>
      </div>
      {e.registrationLink && (
        <>
          <ExternalButton href={e.registrationLink.rawUrl} tone="neutral">
            Register for event
          </ExternalButton>
          <VerificationNote link={e.registrationLink} />
        </>
      )}
    </article>
  );
}

const CONTACT_ICON = { email: Mail, phone: Phone, line: MessageCircle, booth: MapPin, person: User, other: User };

function contactAction(c: Contact): { title: string; href?: string } {
  const v = c.value.value.trim();
  if (c.kind === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { title: "Email recruiter", href: `mailto:${v}` };
  if (c.kind === "phone" && /^[+\d][\d\s-]{5,}$/.test(v)) return { title: "Call", href: `tel:${v.replace(/[\s-]/g, "")}` };
  if (c.kind === "line") return { title: "LINE" };
  if (c.kind === "booth") return { title: c.label ?? "At the job fair" };
  return { title: c.label ?? "Contact" };
}

function ContactSection({ company, sourceLabel }: { company: CompanyView; sourceLabel: (s: SourceRef[]) => string }) {
  const social = company.links.filter((l) => l.purpose === "social_contact" && /^https?:/i.test(linkHref(l.rawUrl) ?? ""));
  if (company.contacts.length === 0 && social.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[17px] font-semibold lg:hidden">Contact</h2>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface lg:rounded-2xl">
        <h2 className="hidden px-[18px] pb-2 pt-4 text-base font-semibold lg:block">Contact</h2>
        {company.contacts.map((c) => {
          const Icon = CONTACT_ICON[c.kind];
          const { title, href } = contactAction(c);
          const body = (
            <>
              <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-chip text-ink-2">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block break-all text-xs text-muted">
                  {c.value.value} {sourceLabel(c.sources) && `· ${sourceLabel(c.sources)}`}
                </span>
              </span>
            </>
          );
          return href ? (
            <a key={c.id} href={href} className="flex min-h-[60px] items-center gap-3 border-b border-chip px-3.5 py-2 last:border-b-0 hover:bg-canvas lg:px-[18px]">
              {body}
            </a>
          ) : (
            <div key={c.id} className="flex min-h-[60px] items-center gap-3 border-b border-chip px-3.5 py-2 last:border-b-0 lg:px-[18px]">
              {body}
            </div>
          );
        })}
        {social.map((l) => (
          <a
            key={l.id}
            href={linkHref(l.rawUrl)!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[52px] items-center gap-3 border-b border-chip px-3.5 py-2 last:border-b-0 hover:bg-canvas lg:px-[18px]"
          >
            <span className="min-w-0 flex-1 break-all text-[13px] font-medium">{l.normalizedUrl}</span>
            <ArrowUpRight size={15} className="flex-none text-muted" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

function AboutLinks({ links }: { links: StoredLink[] }) {
  const site = links.find((l) => l.purpose === "company_info" && /^https?:/i.test(linkHref(l.rawUrl) ?? ""));
  const linkedin = links.find((l) => /linkedin\.com\/company/i.test(l.rawUrl));
  if (!site && !linkedin) return null;
  return (
    <div className="flex gap-2">
      {site && (
        <a href={linkHref(site.rawUrl)!} target="_blank" rel="noopener noreferrer" className="rounded-[10px] border border-line-strong px-3 py-2 text-sm font-medium hover:bg-canvas">
          Website ↗
        </a>
      )}
      {linkedin && (
        <a href={linkHref(linkedin.rawUrl) ?? undefined} target="_blank" rel="noopener noreferrer" className="rounded-[10px] border border-line-strong px-3 py-2 text-sm font-medium hover:bg-canvas">
          LinkedIn ↗
        </a>
      )}
    </div>
  );
}

function collectUnverified(c: CompanyView): { title: string; detail: string }[] {
  const out: { title: string; detail: string }[] = [];
  if (c.company.name.status === "uncertain") out.push({ title: `Company name “${c.name}”`, detail: c.company.name.note ?? "Hard to read on the photo" });
  for (const o of c.opps) {
    if (o.titleUncertain) out.push({ title: `Position “${o.title}”`, detail: o.opp.title.note ?? "Title was hard to read" });
    if (o.deadlineUncertain && o.deadline) out.push({ title: `${o.title}: deadline ${formatShortDate(o.deadline)}`, detail: o.opp.deadline?.note ?? "Date needs a check" });
    if (o.opp.compensation?.status === "uncertain") out.push({ title: `Pay ${o.opp.compensation.value}`, detail: o.opp.compensation.note ?? "May be misread" });
  }
  for (const e of c.events) if (e.dateUncertain && e.date) out.push({ title: `${e.title}: ${formatShortDate(e.date)}`, detail: e.event.date?.note ?? "Date needs a check" });
  for (const l of c.links) {
    if (l.verification === "unreadable") out.push({ title: `${PURPOSE[l.purpose].label} couldn't be read`, detail: l.normalizedUrl });
    else if (l.verification === "not_fetched" && l.purpose === "unknown") out.push({ title: "Short link, destination unknown", detail: `${l.normalizedUrl} · not opened automatically` });
  }
  return out;
}

function AllLinksAndSources({ company, photos, photoIndex }: { company: CompanyView; photos: Photo[]; photoIndex: Map<string, number> }) {
  const [open, setOpen] = useState(false);
  const pagesRead = company.links.filter((l) => l.verification === "verified").length;
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface lg:rounded-2xl">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left lg:px-[18px]">
        <span className="flex-1">
          <span className="block font-semibold">All links &amp; sources</span>
          <span className="block text-xs text-muted">
            {company.links.length} {company.links.length === 1 ? "link" : "links"} · {company.photoCount} {company.photoCount === 1 ? "photo" : "photos"} · {pagesRead}{" "}
            {pagesRead === 1 ? "page" : "pages"} read
          </span>
        </span>
        <ChevronDown size={18} className={cn("text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col border-t border-line-soft px-3.5 pb-3.5 pt-1 lg:px-[18px]">
          {company.links.length === 0 && <p className="py-2.5 text-[13px] text-muted">No links found in your photos.</p>}
          {company.links.map((l) => {
            const photoSrc = l.sources.find((s) => s.kind === "photo");
            return (
              <div key={l.id} className="flex flex-col gap-0.5 border-b border-chip py-[9px]">
                <span className="break-all text-[13px] font-medium">{l.rawUrl}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  {PURPOSE[l.purpose].label} · <VerificationPill state={l.verification} />
                  {photoSrc?.kind === "photo" && ` · ${l.origin === "qr" ? "QR on" : "printed on"} Photo ${photoIndex.get(photoSrc.photoId) ?? "?"}`}
                </span>
              </div>
            );
          })}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-3 lg:grid-cols-6">
              {photos.map((p) => (
                <figure key={p.id} className="flex flex-col gap-1">
                  <PhotoThumb photo={p} className="rounded-[9px] border border-line" />
                  <figcaption className="truncate text-[11px] text-muted">
                    Photo {photoIndex.get(p.id)} · {p.fileName}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[560px] lg:flex lg:max-w-[1200px] lg:flex-col lg:gap-5 lg:px-8 lg:pb-20 lg:pt-6">
      {children}
      <MobileBottomNav />
    </div>
  );
}
