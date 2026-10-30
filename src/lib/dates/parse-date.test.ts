import { describe, expect, it } from "vitest";
import { parseDateText } from "./parse-date";

const today = new Date(Date.UTC(2026, 9, 29)); // 29 Oct 2026
const p = (s: string) => parseDateText(s, today);

describe("parseDateText", () => {
  it("parses English day-month-year", () => {
    expect(p("2 Nov 2026")).toEqual({ iso: "2026-11-02", ambiguous: false });
    expect(p("Apply by 15 December 2026")).toMatchObject({ iso: "2026-12-15", ambiguous: false });
    expect(p("November 2, 2026")).toMatchObject({ iso: "2026-11-02", ambiguous: false });
  });

  it("converts Buddhist Era years", () => {
    expect(p("15 ธันวาคม 2569")).toMatchObject({ iso: "2026-12-15", ambiguous: false });
    expect(p("15 ธ.ค. 2569")?.iso).toBe("2026-12-15");
    expect(p("วันที่ 2 พ.ย. 69")).toMatchObject({ iso: "2026-11-02" });
    expect(p("2 พ.ย. 69")?.note).toMatch(/Buddhist Era/);
    expect(p("15/12/2569")?.iso).toBe("2026-12-15");
  });

  it("reads Thai digits", () => {
    expect(p("๑๕ ธ.ค. ๒๕๖๙")?.iso).toBe("2026-12-15");
  });

  it("flags day/month ambiguity instead of guessing silently", () => {
    const r = p("03/11/2026");
    expect(r).toMatchObject({ iso: "2026-11-03", ambiguous: true });
    expect(r?.note).toMatch(/day\/month/);
    expect(p("25/11/2026")).toMatchObject({ iso: "2026-11-25", ambiguous: false });
    expect(p("11/25/2026")?.iso).toBe("2026-11-25");
  });

  it("marks a missing year as an assumption", () => {
    const r = p("Closes 20 Dec");
    expect(r).toMatchObject({ iso: "2026-12-20", ambiguous: true });
    expect(r?.note).toMatch(/No year printed/);
    // Early next year rolls forward
    expect(p("15 Jan")?.iso).toBe("2027-01-15");
  });

  it("parses ISO dates", () => {
    expect(p("2026-11-02")?.iso).toBe("2026-11-02");
    expect(p("2569-11-02")?.iso).toBe("2026-11-02");
  });

  it("rejects impossible or unparseable input", () => {
    expect(p("31 Feb 2026")).toBeNull();
    expect(p("ASAP")).toBeNull();
    expect(p("Marketing 2026")).toBeNull();
    expect(p("")).toBeNull();
  });
});
