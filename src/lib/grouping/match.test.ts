import { describe, expect, it } from "vitest";
import { matchCompany, nameSimilarity, normalizeCompanyName, normalizeTitle } from "./match";

const c = (id: string, name: string, domains: string[] = [], aliases: string[] = []) => ({ id, name, domains, aliases });

describe("normalizeCompanyName", () => {
  it("drops legal words in Thai and English", () => {
    expect(normalizeCompanyName("Lumen Pay Co., Ltd.")).toBe("lumen pay");
    expect(normalizeCompanyName("บริษัท ลูเมน เพย์ จำกัด")).toBe("ลูเมน เพย์");
    expect(normalizeCompanyName("Siam Data Labs (Thailand) Public Company Limited")).toBe("siam data labs");
  });
  it("normalizes position titles", () => {
    expect(normalizeTitle("Software Engineer Intern (Backend)")).toBe("software engineer intern backend");
  });
});

describe("matchCompany", () => {
  const existing = [
    c("lp", "Lumen Pay", ["lumenpay.co.th"], ["บริษัท ลูเมน เพย์ จำกัด"]),
    c("kd", "Kanok Digital", ["kanokdigital.co.th"]),
    c("sd", "Siam Data Labs"),
  ];

  it("matches the same name, including legal suffixes and Thai aliases", () => {
    expect(matchCompany({ name: "LUMEN PAY CO., LTD.", aliases: [], domains: [] }, existing)).toMatchObject({ kind: "match", companyId: "lp" });
    expect(matchCompany({ name: "บริษัท ลูเมน เพย์ จำกัด", aliases: [], domains: [] }, existing)).toMatchObject({ kind: "match", companyId: "lp" });
  });

  it("matches the same website with a similar name", () => {
    expect(matchCompany({ name: "Lumen Pay Thailand", aliases: [], domains: ["lumenpay.co.th"] }, existing)).toMatchObject({ kind: "match", companyId: "lp" });
  });

  it("sends similar names with different websites to review instead of merging", () => {
    const r = matchCompany({ name: "KNK Digital Academy", aliases: [], domains: ["knk.ac.th"] }, existing);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") {
      expect(r.companyId).toBe("kd");
      expect(r.reasons).toContain("Different websites");
    }
  });

  it("does not merge the same name when the websites conflict", () => {
    expect(matchCompany({ name: "Kanok Digital", aliases: [], domains: ["kanok-academy.com"] }, existing).kind).toBe("ambiguous");
  });

  it("routes a shared distinctive word to review, but not a shared generic one", () => {
    expect(matchCompany({ name: "Lumen Wallet", aliases: [], domains: [] }, existing).kind).toBe("ambiguous");
    expect(matchCompany({ name: "Siam Commercial Bank", aliases: [], domains: [] }, existing)).toEqual({ kind: "new" });
  });

  it("treats unrelated companies as new", () => {
    expect(matchCompany({ name: "Orbit Games", aliases: [], domains: [] }, existing)).toEqual({ kind: "new" });
    expect(matchCompany({ name: "Greenline Energy", aliases: [], domains: ["greenline.co.th"] }, [])).toEqual({ kind: "new" });
  });

  it("scores similarity", () => {
    expect(nameSimilarity("Kanok Digital", "Kanok Digital Co., Ltd.")).toBe(1);
    expect(nameSimilarity("Orbit Games", "Lumen Pay")).toBeLessThan(0.3);
  });
});
