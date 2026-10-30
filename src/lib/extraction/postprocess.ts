import type { ISODate, LinkPurpose, RecruitmentStatus } from "@/domain/types";
import { parseDateText } from "@/lib/dates/parse-date";
import { classifyTarget, initialVerification, resolvePurpose } from "@/lib/links/classify";
import { displayUrl, parseTarget } from "@/lib/links/normalize";
import type { AiPhotoExtraction } from "./ai-schema";
import type {
  DecodedQr,
  ExtractedCompany,
  ExtractedDate,
  ExtractedLink,
  ExtractedOpportunity,
  PhotoExtraction,
} from "./types";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const FREE_MAIL = new Set(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com"]);

function clean(s: string | null | undefined): string | undefined {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
}

function uniq(items: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = clean(raw);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

function todayIso(today: Date): ISODate {
  return today.toISOString().slice(0, 10);
}

/**
 * Turn a printed date into a calendar date. Our deterministic parser is the
 * authority; the model's reading is only a fallback, and then always
 * "uncertain". Anything we can't read is kept as raw text, never invented.
 */
export function resolvePrintedDate(
  printed: { text: string; iso: string | null } | null,
  today: Date,
): { date?: ExtractedDate; unparsed?: string } {
  const raw = clean(printed?.text);
  if (!printed || !raw) return {};
  const parsed = parseDateText(raw, today);
  const aiIso = printed.iso && ISO_RE.test(printed.iso) ? printed.iso : null;

  if (parsed) {
    const notes = parsed.note ? [parsed.note] : [];
    let status: "auto" | "uncertain" = parsed.ambiguous ? "uncertain" : "auto";
    if (aiIso && aiIso !== parsed.iso) {
      status = "uncertain";
      notes.push(`AI read it as ${aiIso}`);
    }
    return { date: { value: parsed.iso, raw, status, note: notes.join("; ") || undefined } };
  }
  if (aiIso) return { date: { value: aiIso, raw, status: "uncertain", note: `Interpreted by AI from "${raw}"` } };
  return { unparsed: raw };
}

/**
 * Recruitment status is set only from stated evidence: an explicit claim or a
 * printed date. Having (or lacking) a link changes nothing.
 */
export function deriveStatus(input: {
  claim: "open" | "upcoming" | "closed" | "none";
  deadline?: ISODate;
  opensAt?: ISODate;
  today: ISODate;
}): RecruitmentStatus {
  const { claim, deadline, opensAt, today } = input;
  if (claim === "closed") return "closed";
  if (deadline && deadline < today) return "closed";
  if (claim === "upcoming" || (opensAt && opensAt > today)) return "upcoming";
  if (claim === "open" || (deadline && deadline >= today)) return "open";
  return "not_specified";
}

function sameCompany(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function buildLink(
  raw: string,
  origin: "qr" | "printed",
  ctx: { companyName: string | null; label: string | null; purpose: LinkPurpose | null; appliesToTitles: string[] },
): ExtractedLink {
  const target = parseTarget(raw);
  const rule = classifyTarget(target);
  return {
    origin,
    raw,
    targetKind: target.kind,
    normalized: target.normalized,
    display: displayUrl(target),
    domain: target.kind === "web" ? target.domain : undefined,
    purpose: resolvePurpose(rule, ctx.purpose),
    verification: initialVerification(target, rule),
    companyName: clean(ctx.companyName) ?? null,
    label: clean(ctx.label),
    appliesToTitles: uniq(ctx.appliesToTitles),
  };
}

export function postprocessExtraction(
  ai: AiPhotoExtraction,
  qr: DecodedQr[],
  meta: { model: string; today?: Date; extractedAt?: string },
): PhotoExtraction {
  const today = meta.today ?? new Date();
  const todayStr = todayIso(today);

  // ── Links: decoded QR codes are the source of truth for QR URLs ──
  const links = new Map<string, ExtractedLink>();
  qr.forEach((code, i) => {
    const ctx = ai.qrCodes.find((q) => q.index === i + 1);
    const link = buildLink(code.text, "qr", {
      companyName: ctx?.companyName ?? null,
      label: ctx?.label ?? null,
      purpose: ctx?.purpose ?? null,
      appliesToTitles: ctx?.appliesToTitles ?? [],
    });
    if (!links.has(link.normalized)) links.set(link.normalized, link);
  });
  for (const p of ai.printedUrls) {
    const raw = clean(p.url);
    if (!raw) continue;
    const link = buildLink(raw, "printed", p);
    const existing = links.get(link.normalized);
    if (existing) {
      existing.label ??= link.label;
      existing.companyName ??= link.companyName;
      existing.appliesToTitles = uniq([...existing.appliesToTitles, ...link.appliesToTitles]);
    } else {
      links.set(link.normalized, link);
    }
  }
  const linkList = [...links.values()];

  // ── Companies ──
  const singleCompany = ai.companies.length === 1 ? clean(ai.companies[0].name) : undefined;
  if (singleCompany) {
    // On a single-company brochure, unattributed links belong to that company.
    for (const l of linkList) l.companyName ??= singleCompany;
  }

  const contacts = ai.contacts
    .map((c) => ({
      companyName: clean(c.companyName) ?? singleCompany ?? null,
      kind: c.kind,
      value: clean(c.value) ?? "",
      label: clean(c.label),
    }))
    .filter((c) => c.value);

  const companies = ai.companies.flatMap((c): ExtractedCompany[] => {
    const name = clean(c.name);
    if (!name) return [];
    const ownLinks = linkList.filter((l) => sameCompany(l.companyName, name));
    const webDomains = ownLinks
      .filter((l) => l.domain && ["company_info", "careers", "unknown", "event_registration"].includes(l.purpose))
      .filter((l) => !classifyTarget(parseTarget(l.raw)).certain) // skip job boards, forms, shorteners
      .map((l) => l.domain);
    const emailDomains = contacts
      .filter((ct) => ct.kind === "email" && sameCompany(ct.companyName, name))
      .map((ct) => ct.value.split("@")[1]?.toLowerCase())
      .filter((d) => d && !FREE_MAIL.has(d));
    const company: ExtractedCompany = {
      name: {
        value: name,
        status: c.nameConfidence === "high" ? "auto" : "uncertain",
        note: c.nameConfidence === "high" ? undefined : "Name was hard to read",
      },
      aliases: uniq(c.aliases).filter((a) => a.toLowerCase() !== name.toLowerCase()),
      description: clean(c.description),
      industry: clean(c.industry),
      locations: uniq(c.locations),
      perks: uniq(c.perks),
      domains: uniq([...webDomains, ...emailDomains]),
      quote: clean(c.quote),
    };
    return [company];
  });

  // ── Opportunities ──
  const opportunities: ExtractedOpportunity[] = ai.opportunities
    .filter((o) => clean(o.title))
    .map((o) => {
      const unparsedDates: string[] = [];
      const deadline = resolvePrintedDate(o.deadline, today);
      const opensAt = resolvePrintedDate(o.opensAt, today);
      if (deadline.unparsed) unparsedDates.push(deadline.unparsed);
      if (opensAt.unparsed) unparsedDates.push(opensAt.unparsed);
      const compensation = clean(o.compensation);
      return {
        companyName: clean(o.companyName) ?? singleCompany ?? null,
        title: {
          value: clean(o.title)!,
          status: o.titleConfidence === "high" ? "auto" : "uncertain",
          note: o.titleConfidence === "high" ? undefined : "Title was hard to read",
        },
        type: o.type ?? undefined,
        status: deriveStatus({
          claim: o.statusClaim,
          deadline: deadline.date?.value,
          opensAt: opensAt.date?.value,
          today: todayStr,
        }),
        statusEvidence: clean(o.statusQuote),
        deadline: deadline.date,
        opensAt: opensAt.date,
        unparsedDates,
        duration: clean(o.duration),
        location: clean(o.location),
        workMode: o.workMode ?? undefined,
        compensation: compensation
          ? {
              value: compensation,
              status: o.compensationConfidence === "high" ? "auto" : "uncertain",
              note: o.compensationConfidence === "high" ? undefined : clean(ai.readabilityNote) ?? "May be misread",
            }
          : undefined,
        requirements: uniq(o.requirements),
        skills: uniq(o.skills),
        howToApply: clean(o.howToApply),
        quote: clean(o.quote),
      };
    });

  const events = ai.events
    .filter((e) => clean(e.title))
    .map((e) => ({
      companyName: clean(e.companyName) ?? singleCompany ?? null,
      title: clean(e.title)!,
      date: resolvePrintedDate(e.date, today).date,
      time: clean(e.time),
      location: clean(e.location),
      quote: clean(e.quote),
    }));

  return {
    schemaVersion: 1,
    model: meta.model,
    extractedAt: meta.extractedAt ?? new Date().toISOString(),
    isRecruitmentMaterial: ai.isRecruitmentMaterial,
    readability: ai.readability,
    readabilityNote: clean(ai.readabilityNote),
    language: ai.language,
    companies,
    opportunities,
    events,
    contacts,
    links: linkList,
  };
}
