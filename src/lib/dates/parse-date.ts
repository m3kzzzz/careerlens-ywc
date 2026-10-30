/**
 * Deterministic parser for dates printed on Thai and English brochures.
 *
 * Handles Thai month names and abbreviations, Thai digits, Buddhist Era
 * years (พ.ศ. = CE + 543, including two-digit "69" = 2569 = 2026), and
 * numeric day/month ambiguity. It never guesses silently: anything it had to
 * assume is reported in `note` with `ambiguous: true`.
 */

export interface ParsedDate {
  iso: string; // YYYY-MM-DD, Gregorian
  ambiguous: boolean;
  note?: string;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

const THAI_MONTHS: [RegExp, number][] = [
  [/^(มกราคม|ม\.?ค\.?)$/, 1],
  [/^(กุมภาพันธ์|ก\.?พ\.?)$/, 2],
  [/^(มีนาคม|มี\.?ค\.?)$/, 3],
  [/^(เมษายน|เม\.?ย\.?)$/, 4],
  [/^(พฤษภาคม|พ\.?ค\.?)$/, 5],
  [/^(มิถุนายน|มิ\.?ย\.?)$/, 6],
  [/^(กรกฎาคม|ก\.?ค\.?)$/, 7],
  [/^(สิงหาคม|ส\.?ค\.?)$/, 8],
  [/^(กันยายน|ก\.?ย\.?)$/, 9],
  [/^(ตุลาคม|ต\.?ค\.?)$/, 10],
  [/^(พฤศจิกายน|พ\.?ย\.?)$/, 11],
  [/^(ธันวาคม|ธ\.?ค\.?)$/, 12],
];

const EN_MONTHS_FULL = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function toAsciiDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

function monthFromWord(word: string): number | null {
  const w = word.trim().replace(/\.$/, "");
  for (const [re, m] of THAI_MONTHS) if (re.test(w) || re.test(`${w}.`)) return m;
  const en = w.toLowerCase().replace(/\./g, "");
  if (en.length < 3 || !/^[a-z]+$/.test(en)) return null;
  // Accept prefixes of the full name ("nov", "novem", "november") and "sept",
  // but not words that merely start with a month ("marketing").
  const idx = EN_MONTHS_FULL.findIndex((full) => full.startsWith(en));
  if (idx >= 0) return idx + 1;
  return en === "sept" ? 9 : null;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface YearResult {
  year: number;
  note?: string;
  ambiguous?: boolean;
}

/** Resolve a printed year (CE, BE, or two-digit) to a Gregorian year. */
export function resolveYear(raw: string, ctx: { thai: boolean; todayYear: number }): YearResult | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;

  if (raw.length === 4) {
    if (n >= 2400 && n <= 2700) return { year: n - 543, note: `Buddhist Era ${n} converted to ${n - 543}` };
    if (n >= 1900 && n <= 2200) return { year: n };
    return null;
  }

  if (raw.length === 2) {
    const ce = 2000 + n;
    const be = 2500 + n - 543;
    const plausible = (y: number) => y >= ctx.todayYear - 2 && y <= ctx.todayYear + 3;
    const ceOk = plausible(ce);
    const beOk = plausible(be);
    if (ceOk && beOk) {
      return ctx.thai
        ? { year: be, ambiguous: true, note: `Two-digit year "${raw}" read as Buddhist Era 25${raw}` }
        : { year: ce, ambiguous: true, note: `Two-digit year "${raw}" read as 20${raw}` };
    }
    if (beOk) return { year: be, note: `Two-digit year "${raw}" read as Buddhist Era 25${raw} (${be})` };
    if (ceOk) return { year: ce, note: `Two-digit year "${raw}" read as ${ce}` };
    return null;
  }

  return null;
}

/** When no year is printed, assume the next occurrence within the coming year. */
function inferYear(m: number, d: number, today: Date): number {
  const y = today.getUTCFullYear();
  const candidate = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  // Allow dates up to ~2 months in the past to stay in this year (recently closed deadlines).
  return candidate < todayUtc - 60 * 86400000 ? y + 1 : y;
}

export function parseDateText(text: string, today: Date = new Date()): ParsedDate | null {
  if (!text) return null;
  const thai = /[฀-๿]/.test(text);
  let s = toAsciiDigits(text)
    .replace(/\b(พ\.ศ\.|พศ\.?|ค\.ศ\.|คศ\.?|B\.?E\.?|C\.?E\.?)\s*/gi, " ")
    .replace(/(วันที่|ภายใน|ถึง|ก่อน|by|before|until|deadline:?|apply by)/gi, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Weekday names add nothing and can confuse matching.
  s = s.replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s/gi, "").replace(/(วัน)?(จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์)(ที่)?\s?/g, "");
  const todayYear = today.getUTCFullYear();
  const ctx = { thai, todayYear };

  // ISO: 2026-11-02 or 2569-11-02
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const y = resolveYear(m[1], ctx);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y && isValidDate(y.year, mo, d)) return { iso: iso(y.year, mo, d), ambiguous: !!y.ambiguous, note: y.note };
    return null;
  }

  // Numeric: 2/11/2026, 02.11.69, 2-11-2569
  m = s.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = resolveYear(m[3], ctx);
    if (!y) return null;
    const notes = y.note ? [y.note] : [];
    let ambiguous = !!y.ambiguous;
    let day = a;
    let month = b;
    if (a <= 12 && b <= 12 && a !== b) {
      ambiguous = true;
      notes.push(`"${m[0]}" could be day/month or month/day; read as day/month`);
    } else if (a <= 12 && b > 12) {
      day = b;
      month = a;
      notes.push(`"${m[0]}" read as month/day`);
    }
    if (!isValidDate(y.year, month, day)) return null;
    return { iso: iso(y.year, month, day), ambiguous, note: notes.join("; ") || undefined };
  }

  // Day Month [Year]: "2 Nov 2026", "15 ธ.ค. 69", "15 ธันวาคม 2569"
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*([A-Za-z]+\.?|[฀-๿.]+)\s*(\d{4}|\d{2})?(?!\d)/);
  if (m) {
    const month = monthFromWord(m[2]);
    if (month) return finish(Number(m[1]), month, m[3]);
  }

  // Month Day[,] [Year]: "November 2 2026", "Nov 2"
  m = s.match(/\b([A-Za-z]+\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?(?!\d)/);
  if (m) {
    const month = monthFromWord(m[1]);
    if (month) return finish(Number(m[2]), month, m[3]);
  }

  return null;

  function finish(day: number, month: number, yearRaw: string | undefined): ParsedDate | null {
    if (yearRaw) {
      const y = resolveYear(yearRaw, ctx);
      if (!y || !isValidDate(y.year, month, day)) return null;
      return { iso: iso(y.year, month, day), ambiguous: !!y.ambiguous, note: y.note };
    }
    const year = inferYear(month, day, today);
    if (!isValidDate(year, month, day)) return null;
    return { iso: iso(year, month, day), ambiguous: true, note: `No year printed; assumed ${year}` };
  }
}
