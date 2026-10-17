# WhatsApp extension question and payment code — plan

Status: plan, 17.10.2026. Nothing built. Builds on
`docs/superpowers/specs/2026-10-16-rental-types-weekly-extension-design.md`
(decisions of 16.10.2026) and the payments ledger spec's "Later" section
(`docs/superpowers/specs/2026-10-15-payments-ledger-design.md`, on
`feat/twint-payments`).

## What the owner asked (16.10.2026)

1. **WhatsApp extension question.** 72 hours before a weekly rental's week
   ends, the renter gets a WhatsApp message: "Will you extend your car rental
   for the next week? YES / NO", in German, French and English. The office
   always knows what is rented until when, and when each car comes back.
2. **Payment code.** A code per rental, in the contract and the contract
   email, that the renter types into TWINT's message field, so every payment
   names its rental.

## Where things stand (facts that shape the plan)

- **The daily job is off in production.** `vercel.json` has `"crons": []`
  since go-live (commit `ba0ed8d`, meant for 48 hours, never restored —
  `docs/GO-LIVE.md`, fines spec). So today nothing automatic reaches a
  renter: no end reminder, no weekly payment request, no overdue alert, no
  online-extension link. Both features need it on.
- **Turning it on catches up on everything due.** `weeklyChargePass` would
  request every past week still SCHEDULED. The payments ledger's cut-over
  (weeks due before go-live count as settled) is what makes the first run
  safe; the ledger spec already makes the cut-over the precondition.
- **TWINT matching is built but not live** (`feat/twint-payments`, 40
  commits, needs a preview database and the owner's Neon and Vercel logins,
  then the measurement on the 34 real emails and the cut-over). It also has
  to take `main` first: guard `CREATE TYPE "PaymentMethod"` in
  `20261015201919_payments_ledger`, and handle weekly rentals with no end.
- **The job runs once a day**, at a random minute between 09:00 and 10:00
  Zurich (summer; 08:00–09:00 in winter) on Vercel's Hobby plan. "72 hours
  before" is therefore a window: asked between about 72 and 48 hours before
  the end.
- **No outbound WhatsApp exists.** `lib/whatsapp.ts` only builds `wa.me`
  click-to-chat links.
- **Renter emails exist in German and English only.** A French contract
  gets German mail (`asRentalLanguage`). French messages are new work.
- **The extension and the return intent already exist** (`lib/rental/manage.ts`:
  `extendRental`, `recordReturnIntent`, single-use tokens, 14 days), behind
  the email sent 24–48 hours before the end. A return intent is recorded but
  shown nowhere in admin today.
- **The renter sees no payment reference except "ZH 513 925 W3"** in the
  weekly payment email, with a plain SumUp link and no TWINT link. An
  extension's charges carry a reference (`<rental id> EXT`) the matcher
  cannot read.
- **Contract numbers are `ZA-YYYYMMDD-NNNN`** (per contract, per day) — too
  long to type into TWINT and not per rental.

## Order of work

| Phase | What | Blocked by | Size |
|---|---|---|---|
| 0 | Start the long lead times (no code) | — | Eng Ahmed, 1–14 days |
| 1 | TWINT payments live, cut-over, daily job back on | owner's logins; reviewed dry run | ~2 days |
| 2 | Payment code | Phase 1 (lives on the payments code) | ~2 days |
| 3 | WhatsApp extension question | Phase 0 (Meta ready), Phase 1 | ~4 days |

Phase 2 can be built while Phase 0 runs; Phase 3 is built once Meta has a
working number and an approved message. Sizes are build days, tests and
browser checks included, not calendar days.

## Phase 0 — start now (no code)

Eng Ahmed, in parallel:

1. **Meta Business verification** for Rigitrade AG (business documents;
   takes from a few days to two weeks). Needed for any WhatsApp API number.
2. **Choose the WhatsApp number** (decision 1 below).
3. **TWINT test payment, CHF 1.00**, through
   `<TWINT link>&trxInfo=ZA-TEST1&amount=1.00`: does "ZA-TEST1" arrive in
   the shop's payment email as the "Nachricht"? Does the renter's app show the
   same Transaktions-Nr. as that email? Both answers are open since 12.10.
   TWINT documents `trxInfo` (payment purpose) and `amount`; the payer can
   still edit both.
4. **TWINT portal:** make the message field mandatory, labelled
   "Zahlungscode (z. B. ZA-K7M3P)" (payment code).

The office:

5. **Close what is no longer out** on the live database (e.g. the stale
   ZH 918 474 rental of August named in `docs/GO-LIVE.md`, the test rental
   "Mohamed A."), so the first daily run does not mail anyone about a car
   long returned. Read-only check first, every change confirmed.

## Phase 1 — payments live and the daily job back on

The existing ledger plan, Part D, plus the cron:

1. `feat/twint-payments` takes `main`: guard the enum migration, make the
   ledger's `endAt` readers handle null, re-run its suites.
2. Neon branch database for the preview; Preview variables scoped to the
   branch; `SMTP_HOST=smtp.invalid` there.
3. Dry run on the 34 real emails before the cut-over; record the result.
4. Production: merge, cut-over dry run reviewed with the owner, then
   `--commit`; the 10-minute payments schedule with a failure email.
5. **The daily job:** a dry run of every pass against live (read only),
   listing exactly which mails the first run would send, reviewed with the
   owner. Then restore `{ "path": "/api/cron/daily/", "schedule": "0 7 * * *" }`
   and watch the first two runs.

## Phase 2 — payment code

### The code

- **One per rental**, made at the pickup, kept for its life (an extension is
  the same rental, so the same code — this also fixes the unreadable
  `EXT` reference).
- **Format `ZA-K7M3P`**: "ZA", four characters, one check character. The
  alphabet leaves out 0/O, 1/I/L and B/8 so it reads off a phone and over the
  phone: 29 symbols (2–7, 9 and 22 letters). Four characters give about
  700,000 codes. Because 29 is prime, a weighted check character (sum of
  position × value, mod 29) catches every single wrong character and every
  swap of two neighbours, so a typo is recognised as a typo rather than read
  as another renter's code.
- **Read loosely**: case, spaces and dashes do not matter
  ("za k7m3p", "ZAK7M3P", "ZA-K7M3P"), anywhere in the message.
- `Rental.paymentCode`, unique per organisation; existing open rentals get
  one in the migration's backfill.

### Where the renter sees it

| Place | Today | With the code |
|---|---|---|
| Contract PDF | contract number, payment method | a "Zahlung" (payment) block: code, TWINT and bank instructions |
| Contract email | contract number, plain links | code, and a TWINT link pre-filled with code and amount* |
| Weekly payment email | "Referenz: ZH 513 925 W3", SumUp link | code and week, TWINT link pre-filled* |
| Extension confirmation | — | code, new week's amount, TWINT link* |
| WhatsApp YES reply (Phase 3) | — | same as the extension confirmation |
| Admin | — | on the rental row and in the rental account (Mietkonto) |

\* Only if the CHF 1 test shows the pre-filled text arriving in the shop's
email. Otherwise the code is written out with "please type it in the
message".

### How the matcher uses it

On `feat/twint-payments`, at the reference step (`lib/payments/twint/evidence.ts`):

1. A valid code names the rental with certainty — payer name, plate and
   rental period no longer have to agree. This is the case that today waits
   as PAYER_MISMATCH (16 of 34) or NO_PLATE.
2. The amount then chooses what it pays, with the rules already there:
   one open week, the deposit, deposit + week 1. An amount that fits two
   items (deposit 250 = week 250) still waits for the office.
3. A code whose rental is closed still books: the ledger's
   "paid after return" rules apply.
4. New review reasons: **CODE_TYPO** (check character wrong; the office sees
   the nearest valid codes) and **CODE_UNKNOWN** (valid form, no such
   rental). Both fall back to today's plate and payer rules.
5. Code and plate naming different rentals: waits as **CODE_PLATE_CONFLICT**.
6. Bank transfers: the office books them by hand (as on the branch today);
   the code in the transfer message makes it one click. No QR bill — out of
   scope.

### Tests

The code generator and check character (every single-character error and
neighbour swap caught); the reader's tolerance; each matcher rule above,
each proven to fail first; the contract PDF and emails carry the code; a
DB test from a raw TWINT email with a code to a booked week. The dry-run
tool reports how many of the next real payments carry a code.

## Phase 3 — WhatsApp extension question

### The renter's side

Asked by the daily job for a **weekly rental that is out, ends within 72
hours, and has not been asked for this end date**, when the renter agreed
to WhatsApp and has a mobile number that normalises (`Customer.phoneKey`).
In the contract's language (de / fr / en):

> Hallo Anna, Ihre Miete Toyota Prius ZH 513 925 endet am Montag, 26.10.,
> um 10:00. Möchten Sie um eine Woche verlängern (CHF 450.00)?
> **[Ja, verlängern]** **[Nein, ich bringe es zurück]**

(English: "Hello Anna, your rental … ends on Monday 26.10 at 10:00. Would
you like to extend by one week (CHF 450.00)? [Yes, extend] [No, I'll bring
it back]".)

| Answer | What happens |
|---|---|
| **Yes** | Extended one week (`extendRental`): new end, new week charge. WhatsApp reply with the new end, the amount, the payment code and the TWINT link; the confirmation email as today. Admin: "verlängert per WhatsApp" (extended by WhatsApp). |
| **No** | Return intent recorded (`recordReturnIntent`). Reply: "Thank you — please bring the car back on Monday 26.10 at 10:00." Admin: "Rückgabe angekündigt: Mo 26.10." (return announced) — new, today an intent is shown nowhere. |
| **No answer in 24 h** | Office alert in the bell and the overview: "No answer to the extension question — please call." The renter gets the same question by email with the existing Yes/No links. |
| **Message fails** (no WhatsApp, blocked, wrong number) | The email question at once; the office sees why. |
| **Any other reply** | Shown to the office as an alert with the text. |

The 24–48 hour end-reminder email stays for renters without WhatsApp and as
the fallback above; renters who answered on WhatsApp do not get it too.

### Opt-in and data protection

- Meta requires the renter's agreement to messages from ZURIAUTO, naming
  the business; a website form or a signed paper both count. The pickup
  form gets a tick box: "Ich bin einverstanden, dass ZURIAUTO mir Nachrichten
  zu dieser Miete per WhatsApp sendet" (I agree that ZURIAUTO may send me
  messages about this rental on WhatsApp). Stored with the contract.
- GTC 16.10.2026 clause 17.3 already allows messages to the contact details
  in the contract. The **privacy policy** must name Meta (WhatsApp) as a
  recipient, data abroad included.

### What gets built

1. Opt-in tick box at pickup, stored and printed on the contract; privacy
   policy text.
2. A small WhatsApp client (`lib/whatsapp/`): send the approved template,
   send a reply; dry mode when not configured; an **allow-list** so the
   first week only messages test numbers.
3. A webhook (`/api/whatsapp/webhook/`): Meta's verification handshake,
   signature check on every call, duplicate deliveries ignored, delivery
   and read receipts stored, button taps turned into Yes/No through a
   single-use token carried in the button.
4. Two daily passes: ask, and "no answer after 24 h". New notification kinds
   (migration). The existing mail-retry pass must not resend WhatsApp rows.
5. Admin: the answer on the rental row, the alert in the bell and overview,
   the messages per rental.
6. French renter texts for these messages (WhatsApp and the email fallback).
7. The weekly rentals signed on 16.10 with no end get an end at the close of
   their current week (decision 4), so they are asked too.

### Tests and go-live

Unit tests for the window and the texts in three languages; DB tests for
each answer, the no-answer path and a failed send, each proven to fail; the
webhook's signature check; a browser check of the opt-in and the admin
screens. Go-live with the allow-list (Eng Ahmed's and the office's phones),
then everyone after a week without surprises.

### Cost

- **Meta:** per delivered template message. Switzerland is in Meta's "Rest
  of Western Europe" group; a utility message costs about €0.014. Replies
  inside the 24-hour window after the renter answers are free on Meta's
  current rules. At ~10 weekly renters that is ~45 questions a month,
  **under €1 a month**. Meta publishes rate changes ahead (the last one
  took effect 1.10.2026); third-party sites disagree with Meta's page about
  whether replies stay free, so check the live rate card at setup.
- **The number** — decision 1.

## Decisions needed

1. **Which WhatsApp number sends the question?**
   - **A. A new number, on Meta's own Cloud API.** No platform fee — only
     Meta's messages and a SIM or virtual number. Renters see the verified
     name "ZURIAUTO". Their replies reach the system, not the office's phone;
     the office reads them in admin.
   - **B. Today's office number +41 76 366 66 69, kept in the WhatsApp
     Business app as well ("coexistence").** Renters get the question in the
     chat they already have with the office, and free-text replies land in
     the office's app. Needs onboarding through a Meta partner (e.g.
     360dialog, about €49 a month per number); the app must stay in regular
     use, and app features like broadcasts don't work through the API.
   - Lean: **B** if one familiar number matters most to the renters; **A**
     if cost does.
2. **Opt-in tick box:** optional, unticked (recommended) — renters who
   don't tick get email only — or required.
3. **Yes while a week is unpaid:** extend and say so in the office alert
   (recommended), or hold the extension for the office.
4. **The 16.10 rentals with no end:** give each an end at the close of its
   current week (recommended; a live data change, confirmed first).
5. **Payment code format `ZA-K7M3P`** (recommended), or another prefix.
6. **Email end reminder** only for renters without WhatsApp and as the
   fallback (recommended), or always as well.

## Out of scope

- WhatsApp for daily (tourism) rentals: email only, as decided.
- WhatsApp payment reminders and other messages (each one is a new
  approved template; possible later on the same setup).
- Generating QR bills for rent.

## Sources (17.10.2026)

- Meta, WhatsApp Business Platform pricing:
  https://developers.facebook.com/docs/whatsapp/pricing
- Meta, getting opt-in:
  https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in
- Switzerland utility rate (third-party summary of Meta's rate card):
  https://chatarmin.com/en/blog/whatsapp-business-costs ,
  https://whapier.com/pricing/ch
- Coexistence: https://docs.360dialog.com/docs/resources/phone-numbers/coexistence ,
  https://www.ycloud.com/blog/whatsapp-business-app-coexistence-meta-update
- 360dialog / Twilio fees:
  https://ezcontact.ai/en/blog/whatsapp-api-pricing-comparison-meta-twilio-360dialog-ezcontact/
- TWINT paylink parameters:
  https://www.twint.ch/content/uploads/2024/11/Paylink_personalization_EN.pdf
