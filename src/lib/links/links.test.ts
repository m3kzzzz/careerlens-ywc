import { describe, expect, it } from "vitest";
import { classifyTarget, initialVerification, resolvePurpose } from "./classify";
import { parseTarget, registrableDomain } from "./normalize";

const purpose = (raw: string) => classifyTarget(parseTarget(raw)).purpose;

describe("parseTarget", () => {
  it("normalizes URLs so variants de-duplicate", () => {
    const a = parseTarget("https://www.LumenPay.co.th/careers/?utm_source=fair&b=2&a=1#top");
    const b = parseTarget("http://lumenpay.co.th/careers?a=1&b=2");
    expect(a.normalized).toBe("lumenpay.co.th/careers?a=1&b=2");
    expect(a.normalized).toBe(b.normalized);
  });

  it("adds a scheme to bare printed domains", () => {
    const t = parseTarget("forms.gle/abc123");
    expect(t).toMatchObject({ kind: "web", url: "https://forms.gle/abc123", domain: "forms.gle" });
  });

  it("recognizes emails, phones and plain text", () => {
    expect(parseTarget("mailto:Careers@LumenPay.co.th?subject=Hi")).toMatchObject({ kind: "email", address: "careers@lumenpay.co.th" });
    expect(parseTarget("hr@kanok.co.th").kind).toBe("email");
    expect(parseTarget("tel:+66 2 123 4567")).toMatchObject({ kind: "phone", number: "+6621234567" });
    expect(parseTarget("WIFI:S:booth;T:WPA;P:x;;").kind).toBe("text");
    expect(parseTarget("javascript:alert(1)").kind).toBe("text");
  });

  it("computes registrable domains for Thai suffixes", () => {
    expect(registrableDomain("careers.kanokdigital.co.th")).toBe("kanokdigital.co.th");
    expect(registrableDomain("www.knk.ac.th")).toBe("knk.ac.th");
    expect(registrableDomain("jobs.siamdatalabs.ai")).toBe("siamdatalabs.ai");
  });
});

describe("classifyTarget", () => {
  it("classifies by purpose, not URL shape", () => {
    expect(purpose("https://forms.gle/kanok-intern-2027")).toBe("application_form");
    expect(purpose("https://docs.google.com/forms/d/e/xyz/viewform")).toBe("application_form");
    expect(purpose("https://jobs.lever.co/acme/123/apply")).toBe("application_form");
    expect(purpose("https://jobs.lever.co/acme/123")).toBe("careers");
    expect(purpose("https://www.jobthai.com/th/company/123")).toBe("careers");
    expect(purpose("https://www.linkedin.com/jobs/view/1")).toBe("careers");
    expect(purpose("https://www.linkedin.com/company/orbit-games-th")).toBe("social_contact");
    expect(purpose("https://line.me/R/ti/p/@lumenpay")).toBe("social_contact");
    expect(purpose("https://www.eventpop.me/e/123")).toBe("event_registration");
    expect(purpose("https://siamdatalabs.ai/careers/data-analyst")).toBe("careers");
    expect(purpose("https://greenline.co.th")).toBe("company_info");
    expect(purpose("https://example.com/files/brochure.pdf")).toBe("unknown");
  });

  it("does not open short links and marks them opaque", () => {
    const t = parseTarget("bit.ly/lp-fair26");
    const c = classifyTarget(t);
    expect(c).toEqual({ purpose: "unknown", certain: true, opaque: true });
    expect(initialVerification(t, c)).toBe("not_fetched");
  });

  it("lets printed context override path heuristics but not conclusive hosts", () => {
    const companyPage = classifyTarget(parseTarget("https://kanok.co.th/internship-2027"));
    expect(resolvePurpose(companyPage, "application_form")).toBe("application_form");
    const form = classifyTarget(parseTarget("https://forms.gle/x"));
    expect(resolvePurpose(form, "careers")).toBe("application_form");
    expect(resolvePurpose(companyPage, null)).toBe("careers");
  });

  it("never marks a decoded link as verified", () => {
    const t = parseTarget("https://forms.gle/x");
    expect(initialVerification(t, classifyTarget(t))).toBe("from_photo");
  });
});
