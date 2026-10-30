/**
 * Turn a decoded QR payload or printed URL into something we can store,
 * de-duplicate and classify. Non-web payloads (email, phone, vCard, Wi-Fi,
 * plain text) are kept as text and never opened.
 */

export type ParsedTarget =
  | { kind: "web"; url: string; normalized: string; host: string; domain: string }
  | { kind: "email"; address: string; normalized: string }
  | { kind: "phone"; number: string; normalized: string }
  | { kind: "text"; text: string; normalized: string };

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|igshid|mc_[a-z]+|_ga|ref_src|si)$/i;

/** Second-level suffixes where the registrable domain has three labels. */
const MULTI_PART_SUFFIXES = new Set([
  "co.th", "ac.th", "or.th", "go.th", "in.th", "mi.th", "net.th",
  "co.uk", "ac.uk", "org.uk", "com.sg", "com.my", "co.jp", "co.kr", "com.au", "com.cn", "com.vn",
]);

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

export function parseTarget(raw: string): ParsedTarget {
  const text = raw.trim();

  const mail = text.match(/^mailto:([^?]+)/i) ?? text.match(/^([^\s@/]+@[^\s@/]+\.[a-z]{2,})$/i);
  if (mail) {
    const address = decodeURIComponent(mail[1]).toLowerCase();
    return { kind: "email", address, normalized: `mailto:${address}` };
  }

  const tel = text.match(/^tel:(.+)$/i);
  if (tel) {
    const number = tel[1].replace(/[^\d+]/g, "");
    return { kind: "phone", number, normalized: `tel:${number}` };
  }

  let candidate = text;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate) && BARE_DOMAIN.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { kind: "text", text, normalized: `text:${text}` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "text", text, normalized: `text:${text}` };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "";
  const port = url.port && !["80", "443"].includes(url.port) ? `:${url.port}` : "";

  // Scheme is dropped from the key so http/https variants de-duplicate.
  const normalized = `${host}${port}${path}${query}`;
  return { kind: "web", url: url.toString(), normalized, host, domain: registrableDomain(host) };
}

/** Short display form: "forms.gle/abc" instead of the full URL. */
export function displayUrl(target: ParsedTarget): string {
  switch (target.kind) {
    case "web":
      return target.normalized.length > 60 ? `${target.normalized.slice(0, 57)}…` : target.normalized;
    case "email":
      return target.address;
    case "phone":
      return target.number;
    case "text":
      return target.text.length > 60 ? `${target.text.slice(0, 57)}…` : target.text;
  }
}

/**
 * Safe absolute href for a stored link. Brochures often print bare domains
 * ("beamcheckout.com"); used as-is, a browser would treat them as a path on
 * this site. Returns null for anything that isn't a web, email or phone target.
 */
export function linkHref(raw: string): string | null {
  const t = parseTarget(raw);
  if (t.kind === "web") return t.url;
  if (t.kind === "email") return `mailto:${t.address}`;
  if (t.kind === "phone") return `tel:${t.number}`;
  return null;
}
