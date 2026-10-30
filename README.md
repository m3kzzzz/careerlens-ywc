# CareerLens

Turn job fair brochures into career opportunities. Snap or upload up to 10 brochure photos per batch, from any mix of companies; CareerLens reads them with Gemini, decodes QR codes, groups everything by company and shows the opportunities you can act on.

Built for the Young Webmaster Camp (YWC) Web Programming interview.

## Status (local MVP, not deployed)

| Area | State |
| --- | --- |
| Upload (camera, gallery, drag-and-drop, 10-photo limit, validation, SHA-256 duplicates) | Working, tested |
| QR decoding in the browser (zxing-wasm, several codes per photo) | Working, tested |
| Gemini extraction (`/api/extract`, Zod-validated, retries, fallback model) | Working: verified against the real Gemini API with synthetic Thai/English brochures; not yet with real job-fair photos |
| Grouping into companies, merging new batches, duplicate positions/links | Working, tested |
| Review (company matches, photos without a company, deadline conflicts, unclear application links) | Working, tested |
| Corrections (rename, edit/clear dates, remove positions, fix/remove links) | Working, tested |
| Companies, company details, Save / Interested, My Calendar (Add / Edit) | Working, tested |
| Web page enrichment (reading linked pages) and deployment | Not started |

## Run locally

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run check-model          # confirms GEMINI_MODEL is available to your key
npm run dev
```

Open http://localhost:3000. To try the camera flow on a phone, open the dev server over your LAN IP.

## Scripts

- `npm run dev` – development server
- `npm run build` / `npm start` – production build
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript
- `npm test` – Vitest unit tests
- `npm run check-model` – lists the Flash models your key can use and checks `GEMINI_MODEL`

## How a batch is read

1. **Upload** – up to 10 photos; exact duplicates (SHA-256) are skipped before anything is sent.
2. **Organize** – the batch and original photos are saved to IndexedDB, so a reload resumes.
3. **Prepare (in the browser)** – each photo is decoded with EXIF orientation, QR codes are read with
   zxing-wasm (several per photo), and a ≤2048px JPEG is made. Re-encoding strips EXIF/GPS metadata.
4. **Extract (`POST /api/extract`)** – the server sends the image plus the decoded QR contents to Gemini
   with a JSON schema, validates the answer with Zod, then post-processes it:
   - dates are re-parsed deterministically (Thai months, Thai digits, Buddhist Era years, day/month
     ambiguity); anything assumed is marked *uncertain*, anything unreadable stays raw text;
   - recruitment status comes only from stated evidence (explicit claim or printed dates);
   - URLs are normalized, de-duplicated and classified by purpose; a decoded link is never "verified".
5. **Store** – each photo's result is saved under its photo id, so retries never duplicate data.
   Transient errors (429, 5xx, timeouts) retry with backoff; configuration errors stop the batch.

6. **Group (in the browser)** – results are merged into companies conservatively: the same normalized
   name (Thai and English legal words ignored) or the same website merges; similar names create a separate
   company plus a Review question. Positions, links, events and contacts are de-duplicated. Values the user
   edited are never overwritten; things the user removed are not re-added by later batches.
7. **Review** – only four kinds of question: uncertain company matches, photos without a company,
   conflicting deadlines and application forms not tied to a position. Everything else is automatic.

## Structure

```
src/
  app/                 Next.js App Router routes (UI only)
  components/          Shared UI: brand, layout (desktop header, mobile bottom nav), icons
  features/upload/     Upload screen: start view, batch preview, pickers, drag-and-drop, draft state
  domain/types.ts      Domain model: batches, photos, companies, opportunities, links, provenance
  lib/upload/          Pure upload logic: validation, SHA-256, duplicate/limit planning (unit tested)
  features/processing/ Batch runner (prepare → extract → store), retry policy, processing screen
  app/api/extract/     Server route: validation, rate limit, Gemini call
  server/              Server-only Gemini client and error mapping
  lib/extraction/      Gemini JSON schema (Zod), prompt, post-processing, API contract
  lib/dates/           Thai/English date parsing, deadline helpers
  lib/links/           URL normalization and purpose classification
  lib/qr/, lib/image/  In-browser QR decoding and photo preparation
  lib/db/              Dexie (IndexedDB) schema and queries – data stays on this device
design-reference/      Approved Claude Design exports (mobile, desktop, design system)
```

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes, for reading photos | Server-side only. Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.6-flash`. Run `npm run check-model` to confirm it is available to your key. |
| `GEMINI_FALLBACK_MODEL` | No | Comma-separated models tried in order when the main model is overloaded (503) or out of quota (429). Defaults to `gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash`; set `none` to disable. |

## Privacy

Photos are stored only in this browser (IndexedDB). There is no account and no cross-device sync. Photos are sent to Google Gemini through this app's `/api/extract` route for extraction; the API key never reaches the browser. The route only accepts same-origin requests and is rate-limited per IP (best-effort on serverless).
