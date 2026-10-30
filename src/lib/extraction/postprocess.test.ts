import { describe, expect, it } from "vitest";
import { aiPhotoExtractionJsonSchema, aiPhotoExtractionSchema, type AiPhotoExtraction } from "./ai-schema";
import { deriveStatus, postprocessExtraction, resolvePrintedDate } from "./postprocess";

const today = new Date(Date.UTC(2026, 9, 29));

function aiResult(overrides: Partial<AiPhotoExtraction> = {}): AiPhotoExtraction {
  return aiPhotoExtractionSchema.parse({
    isRecruitmentMaterial: true,
    readability: "good",
    readabilityNote: null,
    language: "mixed",
    companies: [
      {
        name: "Lumen Pay",
        nameConfidence: "high",
        aliases: ["บริษัท ลูเมน เพย์ จำกัด", "Lumen Pay"],
        description: "QR payments and e-wallets.",
        industry: "Fintech",
        locations: ["Silom, Bangkok"],
        perks: [],
        quote: null,
      },
    ],
    opportunities: [
      {
        title: "Software Engineer Intern (Backend)",
        titleConfidence: "high",
        companyName: null,
        type: "internship",
        statusClaim: "none",
        statusQuote: null,
        deadline: { text: "2 พ.ย. 69", iso: "2026-11-02" },
        opensAt: null,
        duration: "4–6 months",
        location: null,
        workMode: "hybrid",
        compensation: "500 THB / day",
        compensationConfidence: "low",
        requirements: ["3rd–4th year CS/CE", "  "],
        skills: ["Go", "SQL", "go"],
        howToApply: null,
        quote: null,
      },
    ],
    events: [],
    contacts: [{ companyName: null, kind: "email", value: "careers@lumenpay.co.th", label: null }],
    printedUrls: [
      { url: "lumenpay.co.th", companyName: null, label: "Website", purpose: "company_info", appliesToTitles: [] },
    ],
    qrCodes: [
      { index: 1, companyName: "Lumen Pay", label: "Scan to apply", purpose: "application_form", appliesToTitles: ["Software Engineer Intern (Backend)"] },
      { index: 7, companyName: null, label: null, purpose: "careers", appliesToTitles: [] }, // hallucinated index
    ],
    ...overrides,
  });
}

describe("postprocessExtraction", () => {
  const qr = [{ text: "https://forms.gle/lumen-intern", region: "bottom-right" }];

  it("normalizes a typical brochure", () => {
    const r = postprocessExtraction(aiResult(), qr, { model: "m", today });
    const opp = r.opportunities[0];
    expect(opp.companyName).toBe("Lumen Pay"); // single-company brochure
    expect(opp.deadline).toMatchObject({ value: "2026-11-02", raw: "2 พ.ย. 69", status: "auto" });
    expect(opp.status).toBe("open"); // future deadline is stated evidence
    expect(opp.compensation).toMatchObject({ value: "500 THB / day", status: "uncertain" });
    expect(opp.requirements).toEqual(["3rd–4th year CS/CE"]);
    expect(opp.skills).toEqual(["Go", "SQL"]);
    expect(r.companies[0].aliases).toEqual(["บริษัท ลูเมน เพย์ จำกัด"]);
  });

  it("keeps decoded QR text as truth and only uses AI context for indexes we sent", () => {
    const r = postprocessExtraction(aiResult(), qr, { model: "m", today });
    const qrLinks = r.links.filter((l) => l.origin === "qr");
    expect(qrLinks).toHaveLength(1);
    expect(qrLinks[0]).toMatchObject({
      normalized: "forms.gle/lumen-intern",
      purpose: "application_form",
      verification: "from_photo",
      label: "Scan to apply",
      appliesToTitles: ["Software Engineer Intern (Backend)"],
    });
  });

  it("derives company domains from its own site and email, not from forms", () => {
    const r = postprocessExtraction(aiResult(), qr, { model: "m", today });
    expect(r.companies[0].domains).toEqual(["lumenpay.co.th"]);
  });

  it("de-duplicates a URL that is both printed and in a QR code", () => {
    const r = postprocessExtraction(
      aiResult({ printedUrls: [{ url: "forms.gle/lumen-intern", companyName: null, label: "Apply", purpose: "application_form", appliesToTitles: [] }] }),
      qr,
      { model: "m", today },
    );
    expect(r.links).toHaveLength(1);
    expect(r.links[0].origin).toBe("qr");
  });

  it("does not let a link alone mark an opportunity open", () => {
    const base = aiResult();
    const r = postprocessExtraction(
      { ...base, opportunities: [{ ...base.opportunities[0], deadline: null }] },
      qr,
      { model: "m", today },
    );
    expect(r.opportunities[0].status).toBe("not_specified");
  });

  it("produces a JSON schema Gemini can use", () => {
    const schema = aiPhotoExtractionJsonSchema();
    expect(schema.type).toBe("object");
    expect(schema).not.toHaveProperty("$schema");
    expect((schema.required as string[]).sort()).toContain("opportunities");
  });
});

describe("resolvePrintedDate", () => {
  it("prefers the deterministic reading and flags disagreement", () => {
    const r = resolvePrintedDate({ text: "03/11/2026", iso: "2026-03-11" }, today);
    expect(r.date).toMatchObject({ value: "2026-11-03", status: "uncertain" });
    expect(r.date?.note).toMatch(/AI read it as 2026-03-11/);
  });

  it("falls back to the AI reading as uncertain, or keeps raw text", () => {
    expect(resolvePrintedDate({ text: "end of next month", iso: "2026-11-30" }, today).date).toMatchObject({
      value: "2026-11-30",
      status: "uncertain",
    });
    expect(resolvePrintedDate({ text: "TBA", iso: null }, today)).toEqual({ unparsed: "TBA" });
    expect(resolvePrintedDate(null, today)).toEqual({});
  });
});

describe("deriveStatus", () => {
  const t = "2026-10-29";
  it("uses only stated evidence", () => {
    expect(deriveStatus({ claim: "none", today: t })).toBe("not_specified");
    expect(deriveStatus({ claim: "none", deadline: "2026-10-15", today: t })).toBe("closed");
    expect(deriveStatus({ claim: "open", deadline: "2026-10-15", today: t })).toBe("closed");
    expect(deriveStatus({ claim: "none", opensAt: "2026-12-01", today: t })).toBe("upcoming");
    expect(deriveStatus({ claim: "open", today: t })).toBe("open");
    expect(deriveStatus({ claim: "closed", deadline: "2026-12-01", today: t })).toBe("closed");
  });
});
