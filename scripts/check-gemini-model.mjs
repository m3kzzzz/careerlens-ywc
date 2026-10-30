// Lists the Flash models available to GEMINI_API_KEY and checks GEMINI_MODEL.
// Usage: node --env-file=.env.local scripts/check-gemini-model.mjs
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const wanted = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set (try: node --env-file=.env.local scripts/check-gemini-model.mjs)");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const flash = [];
for await (const model of await ai.models.list({ config: { pageSize: 200 } })) {
  const id = model.name?.replace(/^models\//, "") ?? "";
  if (/flash/i.test(id) && model.supportedActions?.includes("generateContent")) flash.push(id);
}

console.log("Flash models with generateContent:\n  " + flash.sort().join("\n  "));
if (flash.includes(wanted)) {
  console.log(`\n✓ GEMINI_MODEL "${wanted}" is available.`);
} else {
  console.error(`\n✗ GEMINI_MODEL "${wanted}" is not in the list above. Set GEMINI_MODEL to one of them.`);
  process.exit(1);
}
