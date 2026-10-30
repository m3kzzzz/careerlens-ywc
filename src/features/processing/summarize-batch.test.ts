import { describe, expect, it } from "vitest";
import type { Photo } from "@/domain/types";
import type { PhotoExtraction } from "@/lib/extraction/types";
import { photoState, summarizeBatch } from "./summarize-batch";

const photo = (id: string, over: Partial<Photo> = {}): Photo => ({
  id,
  batchId: "b",
  sha256: id,
  fileName: `${id}.jpg`,
  mimeType: "image/jpeg",
  sizeBytes: 1,
  blob: new Blob(),
  prepared: true,
  qr: { status: "done", codes: [] },
  addedAt: "",
  status: "done",
  companyId: null,
  attempts: 1,
  ...over,
});

const extraction = (over: Partial<PhotoExtraction> = {}): PhotoExtraction => ({
  schemaVersion: 1,
  model: "m",
  extractedAt: "",
  isRecruitmentMaterial: true,
  readability: "good",
  language: "en",
  companies: [],
  opportunities: [],
  events: [],
  contacts: [],
  links: [],
  ...over,
});

const company = (name: string) => ({ name: { value: name, status: "auto" as const }, aliases: [], locations: [], perks: [], domains: [] });
const form = {
  origin: "qr" as const,
  raw: "https://forms.gle/x",
  targetKind: "web" as const,
  normalized: "forms.gle/x",
  display: "forms.gle/x",
  purpose: "application_form" as const,
  verification: "from_photo" as const,
  companyName: "Lumen Pay",
  appliesToTitles: [],
};

describe("summarizeBatch", () => {
  it("counts progress and merges discoveries by company name across photos", () => {
    const photos = [
      photo("1", { qr: { status: "done", codes: [{ text: "https://forms.gle/x", region: "center" }] } }),
      photo("2"),
      photo("3", { status: "reading", retryAt: 1 }),
      photo("4", { status: "failed" }),
    ];
    const ex = new Map([
      [
        "1",
        extraction({
          companies: [company("Lumen Pay")],
          opportunities: [{ companyName: null, title: { value: "Backend Intern", status: "auto" }, status: "open", unparsedDates: [], requirements: [], skills: [] }],
          links: [form],
        }),
      ],
      ["2", extraction({ companies: [company("lumen pay")], links: [form] })],
    ]);
    const s = summarizeBatch(photos, ex);
    expect(s).toMatchObject({ total: 4, read: 2, failed: 1, retrying: 1, finished: false });
    expect(s.qr).toMatchObject({ codes: 1, photosWithCodes: 1 });
    expect(s.links).toHaveLength(1); // de-duplicated across photos
    expect(s.linkCounts).toEqual({ application_form: 1 });
    expect(s.discovered).toEqual([
      { name: "Lumen Pay", photoCount: 2, titles: ["Backend Intern"], hasApplicationForm: true, uncertain: false },
    ]);
  });

  it("lists decoded QR codes before the AI has read the photo", () => {
    const s = summarizeBatch(
      [photo("1", { status: "reading", qr: { status: "done", codes: [{ text: "https://forms.gle/a", region: "center" }, { text: "bit.ly/x", region: "top-left" }] } })],
      new Map(),
    );
    expect(s.links.map((l) => [l.display, l.purpose, l.verification])).toEqual([
      ["forms.gle/a", "application_form", "from_photo"],
      ["bit.ly/x", "unknown", "not_fetched"],
    ]);
  });

  it("lists photos under the company grouping chose, not the brand printed on them", () => {
    const ex = new Map([
      ["1", extraction({ companies: [company("Mizuhada Group")] })],
      ["2", extraction({ companies: [company("MizuMi")], opportunities: [{ companyName: null, title: { value: "Data Analysis", status: "auto" }, status: "not_specified", unparsedDates: [], requirements: [], skills: [] }] })],
    ]);
    const grouped = new Map([["1", "Mizuhada Group"], ["2", "Mizuhada Group"]]);
    expect(summarizeBatch([photo("1"), photo("2")], ex, grouped).discovered).toEqual([
      { name: "Mizuhada Group", photoCount: 2, titles: ["Data Analysis"], hasApplicationForm: false, uncertain: false },
    ]);
  });

  it("is finished when every photo is read or failed", () => {
    expect(summarizeBatch([photo("1"), photo("2", { status: "failed" })], new Map()).finished).toBe(true);
  });
});

describe("photoState", () => {
  it("flags photos without a company and non-recruitment photos", () => {
    expect(photoState(photo("1"), extraction())).toBe("no_company");
    expect(photoState(photo("1"), extraction({ isRecruitmentMaterial: false }))).toBe("not_recruitment");
    expect(photoState(photo("1", { status: "reading" }), undefined)).toBe("reading");
    expect(photoState(photo("1", { status: "queued" }), undefined)).toBe("queued");
  });
});
