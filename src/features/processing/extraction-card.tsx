"use client";

import { AlertTriangle, CalendarDays, Mail, MapPin, MessageCircle, Phone, User } from "lucide-react";
import type { Photo } from "@/domain/types";
import { CheckBadge, DeadlineBadge, NoDeadlineBadge, PurposeBadge, StatusBadge, VerificationPill } from "@/components/ui/badges";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates/deadline";
import type { ExtractedOpportunity, ExtractedValue, PhotoExtraction } from "@/lib/extraction/types";
import { PhotoThumb } from "./processing-parts";

const TYPE_LABEL: Record<string, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  graduate_program: "Graduate program",
  program_camp: "Program / camp",
  other: "Other",
};

function Uncertain<T extends string>({ field }: { field: ExtractedValue<T> }) {
  if (field.status === "auto") return <>{field.value}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="border-b-2 border-dotted border-warning font-medium text-warning-ink">{field.value}</span>
      <CheckBadge title={field.note} />
    </span>
  );
}

function OpportunityRow({ o }: { o: ExtractedOpportunity }) {
  const meta = [o.type ? TYPE_LABEL[o.type] : null, o.duration, o.location, o.workMode].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-2 border-t border-chip pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={o.status} />
        {o.deadline ? <DeadlineBadge iso={o.deadline.value} uncertain={o.deadline.status === "uncertain"} /> : <NoDeadlineBadge />}
        {o.opensAt && (
          <span className="text-xs font-semibold text-info">Opens {formatShortDate(o.opensAt.value)}</span>
        )}
      </div>
      <div className="text-base font-semibold leading-snug">
        <Uncertain field={o.title} />
      </div>
      {meta && <div className="text-xs font-medium text-muted">{meta}</div>}
      {(o.deadline?.status === "uncertain" || o.unparsedDates.length > 0) && (
        <div className="text-xs text-warning-ink">
          {o.deadline?.status === "uncertain" && (
            <div>
              Deadline printed as “{o.deadline.raw}”. {o.deadline.note}
            </div>
          )}
          {o.unparsedDates.map((d) => (
            <div key={d}>Date printed as “{d}”, couldn&apos;t be read as a calendar date.</div>
          ))}
        </div>
      )}
      {(o.requirements.length > 0 || o.skills.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...o.skills, ...o.requirements])].map((r) => (
            <span key={r} className="rounded-md bg-chip px-[9px] py-[3px] text-xs text-ink-2">
              {r}
            </span>
          ))}
        </div>
      )}
      {o.compensation && (
        <div className="text-[13px]">
          <span className="text-muted">Pay </span>
          <Uncertain field={o.compensation} />
        </div>
      )}
      {o.howToApply && (
        <div className="text-[13px]">
          <span className="text-muted">How to apply </span>
          {o.howToApply}
        </div>
      )}
      {o.statusEvidence && <div className="text-xs text-muted">Status from: “{o.statusEvidence}”</div>}
    </li>
  );
}

const CONTACT_ICON = { email: Mail, phone: Phone, line: MessageCircle, booth: MapPin, person: User, other: User };

export function ExtractionCard({
  photo,
  index,
  extraction,
}: {
  photo: Photo;
  index: number;
  extraction?: PhotoExtraction;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex items-center gap-3 border-b border-line-soft p-3.5">
        <PhotoThumb photo={photo} className="w-12 flex-none rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            Photo {index + 1}
            {extraction?.companies.length ? ` · ${extraction.companies.map((c) => c.name.value).join(", ")}` : ""}
          </div>
          <div className="truncate text-xs text-muted">{photo.fileName}</div>
        </div>
      </header>

      {!extraction ? (
        <div className="flex items-start gap-2 p-4 text-[13px] text-danger">
          <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
          {photo.error?.message ?? "Not read yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {(!extraction.isRecruitmentMaterial || extraction.readability !== "good") && (
            <p className="rounded-[10px] border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              {!extraction.isRecruitmentMaterial
                ? "This doesn't look like recruitment material."
                : `Partly readable${extraction.readabilityNote ? `: ${extraction.readabilityNote}` : "."}`}
            </p>
          )}

          {extraction.companies.length === 0 && extraction.isRecruitmentMaterial && (
            <p className="text-[13px] text-warning-ink">No company name, logo or website was found on this photo.</p>
          )}

          {extraction.companies.map((c) => (
            <section key={c.name.value} className="flex flex-col gap-1">
              <h3 className="text-[15px] font-semibold">
                <Uncertain field={c.name} />
              </h3>
              {c.aliases.length > 0 && <div className="thai text-xs text-muted">Also printed as {c.aliases.join(" · ")}</div>}
              {c.description && <p className="text-[13px] text-ink-2">{c.description}</p>}
              <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                {c.industry && c.industry !== c.description && <span>{c.industry}</span>}
                {c.locations.length > 0 && <span>{c.locations.join(" · ")}</span>}
                {c.domains.length > 0 && <span>{c.domains.join(" · ")}</span>}
              </div>
            </section>
          ))}

          {extraction.opportunities.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Opportunities · {extraction.opportunities.length}
              </h4>
              <ul className="flex flex-col gap-3">
                {extraction.opportunities.map((o, i) => (
                  <OpportunityRow key={`${o.title.value}-${i}`} o={o} />
                ))}
              </ul>
            </section>
          )}

          {extraction.events.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Events</h4>
              <ul className="flex flex-col gap-2">
                {extraction.events.map((e, i) => (
                  <li key={`${e.title}-${i}`} className="flex items-start gap-2.5 text-[13px]">
                    <CalendarDays size={16} className="mt-0.5 flex-none text-muted" aria-hidden="true" />
                    <div>
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-xs text-muted">
                        {[e.date ? formatShortDate(e.date.value) : "No date printed", e.time, e.location]
                          .filter(Boolean)
                          .join(" · ")}
                        {e.date?.status === "uncertain" && " · date needs a check"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {extraction.contacts.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contact</h4>
              <ul className="flex flex-col gap-1.5">
                {extraction.contacts.map((c, i) => {
                  const Icon = CONTACT_ICON[c.kind];
                  return (
                    <li key={`${c.value}-${i}`} className="flex items-center gap-2 text-[13px]">
                      <Icon size={15} className="flex-none text-muted" aria-hidden="true" />
                      <span className="break-all">{c.value}</span>
                      {c.label && <span className="text-xs text-muted">· {c.label}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {extraction.links.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Links</h4>
              <ul className="flex flex-col gap-2">
                {extraction.links.map((l) => (
                  <li key={l.normalized} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PurposeBadge purpose={l.purpose} />
                      <span className="text-xs text-muted">{l.origin === "qr" ? "QR code" : "Printed"}</span>
                      <VerificationPill state={l.verification} />
                    </div>
                    <span className="break-all text-[13px] font-medium">{l.display}</span>
                    {(l.label || l.appliesToTitles.length > 0) && (
                      <span className="text-xs text-muted">
                        {l.label && `“${l.label}”`}
                        {l.appliesToTitles.length > 0 && ` · for ${l.appliesToTitles.join(", ")}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="group text-xs text-muted">
            <summary className={cn("cursor-pointer select-none font-medium hover:text-ink")}>Raw extraction (JSON)</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-chip p-3 font-mono text-[11px] leading-relaxed text-ink-2">
              {JSON.stringify(extraction, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </article>
  );
}
