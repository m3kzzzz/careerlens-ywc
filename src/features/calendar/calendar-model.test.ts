import { describe, expect, it } from "vitest";
import { buildCompanyViews } from "@/features/companies/company-model";
import { company, event, library, opportunity } from "@/test/fixtures";
import {
  addCandidates,
  collectCalendarItems,
  companySummary,
  groupByDate,
  interestedRows,
  longDayLabel,
  monthGrid,
  shortMonthDay,
} from "./calendar-model";

const today = new Date(2026, 9, 29);

describe("monthGrid", () => {
  it("builds six Sunday-first weeks with correct weekday alignment", () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].map((d) => d.iso)).toEqual([
      "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
    ]);
    expect(weeks[0][4]).toEqual({ iso: "2026-10-01", day: 1, inMonth: true });
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("handles leap years and year boundaries", () => {
    expect(monthGrid(2028, 1).flat().filter((d) => d.inMonth)).toHaveLength(29);
    expect(monthGrid(2026, 11).flat().at(-1)!.iso.startsWith("2027-01")).toBe(true);
  });

  it("formats labels", () => {
    expect(shortMonthDay("2026-11-02")).toBe("Nov 2");
    expect(longDayLabel("2026-10-31")).toBe("Sat 31 October");
  });
});

describe("calendar items", () => {
  const lib = library({
    companies: [company("lp", "Lumen Pay"), company("kd", "Kanok Digital"), company("og", "Orbit Games")],
    opportunities: [
      opportunity("o1", "lp", "Software Engineer Intern", { deadlineIso: "2026-11-02" }),
      opportunity("o2", "lp", "QA Engineer Intern"), // no date
      opportunity("o3", "kd", "Data Analyst Intern", { deadlineIso: "2026-11-02", deadlineStatus: "uncertain" }),
      opportunity("o4", "og", "Game Designer Intern", { deadlineIso: "2026-11-05" }),
    ],
    events: [event("e1", "lp", "Campus Hackathon", "2026-11-22"), event("e2", "lp", "Booth talk")],
    interestedIds: new Set(["lp", "kd"]),
  });
  const views = buildCompanyViews(lib, today);
  const saved = views.filter((v) => v.saved);

  it("marks only stated dates of saved companies", () => {
    const items = collectCalendarItems(saved);
    expect(items.map((i) => [i.iso, i.kind, i.companyName])).toEqual([
      ["2026-11-02", "deadline", "Kanok Digital"],
      ["2026-11-02", "deadline", "Lumen Pay"],
      ["2026-11-22", "event", "Lumen Pay"],
    ]);
    // Orbit Games isn't saved; undated items never appear.
    expect(items.some((i) => i.companyName === "Orbit Games" || i.label === "QA Engineer Intern" || i.label === "Booth talk")).toBe(false);
    expect(groupByDate(items).get("2026-11-02")).toHaveLength(2);
    expect(items[0].uncertain).toBe(true);
  });

  it("keeps undated positions in the card as 'No date', highlights the selected day", () => {
    const lp = saved.find((v) => v.id === "lp")!;
    const rows = interestedRows(lp, "2026-10-29", "2026-11-02");
    expect(rows.map((r) => [r.title, r.date, r.highlighted])).toEqual([
      ["Software Engineer Intern", "Nov 2", true],
      ["QA Engineer Intern", "No date", false],
    ]);
    expect(rows[0].jobLink.kind).toBe("internal");
    expect(interestedRows(lp, "2026-10-31", null)[0].soon).toBe(true);
    expect(companySummary(lp, "2026-10-29")).toBe("2 positions · next Nov 2");
  });

  it("offers unsaved companies in Add, filtered by name, with empty states", () => {
    expect(addCandidates(views, new Set(), "").rows.map((c) => c.name)).toEqual(["Orbit Games"]);
    expect(addCandidates(views, new Set(), "zzz")).toMatchObject({ rows: [], noResults: true, allSaved: false });
    // A company added during this Add session stays listed (shown as "Added").
    expect(addCandidates(views, new Set(["lp"]), "").rows.map((c) => c.id)).toEqual(["lp", "og"]);
    const allSaved = buildCompanyViews({ ...lib, interestedIds: new Set(["lp", "kd", "og"]) }, today);
    expect(addCandidates(allSaved, new Set(), "")).toMatchObject({ allSaved: true, noResults: false });
  });
});
