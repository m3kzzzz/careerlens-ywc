import { describe, expect, it } from "vitest";
import { exCompany, exLink, exOpp, extraction, photo } from "@/test/extraction-fixtures";
import { type Existing, planCommit } from "./plan-commit";

const now = new Date(2026, 9, 30);
const empty = (): Existing => ({
  companies: [],
  opportunities: [],
  links: [],
  events: [],
  contacts: [],
  dismissedUrls: new Set(),
  dismissedPositions: new Set(),
});
let n = 0;
const newId = () => `id${++n}`;
const plan = (photos: Parameters<typeof planCommit>[0]["photos"], existing = empty(), batchId = "b1") =>
  planCommit({ batchId, photos, existing, now, newId });

/** Apply a plan onto an "existing" snapshot, as the Dexie writer does. */
function apply(existing: Existing, p: ReturnType<typeof plan>): Existing {
  const up = <T extends { id: string }>(rows: T[], next: T[]) => {
    const m = new Map(rows.map((r) => [r.id, r]));
    for (const r of next) m.set(r.id, r);
    return [...m.values()];
  };
  return {
    ...existing,
    companies: up(existing.companies, p.companies),
    opportunities: up(existing.opportunities, p.opportunities),
    links: up(existing.links, p.links),
    events: up(existing.events, p.events),
    contacts: up(existing.contacts, p.contacts),
  };
}

describe("planCommit", () => {
  it("groups several photos of one company and keeps several positions under it", () => {
    const p = plan([
      { photo: photo("p1"), extraction: extraction({ companies: [exCompany("Lumen Pay")], opportunities: [exOpp("Backend Intern")] }) },
      { photo: photo("p2"), extraction: extraction({ companies: [exCompany("LUMEN PAY Co., Ltd.")], opportunities: [exOpp("QA Intern"), exOpp("Backend Intern")] }) },
    ]);
    expect(p.companies).toHaveLength(1);
    // "LUMEN PAY Co., Ltd." normalizes to the same name, so it isn't stored as an alias.
    expect(p.companies[0]).toMatchObject({ photoIds: ["p1", "p2"], aliases: [] });
    expect(p.opportunities.map((o) => o.title.value).sort()).toEqual(["Backend Intern", "QA Intern"]);
    expect(p.opportunities.find((o) => o.title.value === "Backend Intern")!.sources).toHaveLength(2);
    expect(p.reviewItems).toEqual([]);
  });

  it("keeps different companies in one batch apart and attributes positions by name", () => {
    const p = plan([
      {
        photo: photo("p1"),
        extraction: extraction({
          companies: [exCompany("Lumen Pay"), exCompany("Orbit Games")],
          opportunities: [exOpp("Game Designer Intern", { companyName: "Orbit Games" }), exOpp("Backend Intern", { companyName: "Lumen Pay" })],
        }),
      },
    ]);
    expect(p.companies.map((c) => c.name.value).sort()).toEqual(["Lumen Pay", "Orbit Games"]);
    const orbit = p.companies.find((c) => c.name.value === "Orbit Games")!;
    expect(p.opportunities.find((o) => o.title.value === "Game Designer Intern")!.companyId).toBe(orbit.id);
  });

  it("sends an ambiguous company to review instead of merging it", () => {
    const first = plan([{ photo: photo("p1"), extraction: extraction({ companies: [exCompany("Kanok Digital", { domains: ["kanokdigital.co.th"] })] }) }]);
    const second = plan(
      [{ photo: photo("p2"), extraction: extraction({ companies: [exCompany("KNK Digital Academy", { domains: ["knk.ac.th"] })] }) }],
      apply(empty(), first),
      "b2",
    );
    expect(second.stats.newCompanies).toBe(1);
    expect(second.reviewItems).toHaveLength(1);
    expect(second.reviewItems[0]).toMatchObject({ kind: "uncertain_company_match", batchId: "b2", state: "open" });
    expect(second.reviewItems[0].payload).toMatchObject({ candidateName: "Kanok Digital", newName: "KNK Digital Academy" });
  });

  it("merges a second batch into the existing company without duplicating positions or links", () => {
    const first = plan([
      {
        photo: photo("p1"),
        extraction: extraction({
          companies: [exCompany("Lumen Pay")],
          opportunities: [exOpp("Backend Intern", { deadline: { value: "2026-11-02", raw: "2 Nov", status: "auto" }, status: "open" })],
          links: [exLink("https://forms.gle/x", "forms.gle/x", { purpose: "application_form", appliesToTitles: ["Backend Intern"] })],
        }),
      },
    ]);
    const state = apply(empty(), first);
    const second = plan(
      [
        {
          photo: photo("p9"),
          extraction: extraction({
            companies: [exCompany("Lumen Pay")],
            opportunities: [exOpp("Backend Intern", { deadline: { value: "2026-11-02", raw: "02/11/2026", status: "auto" } }), exOpp("Data Intern")],
            links: [exLink("https://forms.gle/x?utm_source=fair", "forms.gle/x")],
          }),
        },
      ],
      state,
      "b2",
    );
    const after = apply(state, second);
    expect(after.companies).toHaveLength(1);
    expect(after.opportunities).toHaveLength(2);
    expect(after.links).toHaveLength(1);
    const backend = after.opportunities.find((o) => o.title.value === "Backend Intern")!;
    expect(backend.deadline).toMatchObject({ value: "2026-11-02", status: "confirmed" });
    expect(backend.status).toBe("open");
    expect(after.links[0].opportunityIds).toEqual([backend.id]);
    expect(second.stats).toMatchObject({ newCompanies: 0, updatedCompanies: 1 });
  });

  it("never overwrites a user-edited value and flags disagreeing deadlines", () => {
    const first = plan([
      { photo: photo("p1"), extraction: extraction({ companies: [exCompany("Lumen Pay")], opportunities: [exOpp("Backend Intern", { deadline: { value: "2026-11-02", raw: "2 Nov", status: "auto" } }), exOpp("QA Intern", { deadline: { value: "2026-11-10", raw: "10 Nov", status: "auto" } })] }) },
    ]);
    const state = apply(empty(), first);
    const backend = state.opportunities.find((o) => o.title.value === "Backend Intern")!;
    backend.deadline = { value: "2026-11-05", status: "edited", sources: [{ kind: "user", editedAt: "x" }] };
    // A rename keeps the printed name as an alias (as renameCompany does) so later brochures still match.
    state.companies[0].name = { value: "Lumen Pay (my name)", status: "edited", sources: [] };
    state.companies[0].aliases = ["Lumen Pay"];

    const second = plan(
      [{ photo: photo("p2"), extraction: extraction({ companies: [exCompany("Lumen Pay")], opportunities: [exOpp("Backend Intern", { deadline: { value: "2026-11-20", raw: "20 Nov", status: "auto" } }), exOpp("QA Intern", { deadline: { value: "2026-11-15", raw: "15 Nov", status: "auto" } })] }) }],
      state,
      "b2",
    );
    const after = apply(state, second);
    expect(after.opportunities.find((o) => o.title.value === "Backend Intern")!.deadline).toMatchObject({ value: "2026-11-05", status: "edited" });
    expect(after.companies[0].name).toMatchObject({ value: "Lumen Pay (my name)", status: "edited" });
    const qa = after.opportunities.find((o) => o.title.value === "QA Intern")!;
    expect(qa.deadline).toMatchObject({ value: "2026-11-10", status: "uncertain" });
    expect(second.reviewItems.map((r) => r.kind)).toEqual(["deadline_conflict"]);
  });

  it("asks which company a photo without a name belongs to, and keeps its data waiting", () => {
    const p = plan([{ photo: photo("p1"), extraction: extraction({ opportunities: [exOpp("Electrical Engineer")] }) }]);
    expect(p.companies).toEqual([]);
    expect(p.opportunities).toEqual([]);
    expect(p.photoCompany.get("p1")).toBeNull();
    expect(p.reviewItems.map((r) => r.kind)).toEqual(["photo_without_company"]);
  });

  it("assigns such a photo to the chosen company in Review", () => {
    const first = plan([{ photo: photo("p1"), extraction: extraction({ companies: [exCompany("Greenline Energy")] }) }]);
    const state = apply(empty(), first);
    const p = plan([{ photo: photo("p2"), extraction: extraction({ opportunities: [exOpp("Electrical Engineer")] }), forcedCompanyId: state.companies[0].id }], state);
    expect(p.photoCompany.get("p2")).toBe(state.companies[0].id);
    expect(p.opportunities[0]).toMatchObject({ companyId: state.companies[0].id });
    expect(p.companies[0].photoIds).toEqual(["p1", "p2"]);
  });

  it("asks which positions a company-wide application form is for", () => {
    const p = plan([
      {
        photo: photo("p1"),
        extraction: extraction({
          companies: [exCompany("Kanok Digital")],
          opportunities: [exOpp("Frontend Intern"), exOpp("Security Intern")],
          links: [exLink("https://forms.gle/k", "forms.gle/k", { purpose: "application_form" })],
        }),
      },
    ]);
    expect(p.reviewItems.map((r) => r.kind)).toEqual(["unclear_application_link"]);
    expect(p.links[0].opportunityIds).toEqual([]);
  });

  it("does not re-add links or positions the user removed", () => {
    const existing = empty();
    existing.dismissedUrls.add("bit.ly/x");
    const first = plan([{ photo: photo("p1"), extraction: extraction({ companies: [exCompany("Lumen Pay")] }) }], existing);
    const state = { ...apply(existing, first) };
    state.dismissedPositions.add(`${state.companies[0].id}|old role`);
    const p = plan(
      [{ photo: photo("p2"), extraction: extraction({ companies: [exCompany("Lumen Pay")], opportunities: [exOpp("Old Role")], links: [exLink("https://bit.ly/x", "bit.ly/x")] }) }],
      state,
    );
    expect(p.opportunities).toEqual([]);
    expect(p.links).toEqual([]);
  });
});
