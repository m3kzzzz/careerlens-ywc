/**
 * Conservative company matching. Two records are merged automatically only
 * on strong evidence (same normalized name without conflicting websites, or
 * the same website with similar names). Anything merely similar goes to
 * Review instead of being merged.
 */

const LEGAL_WORDS = [
  "บริษัท", "บจก", "จำกัด", "มหาชน", "บมจ", "ห้างหุ้นส่วน",
  "co", "company", "limited", "ltd", "plc", "public", "inc", "incorporated", "corp", "corporation", "llc",
];

export function normalizeCompanyName(name: string): string {
  // NFC, not NFKC: NFKC decomposes the Thai vowel "ำ" and breaks matching of "จำกัด".
  let s = name.normalize("NFC").toLowerCase();
  s = s.replace(/\((thailand|ประเทศไทย)\)/g, " ");
  s = s.replace(/[.,()（）'"’&\-–/]+/g, " ");
  const words = s.split(/\s+/).filter((w) => w && !LEGAL_WORDS.includes(w));
  // Thai legal words are often written without spaces ("บริษัทลูเมนเพย์จำกัด").
  return words
    .join(" ")
    .replace(/^บริษัท|จำกัด$|\(?มหาชน\)?$/g, "")
    .trim();
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[()[\]{},.:;'"’\-–/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): string[] {
  const compact = [...s.replace(/\s+/g, "")];
  const out: string[] = [];
  for (let i = 0; i < compact.length - 1; i++) out.push(compact[i] + compact[i + 1]);
  return out;
}

/** Sørensen–Dice similarity of character bigrams, 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const A = bigrams(normalizeCompanyName(a));
  const B = bigrams(normalizeCompanyName(b));
  if (!A.length || !B.length) return normalizeCompanyName(a) === normalizeCompanyName(b) ? 1 : 0;
  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of B) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      overlap++;
      counts.set(g, n - 1);
    }
  }
  return (2 * overlap) / (A.length + B.length);
}

/** Words too common to suggest two names are the same company. */
const GENERIC_WORDS = new Set([
  "digital", "group", "tech", "technology", "technologies", "solutions", "services", "international", "global",
  "thailand", "thai", "siam", "bangkok", "bank", "energy", "labs", "lab", "academy", "studio", "studios", "games",
  "systems", "consulting", "holdings", "the", "and", "of", "data", "software", "media", "pay", "retail", "logistics",
]);

function consonants(word: string) {
  return word.replace(/[aeiou]/g, "");
}

/** "knk" ≈ "kanok": an abbreviation made of a word's consonants. */
function tokensRelated(a: string, b: string) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && /^[a-z]+$/.test(long) && consonants(long) === short;
}

/** True when the names share a distinctive word (or its abbreviation). */
export function shareDistinctiveWord(a: string, b: string): boolean {
  const ta = normalizeCompanyName(a).split(" ").filter((w) => w && !GENERIC_WORDS.has(w));
  const tb = normalizeCompanyName(b).split(" ").filter((w) => w && !GENERIC_WORDS.has(w));
  return ta.some((x) => tb.some((y) => tokensRelated(x, y)));
}

export interface MatchCandidate {
  id: string;
  name: string;
  aliases: string[];
  domains: string[];
}

export interface MatchSubject {
  name: string;
  aliases: string[];
  domains: string[];
}

export type MatchResult =
  | { kind: "match"; companyId: string; reason: string }
  | { kind: "ambiguous"; companyId: string; similarity: number; reasons: string[] }
  | { kind: "new" };

export const AMBIGUOUS_SIMILARITY = 0.6;

export function matchCompany(subject: MatchSubject, candidates: MatchCandidate[]): MatchResult {
  const subjectKeys = new Set([subject.name, ...subject.aliases].map(normalizeCompanyName).filter(Boolean));
  const subjectDomains = new Set(subject.domains);

  let ambiguous: Extract<MatchResult, { kind: "ambiguous" }> | null = null;
  const consider = (companyId: string, similarity: number, reasons: string[]) => {
    if (!ambiguous || similarity > ambiguous.similarity) ambiguous = { kind: "ambiguous", companyId, similarity, reasons };
  };

  for (const c of candidates) {
    const keys = [c.name, ...c.aliases].map(normalizeCompanyName).filter(Boolean);
    const sameName = keys.some((k) => subjectKeys.has(k));
    const sharedDomain = c.domains.some((d) => subjectDomains.has(d));
    const domainConflict = c.domains.length > 0 && subjectDomains.size > 0 && !sharedDomain;
    const similarity = Math.max(...[subject.name, ...subject.aliases].flatMap((n) => [c.name, ...c.aliases].map((m) => nameSimilarity(n, m))));
    const pct = `Names ${Math.round(similarity * 100)}% similar`;

    if (sameName && !domainConflict) return { kind: "match", companyId: c.id, reason: sharedDomain ? "Same name and website" : "Same name" };
    if (sameName && domainConflict) {
      consider(c.id, 0.99, ["Same name", "Different websites"]);
      continue;
    }
    if (sharedDomain && similarity >= 0.5) return { kind: "match", companyId: c.id, reason: "Same website, similar name" };
    if (sharedDomain) {
      consider(c.id, Math.max(similarity, 0.6), ["Same website", "Different names"]);
      continue;
    }
    const related = [subject.name, ...subject.aliases].some((n) => [c.name, ...c.aliases].some((m) => shareDistinctiveWord(n, m)));
    if (similarity >= AMBIGUOUS_SIMILARITY || related) {
      consider(c.id, Math.max(similarity, related ? 0.6 : 0), [
        related && similarity < AMBIGUOUS_SIMILARITY ? "Names look related" : pct,
        domainConflict ? "Different websites" : "No shared website",
      ]);
    }
  }
  return ambiguous ?? { kind: "new" };
}
