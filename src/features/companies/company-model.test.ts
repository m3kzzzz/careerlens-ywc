import { describe, expect, it } from "vitest";
import { company, event, library, link, opportunity } from "@/test/fixtures";
import {
  DEFAULT_FILTERS,
  buildCompanyViews,
  filterCompanies,
  filterPositions,
  jobLinkFor,
  sortCompanies,
  statusCounts,
} from "./company-model";

const today = new Date(2026, 9, 29); // 29 Oct 2026

describe("jobLinkFor (Job Description links)", () => {
  const opp = opportunity("o1", "lp", "Software Engineer Intern");

  it("links to a verified external job-description page tied to the position", () => {
    const jd = link("l1", "lp", "https://lumenpay.co.th/careers/swe", { verification: "verified", opportunityIds: ["o1"] });
    expect(jobLinkFor(opp, [jd])).toEqual({ kind: "external", href: "https://lumenpay.co.th/careers/swe" });
  });

  it("never uses an unverified page, another position's page, or an application form as the JD", () => {
    const unverified = link("l1", "lp", "https://lumenpay.co.th/careers/swe", { opportunityIds: ["o1"] });
    const otherPosition = link("l2", "lp", "https://lumenpay.co.th/careers/qa", { verification: "verified", opportunityIds: ["o2"] });
    const form = link("l3", "lp", "https://forms.gle/x", { purpose: "application_form", verification: "verified", opportunityIds: ["o1"] });
    expect(jobLinkFor(opp, [unverified, otherPosition, form])).toEqual({ kind: "internal", href: "/companies/lp#position-o1" });
  });

  it("rejects unsafe URLs", () => {
    const bad = link("l1", "lp", "javascript:alert(1)", { verification: "verified", opportunityIds: ["o1"] });
    expect(jobLinkFor(opp, [bad]).kind).toBe("internal");
  });

  it("falls back to plain text when there is no evidence to show", () => {
    expect(jobLinkFor({ ...opp, sources: [] }, [])).toEqual({ kind: "plain" });
  });
});

describe("buildCompanyViews", () => {
  const lib = library({
    companies: [
      company("lp", "Lumen Pay", { industry: { value: "Fintech", status: "auto", sources: [] }, photoIds: ["p1", "p2"] }),
      company("mr", "Mekong Retail Group", { updatedAt: "2026-10-20T00:00:00Z" }),
    ],
    opportunities: [
      opportunity("o1", "lp", "QA Engineer Intern"),
      opportunity("o2", "lp", "Software Engineer Intern", { deadlineIso: "2026-11-01" }),
      opportunity("o3", "lp", "Product Design Intern", { deadlineIso: "2026-11-20", deadlineStatus: "uncertain" }),
    ],
    links: [link("l1", "lp", "https://forms.gle/x", { purpose: "application_form", opportunityIds: ["o2"] })],
    events: [event("e1", "lp", "Hackathon", "2026-11-22")],
    interestedIds: new Set(["lp"]),
  });
  const views = buildCompanyViews(lib, today);
  const lp = views.find((v) => v.id === "lp")!;

  it("keeps multiple positions under one company, open and dated first", () => {
    expect(lp.opps.map((o) => o.title)).toEqual(["Software Engineer Intern", "Product Design Intern", "QA Engineer Intern"]);
    expect(lp.opps[0]).toMatchObject({ note: "Closes 1 Nov · 3 days left", noteTone: "red" });
    expect(lp.opps[2]).toMatchObject({ note: "No date in your photos", deadline: undefined });
  });

  it("only offers Apply for an application form tied to that position", () => {
    expect(lp.opps[0].applyLink?.id).toBe("l1");
    expect(lp.opps[1].applyLink).toBeUndefined();
  });

  it("derives saved state, next date, actions and meta from stored data", () => {
    expect(lp).toMatchObject({ saved: true, nextDate: "2026-11-01", meta: "Fintech · 2 photos", uncertainCount: 1 });
    expect([...lp.actions].sort()).toEqual(["apply", "event"]);
    expect(views.find((v) => v.id === "mr")).toMatchObject({ saved: false, opps: [], nextDate: undefined });
  });

  it("searches names, positions and skills; filters by status; sorts by next date", () => {
    expect(filterCompanies(views, DEFAULT_FILTERS, "design").map((v) => v.id)).toEqual(["lp"]);
    expect(filterCompanies(views, DEFAULT_FILTERS, "mekong").map((v) => v.id)).toEqual(["mr"]);
    expect(filterCompanies(views, { ...DEFAULT_FILTERS, statuses: ["open"] }, "").map((v) => v.id)).toEqual(["lp"]);
    expect(filterCompanies(views, { ...DEFAULT_FILTERS, includeWithoutPositions: false }, "").map((v) => v.id)).toEqual(["lp"]);
    expect(sortCompanies(views, "next_date").map((v) => v.id)).toEqual(["lp", "mr"]);
    expect(sortCompanies(views, "recent").map((v) => v.id)).toEqual(["mr", "lp"]);
    expect(statusCounts(views)).toEqual({ open: 2, upcoming: 0, closed: 0, not_specified: 1 });
  });

  it("flattens positions for the Positions view", () => {
    const rows = filterPositions(views, { ...DEFAULT_FILTERS, statuses: ["open"] }, "");
    expect(rows.map((r) => r.opp.title)).toEqual(["Software Engineer Intern", "Product Design Intern"]);
  });
});
