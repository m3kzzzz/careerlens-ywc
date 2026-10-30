import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", () => {
  class ApiError extends Error {
    status: number;
    constructor({ message, status }: { message: string; status: number }) {
      super(message);
      this.status = status;
    }
  }
  class GoogleGenAI {
    models = { generateContent };
  }
  return { ApiError, GoogleGenAI };
});

const { ApiError } = await import("@google/genai");
const { POST } = await import("./route");

const aiJson = {
  isRecruitmentMaterial: true,
  readability: "good",
  readabilityNote: null,
  language: "en",
  companies: [{ name: "Lumen Pay", nameConfidence: "high", aliases: [], description: null, industry: null, locations: [], perks: [], quote: null }],
  opportunities: [],
  events: [],
  contacts: [],
  printedUrls: [],
  qrCodes: [{ index: 1, companyName: "Lumen Pay", label: "Scan to apply", purpose: "application_form", appliesToTitles: [] }],
};

let ip = 0;
function request(opts: { type?: string; size?: number; qr?: string; origin?: string } = {}) {
  const form = new FormData();
  form.append("image", new File([new Uint8Array(opts.size ?? 100)], "p.jpg", { type: opts.type ?? "image/jpeg" }));
  form.append("qr", opts.qr ?? JSON.stringify([{ text: "https://forms.gle/x", region: "bottom-left" }]));
  const headers: Record<string, string> = { host: "localhost:3000", "x-forwarded-for": `10.0.0.${++ip}` };
  if (opts.origin) headers.origin = opts.origin;
  return new Request("http://localhost:3000/api/extract", { method: "POST", body: form, headers });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    generateContent.mockReset();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-flash";
  });

  it("returns a validated, post-processed extraction", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(aiJson) });
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.extraction.model).toBe("test-flash");
    expect(body.extraction.links[0]).toMatchObject({ purpose: "application_form", verification: "from_photo", label: "Scan to apply" });

    const call = generateContent.mock.calls[0][0];
    expect(call.model).toBe("test-flash");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.contents[0].parts[1].text).toContain("QR code #1 (bottom-left of the photo): https://forms.gle/x");
  });

  it("maps Gemini 429 to a retryable rate limit with retry delay", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: '{"retryDelay": "21s"}', status: 429 }));
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("21");
    expect((await res.json()).error).toMatchObject({ code: "rate_limited", retryable: true, retryAfterMs: 21000 });
  });

  it("falls back to the second model once when the main model is overloaded", async () => {
    generateContent
      .mockRejectedValueOnce(new ApiError({ message: '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}', status: 503 }))
      .mockResolvedValueOnce({ text: JSON.stringify(aiJson) });
    const body = await (await POST(request())).json();
    expect(body.ok).toBe(true);
    expect(body.extraction.model).toBe("gemini-3.5-flash");
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(["test-flash", "gemini-3.5-flash"]);
  });

  it("keeps the main model's retryable error when the fallback model is unavailable", async () => {
    generateContent
      .mockRejectedValueOnce(new ApiError({ message: "high demand UNAVAILABLE", status: 503 }))
      .mockRejectedValueOnce(new ApiError({ message: "models/gemini-3.5-flash is no longer available to new users", status: 404 }));
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatchObject({ code: "upstream", retryable: true });
  });

  it("reports a busy upstream with a retry hint when both models fail", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: "high demand UNAVAILABLE", status: 503 }));
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatchObject({ code: "upstream", retryable: true, retryAfterMs: 8000 });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("reports a used-up daily quota clearly instead of retrying for hours", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: '{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","retryDelay":"48616s"}', status: 429 }));
    const body = await (await POST(request())).json();
    expect(body.error).toMatchObject({ code: "quota_exhausted", retryable: false });
    expect(body.error.message).toMatch(/resets in about 14 hours/);
    expect(generateContent).toHaveBeenCalledTimes(2); // the fallback model has its own quota, so it is tried once
  });

  it("rejects output that doesn't match the schema instead of using it", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...aiJson, companies: "Lumen Pay" }) });
    const body = await (await POST(request())).json();
    expect(body.error).toMatchObject({ code: "invalid_response", retryable: true });
  });

  it("reports a wrong model ID as a configuration problem", async () => {
    generateContent.mockRejectedValue(new ApiError({ message: "models/test-flash is not found", status: 404 }));
    const body = await (await POST(request())).json();
    expect(body.error).toMatchObject({ code: "model_unavailable", retryable: false });
  });

  it("refuses to run without an API key", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("not_configured");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("validates input before calling Gemini", async () => {
    expect((await POST(request({ type: "application/pdf" }))).status).toBe(400);
    expect((await POST(request({ size: 4 * 1024 * 1024 + 1 }))).status).toBe(413);
    expect((await POST(request({ qr: "not json" }))).status).toBe(400);
    expect((await POST(request({ origin: "https://evil.example" }))).status).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
