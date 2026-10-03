# Traffic fines, read and routed automatically

**Date:** 2026-10-03
**Status:** draft, for the owner's review
**Builds on:** the vehicle-history lookup (commit `07e17df`), the return
persistence spec (`2026-08-28-return-persistence-design.md`), the lifecycle
spec (`2026-08-18-rental-lifecycle-design.md`)

## Problem

Fines arrive at Rigitrade AG by post, addressed to the registered keeper, not
to whoever was driving. Today somebody reads each letter, looks up who had the
car on that day, tells them, and keeps track in pen on the paper itself —
"paid by Ali", a name, "Mahnung". The pile is mixed: Kantonspolizei and
Stadtpolizei *Ordnungsbussen*, private parking companies (ParkPro, secu24,
Parkon), reminders of fines already received, and the odd unrelated invoice.
Letters come in German, French or Italian depending on where the car was.

The office wants to scan a letter, drop the PDF into the dashboard, and have
nothing else to do in the normal case.

## What this is

The office uploads scanned PDFs in `/admin`. For each one the website, with
nobody touching it:

1. stores the original;
2. reads it — the Swiss QR payment slip decoded exactly, the rest by
   open-source OCR in German, French and Italian;
3. checks what it read against itself and against the database;
4. finds the car by its plate;
5. finds who **actually had** the car at the moment of the offence;
6. records the fine, linked to the car, the rental, the renter, the document
   and everything it read;
7. emails the renter, in their contract language, with the original PDF
   attached — they pay the issuer directly with its QR slip;
8. lets the renter confirm payment through a personal link with a screenshot,
   and checks the screenshot;
9. reacts to a later reminder (*Mahnung*) of the same fine on its own.

Anything that does not add up goes to a review queue in the dashboard with the
reason spelled out. Review is the exception path, not a step.

## What this is not

- **Not a collection service.** Zuriauto does not pay the fine and recharge
  it. The renter pays the issuer. (Owner's decision, 2026-10-03.)
- **Not a driver nomination.** Naming the driver to the police (*Fahrerangabe*)
  stays a manual office action, recorded on the fine as "handled otherwise".
- **Not a mailroom.** Letters that are neither police fines nor private parking
  charges are recognised as such and handed to the office, not processed.
- **Not AI in phase 1.** The reader is free and runs on our own server. An AI
  fallback (Claude) is designed for and deferred — see "Phase 2".

## Decisions

Recorded with the reason, because each one closes a question that will be
asked again.

### 1. The renter pays the issuer directly

The email forwards the letter with its QR slip. Zuriauto tracks whether it was
paid; it never holds the money. The office already works this way, and it
keeps Rigitrade out of the payment chain for amounts that are not its own.

### 2. Scope: police fines and private parking charges

Both behave identically for this purpose — a plate, a moment, an amount, a QR
slip, and a renter who should pay it. Everything else is classified "not a
fine" and handed over.

### 3. The free reader first; Claude later, behind the same interface

The owner chose a free first phase. The reader is one module with one
interface (`FineReader`, below), so the phase 2 fallback is a second
implementation and a setting, not a rebuild. The dashboard counts how many
letters went through without review, which is the number that decides whether
phase 2 is worth paying for.

### 4. The QR slip is the authority for money; OCR is the authority for nothing alone

Swiss bills carry a QR-bill: a machine-readable record of the amount,
currency, the creditor's name and IBAN, the payment reference, and a free-text
message. Decoding it is exact.

The spike on Ahmed's sample (below) decoded all of it — from a compressed
WhatsApp photograph — including the fine number in the message field:
`Ordnungsbusse: 830557506 017 4`. So for police fines up to four of the six
required fields come from the QR slip without OCR at all.

OCR supplies the plate, the moment and the place. No OCR value is trusted on
its own: each must pass a format check and, where possible, agree with a
second source (the QR slip, our own fleet, the letter's own date).

### 5. "Who had the car" means who actually had it, not who was booked

The two existing lookups — the admin history screen and `driverAt` in
`lib/rental/lookup.ts` — test the **planned** `startAt`/`endAt`. For a fine
that is wrong twice over:

- a car returned early stays "with" its renter until the planned end, so a
  fine in that gap would go to the wrong person;
- a car kept past its end date falls outside every rental, so its fine finds
  nobody.

The fines matcher uses **possession intervals** built from what actually
happened — see "Finding the responsible person". The two existing lookups are
left alone; changing what the history screen shows is a separate decision.

### 6. Emails: the renter's contract language; the office always German

The renter's email follows the pickup contract's `gtcLanguage`, as every
other renter email does (`asRentalLanguage`: English, otherwise German). The
attached letter stays in whatever language it arrived in. Everything the
office sees — dashboard, alerts — is German (with the admin's existing English
toggle), whatever language the letter came in.

### 7. Offence text in German comes from the federal catalogue, not translation

*Ordnungsbussen* cite a numbered offence from the annex of the
Ordnungsbussenverordnung (OBV, SR 314.11) — `Ziffer 303.1.a` on the sample.
The number is the same in the German, French and Italian letters. The system
reads the number from any letter and looks up the official German (and
English, for the renter) wording in a catalogue file built once from the
federal text. An unknown number falls back to the original text, marked as
such. Private parking charges have no catalogue; they get one of a few German
categories (parking without permit, overstay, no ticket, other) and keep the
original wording.

### 8. The GTC handling fee is stated and recorded

GTC §4.2 makes the renter liable for "Verkehrsverstösse/Bussen", and the fee
table charges **CHF 20 per traffic fine** and **CHF 20 per Mahnung**. The
fine record carries the fee; the renter's email states it with the card and
TWINT payment links the system already uses, referenced by the fine number.
The office marks the fee paid — those links are static, so the system cannot
see the payment. The amount is configuration (`FINES_HANDLING_FEE_CENTS`,
default `2000`; `0` disables it).

Applied only where the renter's accepted GTC version contains the fee table.
**To verify during implementation:** which `gtcVersion` introduced it.

### 9. Reminders reopen; the police are the source of truth on payment

The police never tell Rigitrade that a fine was paid. So "paid" can only be:
the renter's verified screenshot, the renter's unverified claim (checked by
the office), or the office marking it. A *Mahnung* for the same fine is proof
it is **unpaid**, and overrides any of the three: the fine reopens, the renter
is told, and the office is alerted.

### 10. Scans must be unmarked

Handwriting on the paper is read as data, and Ahmed's boxes on the sample
destroyed the plate line entirely. The office scans before anyone writes on a
letter. The upload screen says so.

## The spike — what was measured, 2026-10-03

Throwaway, in the session scratchpad, on Ahmed's sample: a WhatsApp photograph
of a Kantonspolizei Zürich *Mahnung*, 580×758 pixels, with coloured boxes
drawn on it. A 300 DPI scan of A4 is about 2480×3508 — this was a much harder
input than production will see.

| Part | Result |
|---|---|
| QR-bill (zxing-wasm, image upscaled to 2320 px wide) | Decoded exactly: `40.00 CHF`, `Kantonspolizei Zürich`, IBAN `CH24 3000 0001 8000 0080 3`, reference `QRR 001980919800083055750601742`, message `Ordnungsbusse: 830557506 017 4` |
| OCR, German only (tesseract.js) | `OB-Nr. 830557506 017 4`, `Ziffern 303.1.a`, `CHF 40.00`, `Übertretungsort Lufingen, Zürcherstrasse`, `Datum / Zeit 02.07.2026 10:00` all correct |
| OCR, German + French + Italian at once | The date came out `02 07 2028` — wrong year |
| The plate | Not read in either run: the red box covers it |
| Time | ~20 s for one page with three languages loaded |

Consequences, all taken into the design:

- **Two-pass OCR.** A first pass establishes the language (keywords; the QR
  message usually settles it — `Ordnungsbusse` / `Amende d'ordre` /
  `Multa disciplinare`), a second pass reads in that language only.
- **Plausibility checks are load-bearing.** "2028" is in the future and later
  than the letter's own date; either check sends the letter to review instead
  of to a renter.
- **Plates are matched against our fleet, not read cold** — below.

What the spike did **not** establish, and implementation step 1 must:
rasterising a real scanned PDF on Vercel (pdfjs + a canvas binding), memory
and time on a 2–3 page letter, and the hit rate on a set of real, unmarked
scans across issuers and languages.

## Flow

```
upload (browser → R2 directly)
  └─ FineDocument  UPLOADED
       └─ process (background)
            ├─ rasterise pages
            ├─ decode QR-bill            ── exact: amount, reference, creditor, message
            ├─ OCR pass 1 → language
            ├─ OCR pass 2 in that language
            ├─ extract fields (rules, 3 languages)
            ├─ validate + classify      ── notice / reminder / not a fine
            └─ FineDocument  PROCESSED
                 └─ attach to a Fine (new, or the existing one it reminds about)
                      ├─ match car (fleet plates)
                      ├─ match possession interval → rental → renter
                      ├─ all clear  → NOTIFIED  ── renter email + PDF + pay link
                      └─ any doubt  → NEEDS_REVIEW (reason)  ── bell + list
```

## Data

New tables. None of the existing models fit without bending them:
`Asset.contractId` is required, `Notification.rentalId` is required, and a
fine can exist before — or without — a rental.

### `FineDocument` — one uploaded letter

| Field | Notes |
|---|---|
| `organisationId` | |
| `storageKey` | `fines/<documentId>/letter-<16hex>.pdf` in R2 |
| `sha256` | unique per organisation — the same file twice is refused at upload |
| `bytes`, `pages` | |
| `uploadedById`, `uploadedByName`, `uploadedAt` | the admin user |
| `status` | `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED` |
| `attempts`, `error`, `processedAt` | retries are bounded at three |
| `kind` | `NOTICE`, `REMINDER`, `NOT_A_FINE`, `UNREADABLE` |
| `language` | `de`, `fr`, `it`, or null |
| `reader` | `free-v1` now; `claude` in phase 2 |
| `qrText` | the raw QR-bill payload, verbatim |
| `ocrText` | the full recognised text — evidence, and lets rules be re-run without re-OCR |
| `extraction` | JSON: every field with value, source, status and the quoted snippet it came from; every check with pass/fail |
| `fineId` | null until attached |

### `Fine` — one offence

| Field | Notes |
|---|---|
| `organisationId` | |
| `issuerKind` | `POLICE`, `PRIVATE` |
| `issuerName`, `issuerIban` | from the QR creditor |
| `fineNumber` | issuer's own number (OB-Nr., Referenz) |
| `paymentReference` | QR reference, digits only |
| `amountCents`, `currency` | the **current** amount — a reminder can raise it |
| `violationAt` | an instant; stored UTC, read from Zurich local time |
| `violationTimeKnown` | false when the letter gives a date only |
| `location`, `offenceCode`, `offenceTextOriginal`, `offenceTextDe`, `offenceTextEn` | |
| `speedMeasuredKmh`, `speedLimitKmh` | speeding only |
| `letterDate`, `dueDate` | due: printed, else letter date + 30 days |
| `reminderLevel` | 0 for a first notice, +1 per Mahnung received |
| `carId`, `rentalId`, `customerId` | null until matched |
| `status` | below |
| `reviewReason` | below; null unless `NEEDS_REVIEW` |
| `handlingFeeCents`, `handlingFeeStatus` | `NONE`, `DUE`, `PAID`, `WAIVED` |
| `notifiedAt`, `paidAt`, `paidVia` | `paidVia`: `PROOF_VERIFIED`, `PROOF_CHECKED_BY_OFFICE`, `OFFICE` |
| `closedById`, `closedNote` | when the office closes it another way |

Unique `[organisationId, issuerIban, fineNumber]` where both are present.

**Status**

| Status | Meaning | Who moves it on |
|---|---|---|
| `NEEDS_REVIEW` | the system would not act alone; `reviewReason` says why | the office |
| `NOTIFIED` | renter emailed; awaiting payment | renter, a Mahnung, the deadline |
| `PROOF_SUBMITTED` | renter sent a screenshot that did not verify | the office |
| `PAID` | verified, checked, or marked | a later Mahnung reopens it |
| `HANDLED_OTHERWISE` | company paid, driver nominated, disputed and won — with a note | — |
| `VOID` | duplicate, uploaded by mistake | — |

**Review reasons:** `FIELDS_MISSING`, `FIELDS_DOUBTFUL`, `QR_DISAGREES`,
`NOT_A_FINE`, `PLATE_NOT_IN_FLEET`, `PLATE_AMBIGUOUS`, `NO_RENTAL_AT_TIME`,
`HANDOVER_BOUNDARY`, `OVERLAPPING_RENTALS`, `NO_CUSTOMER_EMAIL`,
`REMINDER_AFTER_PAID`, `MAIL_FAILED`, `PROCESSING_FAILED`.

### `FinePaymentProof` — a renter's screenshot

`fineId`, `storageKey` (`fines/<fineId>/proof-<16hex>.<ext>`), `contentType`,
`bytes`, `submittedAt`, `ocrText`, `verdict` (`MATCH`, `MISMATCH`,
`UNREADABLE`), `checkedById`, `checkedAt`.

### `FineEvent` — the fine's timeline

`fineId`, `type`, `payload` JSON, `actorId` (null for the system),
`createdAt`. Every transition, every email, every office correction. This is
what the office reads when a renter says "I already paid".

### `FineNotification` — once-only emails

The `Notification` / `CarNotification` pattern again, keyed by `fineId`:
`kind` (`FINE_NOTICE`, `FINE_REMINDER`, `FINE_REOPENED`, `FINE_PAID`,
`OFFICE_REVIEW`), `dedupeKey`, `to`, `sentAt`, `error`, `attempts`, unique
`[fineId, kind, dedupeKey]`. Claimed before sending, so two runs cannot send
twice.

### Changes to existing tables

- `ActionTokenPurpose` gains `FINE_PAYMENT`; `ActionToken` gains a nullable
  `fineId`. The token still names the rental (`rentalId` is required, and a
  notified fine always has one).
- `AssetAccess` gains a nullable `fineDocumentId`, so opening a letter in the
  dashboard is audited like opening a contract. No foreign key, as with the
  other audit columns.
- `tests/db/setup.ts` truncation list: the new tables.

## Upload

Scans exceed Vercel's ~4.5 MB request body limit easily, so the file never
passes through our server:

1. The browser computes the file's SHA-256 and asks
   `POST /api/admin/fines/uploads/` for a slot. The server refuses a hash it
   already has (pointing at the existing document), checks size (≤ 20 MB) and
   type, and answers a presigned R2 `PUT` URL valid for 10 minutes.
2. The browser `PUT`s the file straight to R2.
3. The browser calls `POST /api/admin/fines/documents/` with the key. The
   server reads the object back, checks it is a PDF (`%PDF` magic, ≤ 10
   pages), records the `FineDocument`, and starts processing in the background
   (`after()`), answering at once.

Several files at once — the pile — upload in parallel with per-file progress.

**New dependency:** `@aws-sdk/s3-request-presigner`.
**One-time setup for the owner:** a CORS rule on the R2 bucket allowing `PUT`
from the site's origin.

## Processing

One function, `processFineDocument(id)`, idempotent and safe to re-run:

1. Claim the document: `UPLOADED|FAILED → PROCESSING` conditionally, so two
   runners cannot both process it.
2. Rasterise each page at 300 DPI (`pdfjs-dist` + `@napi-rs/canvas`).
3. Decode QR codes on every page; parse the one starting `SPC` as a Swiss
   QR-bill (fixed line layout, version 2.x).
4. OCR pass 1, three languages, first page only → language by keyword score,
   overruled by the QR message when it names the fine type.
5. OCR pass 2 in that language, all pages, keeping per-word confidence.
6. Extract fields with the rule set (below).
7. Validate and classify. Store everything in `extraction`.
8. Attach to a fine and match (next sections).

Runs in the upload request's `after()` with `maxDuration = 300`. A failure
records the error and increments `attempts`; the dashboard has a "process
again" button, and a daily pass retries `UPLOADED`/`FAILED` documents older
than an hour, up to three attempts.

**New dependencies:** `pdfjs-dist`, `@napi-rs/canvas`, `tesseract.js`,
`zxing-wasm`. The `deu`, `fra` and `ita` trained-data files are committed with
the code rather than downloaded at run time.

### Fields, and how each is found

| Field | Source, in order | Rule |
|---|---|---|
| amount | QR | a decoded QR value is `CONFIRMED` on its own; an OCR'd total that differs → `QR_DISAGREES` |
| payment reference | QR | |
| issuer | QR creditor name + IBAN | known-issuer list decides `POLICE`/`PRIVATE`; unknown creditor → private |
| fine number | QR message, else labelled OCR value | `OB-Nr.` / `N° OB` / `N. MD`, `Referenz`, `Busse Nr.` … |
| kind | keywords | `Mahnung`, `Rappel`, `Sollecito`, `2. Mahnung` → reminder |
| plate | fleet search over the whole text | below |
| moment | labelled value, else the only date+time pair | `Datum/Zeit`, `Date/heure`, `Data/ora`, `Tatzeit` … |
| place | labelled value | `Übertretungsort`, `Lieu de l'infraction`, `Luogo dell'infrazione` |
| offence | `Ziffer`/`chiffre`/`cifra` number → catalogue | |
| speeds | labelled values | speeding only |
| letter date, due date | labelled or written-out dates | |

Labels live in one dictionary file per language, so a new issuer's wording is
a data change.

**Field status.** No invented confidence percentages. Each field ends as
`CONFIRMED` (two independent sources agree, or matched against our own data),
`READ` (one source, passes its format and plausibility checks), `DOUBTFUL`
(low OCR word confidence, a fuzzy match, or a failed plausibility check), or
`MISSING`.

**Plausibility checks:** the moment is in the past, not after the letter date,
not more than two years before it; the amount is positive and under
CHF 10,000; a reminder's amount is not lower than the notice's; the plate is
one of ours.

**Proceeds alone only when** every required field — plate, moment, amount,
fine number or payment reference, kind — is `CONFIRMED` or `READ`, and the
plate is `CONFIRMED`.

## Duplicates and reminders

- **Same file again:** refused at upload by hash.
- **Same fine, another letter:** a fine matches when the issuer IBAN and fine
  number are equal, or the payment references are equal. A letter with
  neither cannot be matched safely, so a fine with the same car, moment and
  issuer sends it to review as a probable duplicate rather than creating a
  second fine.
- **A reminder for a fine we have:** the document attaches, `amountCents`
  takes the reminder's amount, `reminderLevel` rises, and:
  - `NOTIFIED` → the renter gets the reminder with the new PDF;
  - `PAID` / `PROOF_SUBMITTED` → reopens to `NEEDS_REVIEW`
    (`REMINDER_AFTER_PAID`), renter and office are told;
  - `HANDLED_OTHERWISE` / `VOID` → office alert only.
  The GTC reminder fee is added when the renter was notified and had not
  confirmed payment.
- **A reminder for a fine we never saw:** a new fine, flagged "first seen as a
  reminder", through the normal flow — the deadline is closer, so the email
  says so.

## Finding the car

Plates are compared normalised: upper case, only letters and digits
(`ZH 949 636` → `ZH949636`). Every car counts, **retired cars included** —
fines arrive months after a car has left the fleet.

1. **Search, don't read.** Look for each fleet plate in the normalised full
   text. Matching against a known list survives what reading a plate cold
   does not.
2. Exactly one fleet plate found → `CONFIRMED`.
3. Two or more → `PLATE_AMBIGUOUS` (a letter listing several vehicles).
4. None → try the labelled value with the usual OCR confusions
   (`0/O`, `1/I`, `5/S`, `8/B`, `2/Z`) at distance one. A single candidate is
   `DOUBTFUL` — shown to the office as a suggestion, never sent on.
5. Nothing → `PLATE_NOT_IN_FLEET` (a foreign plate, or not our car).

**Accepted limit:** `Car.plate` is the current plate. Swiss plates can move
between cars; if Rigitrade ever moves one, an old fine would match the newer
car. Rare enough to accept now; a plate history is the fix if it happens.

## Finding the responsible person

### Possession intervals

For each rental of the car that is not `CANCELLED`:

- **from** — the pickup contract's `signedAt`; for a rental with no pickup
  contract (marked out, imported), its `startAt`;
- **to** — the moment it actually ended: the return addendum's `signedAt` or
  the close event's `createdAt` (`rental.closed.return` /
  `rental.closed.manual`), whichever is earlier; for an imported rental with
  no close record, its `endAt` if later than `startAt`, otherwise unknown;
  for a rental still out, open-ended.

The offence moment is a Zurich local time converted with the existing
`zurichInstant` (summer time handled; the repeated autumn hour falls inside
the boundary margin).

### The rule

**Time known:**

- exactly one interval contains the moment, and the moment is more than
  **two hours** from either of its ends → that renter;
- within two hours of a handover → `HANDOVER_BOUNDARY` (a contract is signed
  when the form is submitted, not to the minute the keys change hands);
- no interval → `NO_RENTAL_AT_TIME` (in the yard, a staff drive, the garage);
- more than one → `OVERLAPPING_RENTALS` (a data error to fix).

**Date only:** the whole Zurich day must lie inside one interval; a day
containing any handover goes to review.

**Then:** a matched renter with a placeholder email (`isPlaceholderEmail`) →
`NO_CUSTOMER_EMAIL`.

The two-hour margin is a constant with its reason beside it, and is
unit-tested at its edges.

## Emails

All sent through the existing SMTP setup; the letter attached
(`sendContractMails` already attaches PDFs, `lifecycleMail.sendMail` gains an
optional attachment). Once-only via `FineNotification`. A failure to deliver
puts the fine in review (`MAIL_FAILED`) and alerts the office.

| Email | To | When |
|---|---|---|
| Fine notice | renter, contract language | matched; attaches every page of the letter |
| Reminder | renter | 7 days before the due date with no confirmation; and when a Mahnung arrives |
| Reopened | renter + office | a Mahnung after a paid state |
| Thank you | renter | payment verified or confirmed |
| Review needed | office (German) | a fine enters review; one digest per daily run, not one mail per letter |
| Overdue | office | due date passed, no confirmation |

The fine notice says: what (offence in the renter's language), when, where,
the car, the amount and due date, that payment goes directly to the issuer
using the attached slip, that Zuriauto does not collect it, the GTC handling
fee with the payment links, the confirmation link, and that an unpaid fine
returns as a reminder with further fees.

## The payment confirmation page

`/fines/pay/?t=<token>`, public, following `app/rental/manage`:

- resolved server-side before rendering; any failure shows one generic
  message;
- shows the fine (car, date, amount, issuer) in the contract language;
- takes a screenshot or PDF (JPEG/PNG/WebP/PDF, ≤ 4 MB after the browser
  compresses images, as at pickup) and an optional payment date;
- origin check, honeypot, the database rate limiter in its own scope, size and
  content-type checks — the public-upload pattern of
  `app/api/rental-contract`.

The token: purpose `FINE_PAYMENT`, sent with the notice, valid until 60 days
after the due date. **Not burned on submission** — an unreadable screenshot
must be retryable. It is burned when the fine leaves `NOTIFIED`/
`PROOF_SUBMITTED`. Whenever a fine is sent to the renter again — after
review, or reopened by a Mahnung — a fresh token goes with it.

**Verification:** OCR the screenshot and look for the amount (`40.00`,
`40,00`, `CHF 40`) and for the payment reference or fine number (digits only,
spaces ignored).

- both found → `PAID` (`PROOF_VERIFIED`), thank-you email;
- otherwise → `PROOF_SUBMITTED`, office checks.

**Accepted risk:** a faked screenshot passes. The backstop is decision 9 — the
police send a Mahnung, and the fine reopens.

## The dashboard

A new rail section, **Bussen** (`/admin/fines/`), staff and owner.

- **Upload** at the top: drop one or many PDFs; per file, progress then
  status. A line reminding that letters must be scanned unmarked.
- **Tabs:** *Prüfen* (review, default when non-empty), *Offen* (notified,
  awaiting payment), *Bezahlt*, *Alle*. Columns: offence date, car, renter,
  amount, issuer, status, due.
- **A fine opened:**
  - the letter (inline PDF, audited), every attached document, the proofs;
  - each field with its status and the snippet it was read from; failed
    checks in plain words;
  - the matched rental with its possession interval, and the neighbouring
    rentals when the reason is a boundary;
  - the timeline (`FineEvent`).
- **Actions:** correct a field and re-run matching; pick the renter from the
  candidate rentals; send to renter; mark paid; accept or reject a proof;
  close as handled otherwise (with a note); void; process again; resend.
  Every action is a `FineEvent` with the admin's name.
- **Bell and overview:** a new attention kind, *fine*, for `NEEDS_REVIEW`,
  `PROOF_SUBMITTED` and overdue fines, in the existing
  `attentionItems` list.
- **The number that decides phase 2:** on the section header, the share of
  the last 30 days' letters that went through without review.

## Storage and retention

- Letters and fine records: **ten years** after the fine is closed — they
  carry the GTC fee, a commercial record under OR 958f, as the contract PDF
  does.
- Payment screenshots: **five years** after the fine is closed — they can
  show the renter's bank details, the five-year rule for personal data.

Both join `lib/admin/retention.ts`. `docs/DATA-RETENTION.md` gets a section.
The privacy notice gains a line on fines (processed on our own servers in
phase 1).

## Prerequisite: the daily job is switched off

`vercel.json` has `"crons": []`. Per `docs/GO-LIVE.md` it was paused for 48
hours at go-live and was to be restored before 2026-09-21. It was not. The
fines reminders, the retry pass and the digest depend on it — and so, today,
do every weekly charge request, payment reminder, overdue alert and MFK
warning.

Restoring it is a separate change with its own risk — the first run after two
weeks will catch up on everything due — and needs the owner's go-ahead. It is
not part of this feature, but the fines reminders do nothing until it is done.

## Phase 2 — Claude as the fallback (deferred)

```ts
interface FineReader {
  name: string;                                  // "free-v1" | "claude"
  read(pages: PageImage[], qr: QrBill | null): Promise<Extraction>;
}
```

Phase 2 adds a `ClaudeReader` that sends the PDF to Claude (Opus 5.5; native
PDF input; structured output in the same `Extraction` shape) **only for
documents the free reader left with missing or doubtful required fields**.
The QR decoding, validation, matching and every rule after it stay exactly as
they are; the AI never decides alone either. Switched on by
`FINES_AI_FALLBACK=on` and `ANTHROPIC_API_KEY`. Estimated at CHF 0.05–0.10
per letter it reads, to be measured.

## Testing

- **Unit (pure, the bulk):** QR-bill parser; plate normalising and fleet
  search; label extraction per language; date and time parsing including
  written-out dates in three languages; plausibility checks; field status;
  duplicate keys; possession intervals and the matching rule at every edge
  (exactly two hours, date-only across a handover, summer-time change,
  open-ended rental, imported rental); catalogue lookup; screenshot
  verification.
- **Golden letters:** a fixture set of real unmarked scans from the pile —
  police and private, notices and reminders, German, French, Italian — each
  with its expected extraction. The suite reports the share that would
  proceed alone; that figure is the phase 1 acceptance number.
- **Database:** upload → process → fine → notify; reminder handling in every
  state; duplicates; the token page and proof flow; retries; once-only
  emails. New guard tests are made to fail against the bug before they count.
- **Browser:** upload several files, the review flow, the pay page on a phone
  width — seen, not reasoned.

## Implementation order

1. **Spike on Vercel** — rasterise + QR + two-pass OCR on a deployed preview
   with 10–20 real scans. Measures time, memory, hit rate. A go/no-go for the
   free reader as designed.
2. Data model and migration; upload to R2; `FineDocument` processing; the
   section with upload and the raw result.
3. Fines: duplicates, reminders, car and possession matching, review queue
   and its actions.
4. Emails, the payment page, proof verification, the fee.
5. Reminders and digest passes (need the daily job), retention, docs.

## Needed from the office

- **20–30 unmarked scanned PDFs** across issuers and languages, before step 1.
  Ahmed's pile, scanned before anyone writes on it.
- The R2 CORS rule (step 2) — a few clicks in Cloudflare; instructions will
  be written for it.
- A decision on restoring the daily job (above).

## Open questions

1. Which `gtcVersion` introduced the fee table — decides whether older
   rentals pay the CHF 20 (decision 8). Verify in implementation.
2. Should the office receive a copy of every fine notice sent, or only the
   review digest? Designed as digest-only; trivially changed.
