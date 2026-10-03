# Traffic Fines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The office uploads a scanned fine PDF in `/admin`; the site reads it (QR-bill + OCR in de/fr/it), finds the car and whoever actually had it, records the fine, emails the renter with the PDF, and tracks payment through a personal link with a screenshot.

**Architecture:** Pure modules under `lib/fines/` do the reading, validation, plate search and possession matching, each unit-tested in isolation. One idempotent `processFineDocument` orchestrates them against Prisma and the asset store, with the reader injected so database tests do not run OCR. Admin routes under `app/api/admin/fines/`, a public token page at `/fines/pay/`, and passes in the existing daily scheduler.

**Tech Stack:** Next.js 15 App Router (Node runtime), Prisma 7 + Postgres, Cloudflare R2 via `@aws-sdk/client-s3`, `pdfjs-dist` + `@napi-rs/canvas` (rasterise), `zxing-wasm` (QR), `tesseract.js` (OCR, local trained data), nodemailer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-traffic-fines-design.md` — read it first; this plan argues from it.

## Global Constraints

- API URLs end with a slash (`trailingSlash: true` 308s the unslashed path).
- Every route touching Prisma, storage or SMTP: `export const runtime = "nodejs"`.
- Every admin route starts `const user = await requireAdmin(request); if (!user) return 401 {code:"unauthorised"}`.
- Times on letters are Zurich local; convert with `zurichInstant("YYYY-MM-DDTHH:mm")` from `lib/admin/rentalPeriod.ts`.
- Renter language: `asRentalLanguage(pickupContract.gtcLanguage)` (`en`, else `de`). Office copy German.
- Required fields: plate, moment, amount, fine number **or** payment reference, kind.
- Possession boundary margin: **2 hours** (`HANDOVER_MARGIN_MS = 2 * 60 * 60 * 1000`).
- Plausibility: moment not in the future, not after the letter date, not more than 2 years before it; amount > 0 and < CHF 10,000.
- Upload: PDF only, ≤ 20 MB, ≤ 10 pages, refused by SHA-256 when already uploaded.
- Proof upload: JPEG/PNG/WebP/PDF, ≤ 4 MB.
- Handling fee: `FINES_HANDLING_FEE_CENTS`, default `2000`; `0` disables.
- `FINE_PAYMENT` token valid until 60 days after the due date; not burned by a submission.
- Retention: letters and fine rows 10 years after closing; proofs 5 years.
- No AI dependency in phase 1. The reader sits behind `FineReader`.
- Unit tests: `lib/**/*.test.ts` (`pnpm test`). Database tests: `tests/db/**/*.test.ts` (`pnpm test:db`); new tables go in the truncation list in `tests/db/setup.ts`.

## Review Focus

1. **A letter whose QR slip is on page 2, or that carries several QR codes** (an eBill code, a website link and the payment slip) — the reader must pick the one starting `SPC`, from any page. Pinned in Task 2 and Task 3.
2. **A plate that is a prefix of another** (`ZH 12345` inside `ZH 123456`) or plate-like digits inside the payment reference — fleet search must match whole plates only. Pinned in Task 5.
3. **An offence just after midnight or across the October summer-time change** — Zurich local time, not UTC, decides the renter. Pinned in Task 6.
4. **Two staff uploading the same scan at once** — exactly one document, the other told it is a duplicate. Pinned in Task 9.
5. **A renter opening the pay link after the fine was reopened, paid, or the link expired** — one generic message, no state change. Pinned in Task 13.

---

## File map

```
lib/fines/
  qrBill.ts            parse a Swiss QR-bill payload                        (pure)
  raster.ts            PDF bytes → page images                              (pdfjs + canvas)
  qrDecode.ts          page images → QR texts                               (zxing-wasm)
  ocr.ts               page image → text with word confidences              (tesseract.js)
  tessdata/            deu|fra|ita.traineddata                              (committed)
  dates.ts             numeric and written dates in de/fr/it                (pure)
  language.ts          detect letter language                               (pure)
  vocabulary.ts        labels and keywords per language                     (pure data)
  extract.ts           text + QR → Extraction                               (pure)
  validate.ts          plausibility, field status, proceed / review reason  (pure)
  plates.ts            normalise, fleet search, OCR-confusion suggestion    (pure)
  offences.ts          OBV number → German/English wording                  (pure)
  obvCatalogue.ts      the catalogue data                                   (pure data)
  possession.ts        intervals + responsible-person rule                  (pure)
  reader.ts            FineReader interface + freeReader                    (composes raster/qr/ocr/extract)
  keys.ts              storage keys for letters and proofs
  proof.ts             screenshot text verification                         (pure)
  fee.ts               handling fee resolution                              (pure)
  types.ts             shared types
  repo/possessionLoad.ts   Prisma → possession intervals
  process.ts           processFineDocument orchestration
  attach.ts            new fine vs existing fine (duplicates, reminders)
  match.ts             car + renter matching against the database
  notify.ts            once-only fine emails (FineNotification claim)
  mail.ts              email templates de/en + office German
  token.ts             FINE_PAYMENT tokens
  actions.ts           office actions on a fine (one function per action)
  passes.ts            scheduler passes for fines
app/api/admin/fines/
  uploads/route.ts               POST  slot (presigned PUT or dev URL)
  uploads/local/[...key]/route.ts PUT  dev-only memory upload
  documents/route.ts             POST  register + process in after()
  documents/[id]/file/route.ts   GET   the letter, audited
  documents/[id]/process/route.ts POST process again
  route.ts                       GET   list
  [id]/route.ts                  GET   detail
  [id]/actions/route.ts          POST  office actions
app/api/fines/proof/route.ts     POST  public proof upload
app/fines/pay/page.tsx           public token page
components/fines/FinePayment.tsx
components/admin/sections/FinesSection.tsx, parts/FineDetail.tsx, parts/FineUpload.tsx
app/admin/fines/page.tsx
lib/storage/presign.ts
docs/FINES-SETUP.md
```

---

### Task 1: The reading primitives run locally — raster, QR decode, OCR

**Files:**
- Create: `lib/fines/raster.ts`, `lib/fines/qrDecode.ts`, `lib/fines/ocr.ts`, `lib/fines/tessdata/{deu,fra,ita}.traineddata`, `lib/fines/__fixtures__/kapo-zh-mahnung.pdf`, `lib/fines/reading.test.ts`
- Modify: `package.json` (deps), `next.config.ts` (`serverExternalPackages`, `outputFileTracingIncludes`), `vitest.config.ts` only if the unit timeout is too short

**Interfaces:**
- Produces:
  - `rasterisePdf(bytes: Uint8Array, opts?: { dpi?: number; maxPages?: number }): Promise<PageImage[]>` where `PageImage = { width: number; height: number; rgba: Uint8ClampedArray; png: () => Promise<Buffer> }`
  - `decodeQrCodes(page: PageImage): Promise<string[]>`
  - `recognise(png: Buffer, languages: OcrLanguage[]): Promise<OcrResult>` where `OcrLanguage = "deu"|"fra"|"ita"` and `OcrResult = { text: string; words: { text: string; confidence: number }[]; confidence: number }`
  - `pdfPageCount(bytes: Uint8Array): Promise<number>`

- [ ] Step 1: `pnpm add pdfjs-dist@6 @napi-rs/canvas zxing-wasm tesseract.js @aws-sdk/s3-request-presigner`
- [ ] Step 2: Copy the three `.traineddata` files from the spike into `lib/fines/tessdata/`. Create the fixture PDF: the sample image upscaled to 2480 px, embedded as one A4 page (pdf-lib, as in the spike).
- [ ] Step 3: Write `reading.test.ts` (unit, 120 s timeout): rasterising the fixture gives one page ≈ 2480×3508; decoding it returns a text starting `SPC`; German OCR of it contains `830557506 017 4` and `02.07.2026`.
- [ ] Step 4: Run, see it fail (modules missing).
- [ ] Step 5: Implement. OCR uses `createWorker(langs, 1, { langPath: <abs tessdata dir>, cacheMethod: "none", gzip: false })`; the worker is created per call and terminated in `finally`. Raster uses `pdfjs-dist/legacy/build/pdf.mjs`, `isEvalSupported: false`, scale `dpi/72`.
- [ ] Step 6: Run, see it pass. Add `serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas", "tesseract.js", "zxing-wasm"]` and `outputFileTracingIncludes: { "/api/admin/fines/**": ["./lib/fines/tessdata/**"], "/api/fines/**": ["./lib/fines/tessdata/**"], "/api/cron/**": ["./lib/fines/tessdata/**"] }` to `next.config.ts`; `pnpm build` must succeed.
- [ ] Step 7: Commit `feat(fines): read a scanned letter — raster, QR and OCR primitives`.

### Task 2: Swiss QR-bill parser

**Files:** Create `lib/fines/qrBill.ts`, `lib/fines/qrBill.test.ts`

**Interfaces:**
- Produces: `parseQrBill(text: string): QrBill | null`; `pickQrBill(texts: string[]): QrBill | null`
  `QrBill = { iban: string; creditorName: string; creditorPostalCode: string; creditorTown: string; amountCents: number | null; currency: "CHF"|"EUR"; referenceType: "QRR"|"SCOR"|"NON"; reference: string; message: string; billInfo: string }`

Layout (SIX IG QR-bill 2.x), lines separated by CR/LF: 0 `SPC`, 1 version `02xx`, 2 coding `1`, 3 IBAN, 4–10 creditor (address type, name, street/line1, number/line2, postcode, town, country), 11–17 ultimate creditor (empty), 18 amount, 19 currency, 20–26 debtor, 27 reference type, 28 reference, 29 unstructured message, 30 `EPD`, 31 bill information (optional).

- [ ] Step 1: Tests:
  - the spike payload (verbatim from the spec) → `iban "CH2430000001800000803"`, `creditorName "Kantonspolizei Zürich"`, `amountCents 4000`, `currency "CHF"`, `referenceType "QRR"`, `reference "001980919800083055750601742"`, `message "Ordnungsbusse: 830557506 017 4"`;
  - CRLF line endings parse the same;
  - empty amount → `amountCents null`;
  - `SCOR` reference `RF18539007547034` kept as given;
  - not starting `SPC`, missing `EPD`, or fewer than 31 lines → `null`;
  - `pickQrBill(["https://x", "SPC…", "E-8…"])` picks the SPC one (Review Focus 1).
- [ ] Step 2: Fail. Step 3: Implement (amount `"40.00"` → 4000 via integer arithmetic on the string, never float). Step 4: Pass. Step 5: Commit.

### Task 3: Language, dates, vocabulary and field extraction

**Files:** Create `lib/fines/vocabulary.ts`, `lib/fines/language.ts`, `lib/fines/dates.ts`, `lib/fines/extract.ts`, `lib/fines/types.ts`, tests beside each.

**Interfaces:**
- `types.ts`:
```ts
export type FineLanguage = "de" | "fr" | "it";
export type FieldStatus = "CONFIRMED" | "READ" | "DOUBTFUL" | "MISSING";
export type FieldSource = "qr" | "ocr" | "fleet" | "office";
export interface Field<T> { value: T | null; status: FieldStatus; source: FieldSource | null; snippet: string | null }
export type DocumentKind = "NOTICE" | "REMINDER" | "NOT_A_FINE" | "UNREADABLE";
export interface Extraction {
  language: FineLanguage | null;
  kind: DocumentKind;
  issuerKind: "POLICE" | "PRIVATE" | null;
  issuerName: Field<string>; issuerIban: Field<string>;
  fineNumber: Field<string>; paymentReference: Field<string>;
  amountCents: Field<number>;
  plateText: Field<string>;          // as printed, before fleet matching
  violationDate: Field<string>;      // YYYY-MM-DD
  violationTime: Field<string>;      // HH:mm
  location: Field<string>;
  offenceCode: Field<string>; offenceText: Field<string>;
  speedMeasuredKmh: Field<number>; speedLimitKmh: Field<number>;
  letterDate: Field<string>; dueDate: Field<string>;
  checks: { name: string; passed: boolean; detail: string }[];
}
```
- `detectLanguage(text: string, qr: QrBill | null): FineLanguage | null`
- `parseNumericDate(s: string): string | null` (`02.07.2026`, `2.7.26`, `02/07/2026` → `2026-07-02`); `parseWrittenDate(s: string): string | null` (`4. September 2026`, `4 septembre 2026`, `4 settembre 2026`); `parseTime(s): string | null` (`10:00`, `10.00 Uhr`, `10h00`)
- `extractFields(text: string, qr: QrBill | null, language: FineLanguage | null): Extraction` — statuses set only for what extraction alone can know (QR → CONFIRMED; labelled OCR → READ; unlabelled guess → DOUBTFUL)

Vocabulary per language (exact lists live in `vocabulary.ts`): reminder words (`Mahnung`, `Zahlungserinnerung`, `Rappel`, `Sommation`, `Sollecito`, `Richiamo`), plate labels (`Kontrollschild`, `Kennzeichen`, `Plaque de contrôle`, `Plaque`, `Targa`, `Numero di targa`), moment labels (`Datum / Zeit`, `Datum/Zeit`, `Tatzeit`, `Date / heure`, `Date/heure`, `Data / ora`, `Data/ora`), place labels (`Übertretungsort`, `Tatort`, `Lieu de l'infraction`, `Lieu`, `Luogo dell'infrazione`, `Luogo`), fine-number labels (`OB-Nr.`, `Bussen-Nr.`, `Referenz-Nr.`, `N° OB`, `N° d'amende`, `N. MD`, `N. multa`), offence-number labels (`Ziffer`, `Ziffern`, `chiffre`, `cifra`), speed labels (`Gemessene Geschwindigkeit`, `Vitesse mesurée`, `Velocità misurata`; `Höchstgeschwindigkeit`/`Geschwindigkeitsbegrenzung`, `Vitesse autorisée`, `Velocità massima`), police issuer words (`Kantonspolizei`, `Stadtpolizei`, `Polizei`, `Police cantonale`, `Police municipale`, `Polizia cantonale`, `Polizia comunale`, `Ordnungsbusse`, `Amende d'ordre`, `Multa disciplinare`), fine words that make a letter a fine at all (police words + `Parkbusse`, `Umtriebsentschädigung`, `Kontrollgebühr`, `Besitzesstörung`, `Parkierungsverstoss`, `pénalité`, `indemnité`, `penale`).

- [ ] Step 1: Tests (fixture texts as string constants):
  - the spike's German OCR text (spec) → language `de`, kind `REMINDER`, fine number from QR `830557506 017 4` CONFIRMED, amount 4000 CONFIRMED, date `2026-07-02` READ, time `10:00` READ, location `Lufingen, Zürcherstrasse` READ, offence code `303.1.a` READ, letterDate `2026-09-04` READ (written date), issuerKind `POLICE`;
  - a French text (`Plaque de contrôle VD 123 456`, `Date / heure 14.03.2026, 08:15`, `Lieu de l'infraction Lausanne, Avenue de Rhodanie`, `Rappel`) → `fr`, `REMINDER`, date/time/location read;
  - an Italian text (`Targa TI 98765`, `Data / ora 01.08.2026 ore 17:40`, `Luogo dell'infrazione Lugano, Via Nassa`, `Multa disciplinare`) → `it`, `NOTICE`;
  - a private parking text (`ParkPro AG`, `Umtriebsentschädigung CHF 50.00`, `Kontrollschild ZH 513925`, `am 12.06.2026 um 14:32`) with a QR creditor `ParkPro AG` → `PRIVATE`;
  - a fuel invoice (`Rechnung`, `Nachzahlung Ihrer Tankrechnung`, no fine words) → `NOT_A_FINE`;
  - `2.7.26` → `2026-07-02`; `31.02.2026` → null; `10.00 Uhr` → `10:00`; `25:00` → null.
- [ ] Step 2: Fail. Step 3: Implement — labelled value = text after the label up to the next known label or line end; dates numeric first; QR message checked for a fine number (`/(\d{9}\s?\d{3}\s?\d)/` and the generic "digits after a fine word"). Step 4: Pass. Step 5: Commit.

### Task 4: Validation and the proceed decision

**Files:** Create `lib/fines/validate.ts`, `lib/fines/validate.test.ts`

**Interfaces:**
- `validateExtraction(x: Extraction, ctx: { now: Date; ocrConfidenceOf: (snippet: string) => number | null; ocrAmountCents: number | null }): Extraction` — returns a copy with statuses downgraded to DOUBTFUL where a plausibility check fails, and `checks` filled.
- `requiredFieldsProblem(x: Extraction, plateStatus: FieldStatus): "FIELDS_MISSING" | "FIELDS_DOUBTFUL" | "QR_DISAGREES" | "NOT_A_FINE" | null`
- Constants: `MAX_AGE_DAYS = 730`, `MAX_AMOUNT_CENTS = 1_000_000`, `LOW_WORD_CONFIDENCE = 60`.

- [ ] Step 1: Tests: date in the future → DOUBTFUL + check failed; date after letter date → DOUBTFUL; date 3 years before letter → DOUBTFUL; amount 0 or ≥ 1,000,000 → DOUBTFUL; OCR total ≠ QR → `QR_DISAGREES`; no plate field and no fine number nor reference → `FIELDS_MISSING`; plate status DOUBTFUL → `FIELDS_DOUBTFUL`; kind `NOT_A_FINE` → `NOT_A_FINE`; the German sample with plate CONFIRMED → `null`; the "2028" misread (date `2028-07-02`, now 2026-10-03) → `FIELDS_DOUBTFUL`.
- [ ] Steps 2–5: fail, implement, pass, commit.

### Task 5: Plates

**Files:** Create `lib/fines/plates.ts`, `lib/fines/plates.test.ts`

**Interfaces:**
- `normalisePlate(s: string): string` → upper case, letters and digits only.
- `findFleetPlates(text: string, fleet: { id: string; plate: string }[]): { id: string; plate: string }[]` — a fleet plate counts only when the normalised text contains it **bounded** by a non-digit on both sides (in the normalised-with-separators form: search the text with a regex built from the plate allowing optional spaces/dots/hyphens between characters and `(?<![A-Z0-9])…(?![0-9])`).
- `suggestPlate(printed: string | null, fleet): { id: string; plate: string } | null` — one candidate at OCR-confusion distance ≤ 1.
- `matchPlate(text, printed, fleet): { carId: string | null; status: FieldStatus; reason: "PLATE_AMBIGUOUS" | "PLATE_NOT_IN_FLEET" | null; candidates: string[] }`

- [ ] Step 1: Tests: `ZH 949 636` and `ZH949636` and `ZH-949.636` all match fleet `ZH 949 636` → CONFIRMED; text with `ZH 1234567` does **not** match fleet `ZH 123456` (Review Focus 2); reference digits `0083055750601742` never match a plate; two fleet plates in one text → `PLATE_AMBIGUOUS`; printed `ZH 9496З6`/`ZH 949G36` suggests `ZH 949 636` as DOUBTFUL; nothing → `PLATE_NOT_IN_FLEET`; a retired car's plate still matches (fleet passed in includes it).
- [ ] Steps 2–5.

### Task 6: Possession intervals and the responsible person

**Files:** Create `lib/fines/possession.ts`, `lib/fines/possession.test.ts`, `lib/fines/repo/possessionLoad.ts`, `tests/db/finePossession.test.ts`

**Interfaces:**
```ts
export interface RentalFacts {
  rentalId: string; customerId: string; status: string; createdBy: string;
  startAt: Date; endAt: Date;
  pickupSignedAt: Date | null; returnSignedAt: Date | null; closedAt: Date | null;
}
export interface Interval { rentalId: string; customerId: string; from: Date; to: Date | null } // to null = still out
export function intervalOf(r: RentalFacts): Interval | null;      // null for CANCELLED or unknowable end
export type Moment = { kind: "instant"; at: Date } | { kind: "day"; from: Date; to: Date };
export type Responsible =
  | { ok: true; rentalId: string; customerId: string }
  | { ok: false; reason: "NO_RENTAL_AT_TIME" | "HANDOVER_BOUNDARY" | "OVERLAPPING_RENTALS"; candidates: string[] };
export function responsibleAt(intervals: Interval[], moment: Moment): Responsible;
export function momentOf(date: string, time: string | null): Moment | null; // Zurich local → instants
export const HANDOVER_MARGIN_MS = 2 * 60 * 60 * 1000;
export async function loadIntervals(client: PrismaClient, carId: string, now: Date): Promise<Interval[]>;
```
Rules (spec "Finding the responsible person"): `from` = pickupSignedAt ?? startAt; `to` = min(returnSignedAt, closedAt) when either exists; else if COMPLETED/RETURN_SUBMITTED and imported (`createdBy` starts `import:`) and `endAt > startAt` → endAt; else if status ACTIVE/EXTENSION_REQUESTED → null (open); else → interval unknowable (null), which makes any moment near it go to review — represent by returning an interval with `to = from` and flag; simplest: return null and let `responsibleAt` report NO_RENTAL_AT_TIME.

- [ ] Step 1: Unit tests: inside, 3 h from both ends → that renter; 1h59 after pickup → HANDOVER_BOUNDARY; exactly 2 h after → that renter (boundary inclusive on the far side: `at - from >= margin`); after early return (planned end later) → NO_RENTAL_AT_TIME; past planned end while still ACTIVE → that renter; two overlapping → OVERLAPPING_RENTALS; cancelled ignored; day-only within one rental → renter; day-only containing a handover → HANDOVER_BOUNDARY; `momentOf("2026-10-25","02:30")` (autumn change) and `momentOf("2026-07-02","00:30")` are Zurich, not UTC (Review Focus 3: 00:30 Zurich on 2 July = 22:30 UTC on 1 July).
- [ ] Step 2: DB test: `loadIntervals` builds from a rental made by `persistPickup` then `closeRental` — `from` equals the pickup contract's `signedAt`, `to` equals the close event's `createdAt`.
- [ ] Steps 3–5.

### Task 7: Offence catalogue and handling fee

**Files:** Create `lib/fines/obvCatalogue.ts`, `lib/fines/offences.ts`, `lib/fines/fee.ts`, tests.

**Interfaces:**
- `offenceWording(code: string | null, original: string | null, issuerKind): { de: string; en: string; fromCatalogue: boolean }`
- `privateCategory(text: string): "NO_PERMIT" | "OVERSTAY" | "NO_TICKET" | "OTHER"` with de/en wording.
- `handlingFeeCents(gtcVersion: string | null, env = process.env): number` — returns `FINES_HANDLING_FEE_CENTS ?? 2000` when the GTC version is at or after the version that introduced the fee table, else 0. Find that version from `git log -S "Bearbeitungsgebühr für Verkehrsbusse" -- locales/gtc.ts` and `GTC_VERSION` constants; record the finding in the code comment.

The catalogue: the German wording of OBV Annex 1 entries, fetched from fedlex (SR 314.11, Anhang 1). Start with the speed (303.x), red light (309.x), parking (2xx), mobile-phone and seat-belt groups — the ones Ahmed's pile shows; unknown codes fall back to the original text. English wording is ours.

- [ ] Step 1: Tests: `303.1.a` → German contains `Höchstgeschwindigkeit`; unknown `999.9` → original text, `fromCatalogue false`; fee 2000 for the current GTC version, 0 for an older one, 0 when env is `0`.
- [ ] Steps 2–5.

### Task 8: Schema and migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/<timestamp>_traffic_fines/migration.sql`; modify `tests/db/setup.ts`; create `tests/db/fineSchema.test.ts`.

Models exactly as the spec's "Data" section, with enums `FineDocumentStatus`, `FineDocumentKind`, `FineIssuerKind`, `FineStatus`, `FineReviewReason`, `FineFeeStatus`, `FinePaidVia`, `FineProofVerdict`, `FineNotificationKind`; `ActionTokenPurpose += FINE_PAYMENT`; `ActionToken.fineId String?` with relation; `AssetAccess.fineDocumentId String?`. Indexes: `FineDocument @@unique([organisationId, sha256])`, `Fine @@index([organisationId, status])`, `Fine @@index([organisationId, paymentReference])`, `Fine @@index([organisationId, issuerIban, fineNumber])`, `FineNotification @@unique([fineId, kind, dedupeKey])`. The issuer+number uniqueness is enforced in a transaction in `attach.ts` (Postgres partial unique index added in the migration SQL: `CREATE UNIQUE INDEX ... WHERE "fineNumber" IS NOT NULL AND "issuerIban" IS NOT NULL`).

- [ ] Step 1: DB test: creating a `FineDocument` twice with the same hash throws P2002; two `Fine`s with the same issuer IBAN and number throw; with null numbers both insert.
- [ ] Step 2: `npx prisma migrate dev --name traffic_fines --create-only` against the local test database, add the partial index by hand, apply; generate.
- [ ] Step 3: Truncation list gains `"FineNotification", "FineEvent", "FinePaymentProof", "Fine", "FineDocument"`.
- [ ] Step 4: Pass; full db suite still green. Step 5: Commit.

### Task 9: Upload — slot, direct PUT, register

**Files:** Create `lib/storage/presign.ts`, `lib/fines/keys.ts`, `app/api/admin/fines/uploads/route.ts`, `app/api/admin/fines/uploads/local/[...key]/route.ts`, `app/api/admin/fines/documents/route.ts`, `tests/db/fineUpload.test.ts`; modify `lib/storage/index.ts` (export).

**Interfaces:**
- `fineLetterKey(documentId: string): string` → `fines/<documentId>/letter-<16hex>.pdf`; `fineProofKey(fineId, ext)`.
- `uploadTarget(key: string, contentType: string): Promise<{ url: string; headers: Record<string,string> }>` — presigned R2 PUT (10 min) when `R2_BUCKET` is set; otherwise, outside production, `/api/admin/fines/uploads/local/<key>/`.
- `POST /api/admin/fines/uploads/` body `{ sha256, bytes, name }` → `409 {code:"duplicate", documentId}` | `413` | `200 {documentId, key, url, headers}`. The `documentId` is pre-generated (cuid) so the key can name it; nothing is written yet.
- `POST /api/admin/fines/documents/` body `{ documentId, key, sha256 }` → reads the object, checks `%PDF`, size, pages (`pdfPageCount`), recomputes SHA-256 and compares, creates the row (P2002 on hash → `409 duplicate`), schedules `after(() => processFineDocument(...))`, answers `201 {documentId}`.

- [ ] Step 1: DB tests: slot refused for a known hash; register creates `UPLOADED` row; register with a non-PDF → 415 and no row; mismatched hash → 400; two registers with the same hash in `Promise.all` → one 201, one 409 (Review Focus 4); unauthenticated → 401.
- [ ] Steps 2–5.

### Task 10: The reader and processing

**Files:** Create `lib/fines/reader.ts`, `lib/fines/process.ts`, `lib/fines/match.ts`, `tests/db/fineProcess.test.ts`, `lib/fines/reader.test.ts` (slow, real OCR on the fixture).

**Interfaces:**
```ts
export interface ReadResult { qrText: string | null; ocrText: string; language: FineLanguage | null; extraction: Extraction; pages: number }
export interface FineReader { name: string; read(pdf: Uint8Array): Promise<ReadResult> }
export const freeReader: FineReader; // raster → QR on every page → OCR pass 1 (deu+fra+ita, page 1) → language → OCR pass 2 (that language, all pages) → extractFields → validateExtraction
export async function processFineDocument(deps: { client: PrismaClient; store: AssetStore; reader: FineReader; now: Date; mail: LifecycleMailConfig | null; baseUrl: string }, documentId: string): Promise<"processed" | "skipped" | "failed">;
export async function matchFine(client, organisationId, x: Extraction, ocrText: string): Promise<{ carId; rentalId; customerId; plateStatus; reviewReason: FineReviewReason | null }>;
```
`processFineDocument`: conditional claim `UPLOADED|FAILED → PROCESSING` (attempts < 3); read; store `qrText/ocrText/extraction/language/kind/reader/pages`; `PROCESSED`; then `attachDocument` (Task 11). On throw: `FAILED`, `error`, `attempts+1`.

- [ ] Step 1: Reader test (unit, slow): `freeReader.read(fixture)` → QR parsed, fine number and amount CONFIRMED, language `de`, kind `REMINDER`.
- [ ] Step 2: DB tests with a **fake reader** returning a canned `ReadResult`: a clean notice for a seeded rented car → document `PROCESSED`, fine `NOTIFIED`, linked to car, rental, customer; reader throws → `FAILED`, attempts 1, error stored; a second concurrent `processFineDocument` on the same id → `"skipped"`.
- [ ] Steps 3–5.

### Task 11: Attaching documents to fines — duplicates and reminders

**Files:** Create `lib/fines/attach.ts`, `tests/db/fineAttach.test.ts`

**Interfaces:**
- `attachDocument(deps, document: { id; organisationId; extraction; ocrText; kind }): Promise<{ fineId: string; created: boolean }>` — finds an existing fine by `(issuerIban, fineNumber)` or `paymentReference`; else probable duplicate by `(carId, violationAt, issuerName)` → new fine in `NEEDS_REVIEW` with a `FineEvent` naming the other; else creates. Then for a new fine: `matchFine` → `NOTIFIED` (and notify, Task 12) or `NEEDS_REVIEW(reason)`. For an existing fine and a reminder: the spec's state table.

- [ ] Step 1: DB tests — one per row of the spec's reminder table (`NOTIFIED`, `PAID`, `PROOF_SUBMITTED`, `HANDLED_OTHERWISE`, `VOID`), plus: reminder for an unknown fine creates one flagged `firstSeenAsReminder`; amount follows the reminder; `reminderLevel` increments; same fine number from two notices → one fine, two documents; no plate in the fleet → `NEEDS_REVIEW PLATE_NOT_IN_FLEET`; placeholder customer email → `NO_CUSTOMER_EMAIL`; offence 1 h after pickup → `HANDOVER_BOUNDARY`.
- [ ] Steps 2–5.

### Task 12: Emails and tokens

**Files:** Create `lib/fines/mail.ts`, `lib/fines/notify.ts`, `lib/fines/token.ts`, `lib/fines/mail.test.ts`, `tests/db/fineNotify.test.ts`; modify `lib/rental/lifecycleMail.ts` (`sendMail` gains optional `attachments` and `bcc`).

**Interfaces:**
- `fineNoticeMail(ctx: { language: RentalLanguage; renterName; plate; carModel; violationAt; timeKnown; location; offence: {de,en}; amountCents; dueDate; issuerName; fineNumber; feeCents; payUrl; reminder: boolean }): { subject; text }`
- `fineThanksMail`, `fineReopenedMail`, `officeFineDigestMail(items)`, `officeFineAlertMail(ctx)` (German).
- `issueFinePaymentToken(client, fine, now): Promise<string>` (deletes earlier unused tokens of that fine); `resolveFinePaymentToken(client, token, now): Promise<{ ok: true; fine } | { ok: false }>`; `finePayUrl(baseUrl, token)` → `${base}/fines/pay/?t=${token}`.
- `sendFineOnce(client, input: { organisationId; fineId; kind; dedupeKey; to }, now, send): Promise<boolean>` — claim pattern on `FineNotification`.
- `notifyRenter(deps, fineId, reason: "notice" | "reminder" | "reopened")`: loads fine + rental + pickup contract language + customer, issues a token, sends with the letter PDF(s) attached, sets `notifiedAt`; failure → `NEEDS_REVIEW MAIL_FAILED` + office alert.

- [ ] Step 1: Unit: German and English notice contain plate, date `02.07.2026, 10:00`, amount `CHF 40.00`, the pay URL, the fee line only when fee > 0, and never the word "Mahnung" in English; reminder variant says the deadline is close.
- [ ] Step 2: DB: notice sent once even when called twice; attachment present (fake transport captures it); token row has purpose `FINE_PAYMENT`, `fineId`, expiry = due + 60 days; SMTP throws → fine `NEEDS_REVIEW MAIL_FAILED`.
- [ ] Steps 3–5.

### Task 13: The renter's payment page and proof

**Files:** Create `app/fines/pay/page.tsx`, `components/fines/FinePayment.tsx`, `app/api/fines/proof/route.ts`, `lib/fines/proof.ts`, `lib/fines/proof.test.ts`, `tests/db/fineProof.test.ts`; labels in `lib/rental/labels.ts` (`fines` block, de/en).

**Interfaces:**
- `verifyProofText(text: string, fine: { amountCents; paymentReference; fineNumber }): "MATCH" | "MISMATCH" | "UNREADABLE"` — amount as `40.00`/`40,00`/`40.–`/`CHF 40`; reference or fine number compared as digit strings (≥ 12 digits of the reference, or the full fine number).
- `POST /api/fines/proof/` multipart `{ token, file, paidOn?, company }` → `410 link-unusable` | `413` | `415` | `429` | `200 { verdict }`. On MATCH: fine `PAID (PROOF_VERIFIED)`, token burned, thank-you mail. Else `PROOF_SUBMITTED`, office alert.

- [ ] Step 1: Unit `verifyProofText`: TWINT-style text with `CHF 40.00` and the reference → MATCH; amount only → MISMATCH; empty → UNREADABLE; reference with spaces → MATCH.
- [ ] Step 2: DB: valid token + matching proof (fake OCR) → PAID; second submission after PAID → 410 (Review Focus 5); expired token → 410; token of a reopened fine (burned) → 410; cross-site → 403; 6 MB → 413; `text/html` → 415.
- [ ] Step 3: Page: server component resolves the token first; failure → one generic message (de and en); success → fine summary + upload (images compressed with `compressImage` from `lib/rental/imageCompress.ts`).
- [ ] Steps 4–5. Browser check at 390 px width.

### Task 14: Admin API — list, detail, file, actions

**Files:** Create `app/api/admin/fines/route.ts`, `app/api/admin/fines/[id]/route.ts`, `app/api/admin/fines/[id]/actions/route.ts`, `app/api/admin/fines/documents/[id]/file/route.ts`, `app/api/admin/fines/documents/[id]/process/route.ts`, `lib/fines/actions.ts`, `tests/db/fineAdmin.test.ts`

**Interfaces:**
- `GET /api/admin/fines/?tab=review|open|paid|all` → `{ fines: FineRow[], stats: { last30: number; auto: number } }`
- `GET /api/admin/fines/<id>/` → fine + documents (with extraction) + proofs + events + candidate rentals (intervals ±7 days around the moment)
- `POST /api/admin/fines/<id>/actions/` body `{ action, ... }` with actions: `correct {field, value}` (re-runs matching), `assign {rentalId}`, `send`, `markPaid`, `acceptProof {proofId}`, `rejectProof {proofId}`, `close {note}`, `void {note}`, `feePaid`, `feeWaived`. Each in `lib/fines/actions.ts`, each writing a `FineEvent` with the admin's id and name.
- File route: writes `AssetAccess { fineDocumentId, userId, username }` before reading; `inline`, `private, no-store`.

- [ ] Step 1: DB tests per action incl. state guards (e.g. `send` refused without a customer email; `assign` re-validates the rental belongs to the fine's car), audit row on file read, 401s.
- [ ] Steps 2–5.

### Task 15: Admin UI — Bussen section, bell

**Files:** Create `app/admin/fines/page.tsx`, `components/admin/sections/FinesSection.tsx`, `components/admin/parts/FineUpload.tsx`, `components/admin/parts/FineDetail.tsx`; modify `components/admin/shell/Rail.tsx` (item with `Receipt` icon after history), `lib/admin/labels.ts` (`nav.fines`, `fines` block de/en), `app/api/admin/overview/route.ts` (`fineAttention: { review: number; proof: number; overdue: number }`), `lib/admin/attention.ts` + `components/admin/overview/attentionText.ts` (kind `fine`), `components/admin/types.ts`; tests: `lib/admin/attention.test.ts` additions.

- [ ] Step 1: Unit: `attentionItems` yields a `fine` item when `fineAttention.review > 0`, text and href `/admin/fines/?tab=review`.
- [ ] Step 2: Implement upload (SHA-256 via `crypto.subtle.digest`, slot → PUT → register, per-file state), tabs, table, detail panel (letter iframe from the file route, fields with status chips and snippets, failed checks, candidate rentals, timeline, action buttons through `writeJson`).
- [ ] Step 3: Browser (local, embedded Postgres, memory store): sign in, upload the fixture + a duplicate, see processing → review (plate not in fleet), correct plate, see `NOTIFIED`; mark paid; bell count changes. Screenshot at desktop and 390 px.
- [ ] Step 4: Commit.

### Task 16: Scheduler passes

**Files:** Create `lib/fines/passes.ts`, `tests/db/finePasses.test.ts`; modify `lib/rental/scheduler.ts` (`PassSummary` + `runDailyPasses`), `app/api/cron/daily/route.ts` (`maxDuration = 300`).

- `fineDocumentRetryPass` — `UPLOADED|FAILED`, attempts < 3, older than 1 h, at most 5 per run.
- `fineReminderPass` — `NOTIFIED`, due within 7 days, no proof → renter reminder once (`dedupeKey = due day`).
- `fineOverduePass` — `NOTIFIED`, due passed → office alert once.
- `fineDigestPass` — fines entered review since the last digest → one German office mail (`dedupeKey = Zurich day`).

- [ ] Step 1: DB tests per pass, each run twice to prove once-only.
- [ ] Steps 2–5.

### Task 17: Retention, docs, configuration

**Files:** Modify `lib/admin/retention.ts` (+ test), `docs/DATA-RETENTION.md`, `.env.local.example` (`FINES_HANDLING_FEE_CENTS`), `app/privacy` copy (one line); create `docs/FINES-SETUP.md` (R2 CORS JSON, env, how to scan).

R2 CORS rule for the owner:
```json
[{ "AllowedOrigins": ["https://www.zuriauto.ch"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 600 }]
```

- [ ] Step 1: Tests: proof bytes removed 5 years after the fine closed; letters 10 years; open fines never.
- [ ] Steps 2–5.

### Task 18: End to end

- [ ] Full unit + db suites, lint, `tsc`, `pnpm build`.
- [ ] Local browser run of the whole flow: upload → auto-notify (mail captured with SMTP off → `MAIL_FAILED` path, then with a fake SMTP sink) → open pay link → upload a proof image containing the amount and reference → `PAID` → upload the same letter as a Mahnung variant → reopened.
- [ ] Vercel preview: raster + OCR on the deployed function (spec implementation step 1). Requires the owner's go-ahead to push a branch, because preview builds run migrations against the preview database.
