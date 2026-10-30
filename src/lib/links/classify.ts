import type { LinkPurpose, LinkVerification } from "@/domain/types";
import type { ParsedTarget } from "./normalize";

export interface Classification {
  purpose: LinkPurpose;
  /** True when the host alone settles the purpose (e.g. forms.gle); false for path heuristics. */
  certain: boolean;
  /** Short links etc. whose destination can't be known without following them. */
  opaque: boolean;
}

const host = (h: string, ...domains: string[]) => domains.some((d) => h === d || h.endsWith(`.${d}`));

const SHORTENERS = ["bit.ly", "tinyurl.com", "cutt.ly", "rebrand.ly", "t.co", "shorturl.at", "rb.gy", "s.id", "ow.ly", "is.gd", "buff.ly", "t.ly", "goo.gl"];

/**
 * Rule-based purpose for a link. Decoding a URL never makes it "verified";
 * that only happens when its page is read (Phase 6).
 */
export function classifyTarget(t: ParsedTarget): Classification {
  if (t.kind === "email" || t.kind === "phone") return { purpose: "social_contact", certain: true, opaque: false };
  if (t.kind === "text") {
    const isContactCard = /^BEGIN:VCARD|^MECARD:/i.test(t.text);
    return { purpose: isContactCard ? "social_contact" : "unknown", certain: isContactCard, opaque: false };
  }

  const h = t.host;
  const path = new URL(t.url).pathname.toLowerCase();

  // Application forms and ATS apply pages
  if (host(h, "forms.gle") || (h === "docs.google.com" && path.startsWith("/forms"))) return certainly("application_form");
  if (host(h, "forms.office.com", "forms.microsoft.com", "jotform.com", "typeform.com", "tally.so")) return certainly("application_form");
  if (host(h, "myworkdayjobs.com", "greenhouse.io", "lever.co", "smartrecruiters.com", "workable.com", "bamboohr.com", "recruitee.com")) {
    return certainly(/\/apply\b|\/application\b/.test(path) ? "application_form" : "careers");
  }

  // Job boards
  if (host(h, "jobsdb.com", "jobthai.com", "jobbkk.com", "glassdoor.com", "indeed.com", "jobtopgun.com")) return certainly("careers");
  if (h.endsWith("linkedin.com")) return certainly(path.startsWith("/jobs") ? "careers" : "social_contact");

  // Social and messaging
  if (host(h, "facebook.com", "fb.com", "fb.me", "instagram.com", "line.me", "lin.ee", "tiktok.com", "x.com", "twitter.com", "youtube.com", "youtu.be", "wa.me")) {
    return certainly("social_contact");
  }

  // Event platforms
  if (host(h, "eventpop.me", "eventbrite.com", "zipeventapp.com", "lu.ma", "meetup.com", "peatix.com")) return certainly("event_registration");

  if (host(h, ...SHORTENERS)) return { purpose: "unknown", certain: true, opaque: true };

  // Heuristics on the company's own domain
  if (/\/(apply|application|register-intern)\b/.test(path)) return guess("careers"); // could be a form; only evidence can say
  if (/^(careers?|jobs?|recruit(ment)?)\./.test(h) || /\/(careers?|jobs?|join(-us)?|recruit(ment)?|internships?|vacanc(y|ies)|ร่วมงาน)\b/.test(path)) {
    return guess("careers");
  }
  if (/\/(events?|register|registration|webinar|workshop)\b/.test(path)) return guess("event_registration");
  if (path === "/" || path === "" || /^\/(about|about-us|company|th|en|home)?\/?$/.test(path)) return guess("company_info");
  return guess("unknown");
}

function certainly(purpose: LinkPurpose): Classification {
  return { purpose, certain: true, opaque: false };
}
function guess(purpose: LinkPurpose): Classification {
  return { purpose, certain: false, opaque: false };
}

/**
 * Combine the rule result with the purpose the AI inferred from the printed
 * context ("Scan to apply"). The host wins when it is conclusive; otherwise
 * the brochure's own label is better evidence than a path heuristic.
 */
export function resolvePurpose(rule: Classification, aiHint: LinkPurpose | null | undefined): LinkPurpose {
  if (rule.certain || !aiHint || aiHint === "unknown") return rule.purpose;
  return aiHint;
}

/** Initial verification state before any page is fetched. */
export function initialVerification(t: ParsedTarget, rule: Classification): LinkVerification {
  if (t.kind !== "web") return "from_photo";
  if (rule.opaque || rule.purpose === "social_contact") return "not_fetched";
  return "from_photo";
}
