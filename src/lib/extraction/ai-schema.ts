import { z } from "zod";

/**
 * The exact JSON shape Gemini must return for one brochure photo.
 * Every field is required-but-nullable so the model must say "null" rather
 * than invent a value; Zod validates the response before anything is used.
 */

const confidence = z.enum(["high", "low"]).describe("low if the text is blurry, cut off, partly hidden, or you are inferring");
const quote = z
  .string()
  .nullable()
  .describe("Short verbatim text copied from the photo that supports this item (max ~120 characters), or null");

const printedDate = z
  .object({
    text: z.string().describe("The date exactly as printed, e.g. '15 ธ.ค. 69', '2 Nov 2026', '03/11/2569'"),
    iso: z
      .string()
      .nullable()
      .describe("Your Gregorian YYYY-MM-DD reading. Thai Buddhist Era years (25xx) minus 543. null if unsure"),
  })
  .nullable();

export const OPPORTUNITY_TYPES = ["internship", "full_time", "part_time", "graduate_program", "program_camp", "other"] as const;
export const LINK_PURPOSES = ["application_form", "careers", "company_info", "social_contact", "event_registration", "unknown"] as const;

const company = z.object({
  name: z.string().describe("Company or organization name as printed (keep the original language)"),
  nameConfidence: confidence,
  aliases: z.array(z.string()).describe("Other names printed for the same organization: Thai/English names, abbreviations, legal name"),
  description: z.string().nullable().describe("One or two sentences on what the company does, only from the photo"),
  industry: z.string().nullable().describe("Short industry label only if clear, e.g. 'Fintech', 'Energy'"),
  locations: z.array(z.string()).describe("Office or work locations printed"),
  perks: z.array(z.string()).describe("Benefits printed, e.g. 'Hybrid work', 'Allowance'"),
  quote,
});

const opportunity = z.object({
  title: z.string().describe("Position or program title as printed"),
  titleConfidence: confidence,
  companyName: z.string().nullable().describe("Which company above offers it; null if the photo names no company"),
  type: z.enum(OPPORTUNITY_TYPES).nullable(),
  statusClaim: z
    .enum(["open", "upcoming", "closed", "none"])
    .describe("Only what the source explicitly says about APPLICATIONS. 'We're hiring' alone is 'none'"),
  statusQuote: z.string().nullable(),
  deadline: printedDate.describe("Application deadline, only if printed"),
  opensAt: printedDate.describe("Date applications open, only if printed"),
  duration: z.string().nullable().describe("e.g. '4–6 months', '2 months (Jun–Jul)'"),
  location: z.string().nullable(),
  workMode: z.enum(["onsite", "hybrid", "remote"]).nullable(),
  compensation: z.string().nullable().describe("Salary or allowance as printed"),
  compensationConfidence: confidence,
  requirements: z.array(z.string()).describe("Qualifications and requirements, one per item, as printed"),
  skills: z.array(z.string()).describe("Skills and technologies mentioned, e.g. 'Go', 'SQL', 'Figma'"),
  howToApply: z.string().nullable().describe("Application instructions as printed"),
  quote,
});

const event = z.object({
  title: z.string(),
  companyName: z.string().nullable(),
  date: printedDate,
  time: z.string().nullable(),
  location: z.string().nullable(),
  quote,
});

const contact = z.object({
  companyName: z.string().nullable(),
  kind: z.enum(["email", "phone", "line", "booth", "person", "other"]),
  value: z.string().describe("The email, phone, LINE ID, booth number or person name exactly as printed"),
  label: z.string().nullable().describe("e.g. 'HR Department', 'Talent team'"),
});

const printedUrl = z.object({
  url: z.string().describe("A web address printed as text (not inside a QR code), exactly as printed"),
  companyName: z.string().nullable(),
  label: z.string().nullable().describe("Text printed next to it, e.g. 'Apply here', 'Visit our website'"),
  purpose: z.enum(LINK_PURPOSES),
  appliesToTitles: z.array(z.string()).describe("Opportunity titles this link is explicitly for; empty if unclear"),
});

const qrContext = z.object({
  index: z.number().int().describe("The QR code number given in the prompt"),
  companyName: z.string().nullable(),
  label: z.string().nullable().describe("Text printed next to this QR code, e.g. 'Scan to apply'"),
  purpose: z.enum(LINK_PURPOSES).describe("From the printed label and destination, not assumed"),
  appliesToTitles: z.array(z.string()).describe("Opportunity titles this QR is explicitly for; empty if unclear"),
});

export const aiPhotoExtractionSchema = z.object({
  isRecruitmentMaterial: z.boolean().describe("false if the photo is not a brochure, poster, flyer or booth sign"),
  readability: z.enum(["good", "partial", "poor"]),
  readabilityNote: z.string().nullable().describe("What made it hard to read, e.g. 'glare over the lower half'"),
  language: z.enum(["th", "en", "mixed", "other"]),
  companies: z.array(company),
  opportunities: z.array(opportunity),
  events: z.array(event).describe("Recruitment events, talks, workshops, hackathons, open houses"),
  contacts: z.array(contact),
  printedUrls: z.array(printedUrl),
  qrCodes: z.array(qrContext).describe("One entry per decoded QR code listed in the prompt"),
});

export type AiPhotoExtraction = z.infer<typeof aiPhotoExtractionSchema>;

/** JSON Schema passed to Gemini as `responseJsonSchema`. */
export function aiPhotoExtractionJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(aiPhotoExtractionSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
