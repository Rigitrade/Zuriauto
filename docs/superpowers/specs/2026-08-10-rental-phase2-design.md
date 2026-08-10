# Rentals database, return flow and admin (Phase 2)

**Date:** 2026-08-10
**Status:** Draft — awaiting review
**Builds on:** `2026-08-10-rental-pickup-contract-design.md` (Phase 1, shipped)

## Problem

Phase 1 produces a signed pickup contract and emails it. Nothing is stored, so
there is no record of a rental, no way to close one out, and no return
protocol. A damage or deposit dispute still cannot be settled, because the
pickup baseline lives only in a PDF in someone's inbox.

The client asked for a rentals table with a `draft → active → completed`
workflow, a token-linked return step with a second signature, and secure API
routes.

## Scope

**In:** rentals data model, admin authentication, rental creation, tokenised
pickup, file storage, the return flow, the final PDF, an admin dashboard, a
retention job.

**Out:** payments and card capture, invoicing, accounting export, customer
accounts, fleet maintenance scheduling. Each is a separate piece of work; card
payment alone would add 5–8 days.

## Gaps found in the requirements

The client's brief is missing seven things the workflow cannot function
without. Each is resolved by a decision below.

1. **Nothing creates the rental.** The brief starts at the pickup form, but a
   row must exist before a customer can open it.
2. **The deposit taken is never recorded** — only the refund. A refund cannot
   be computed from nothing.
3. **No dates, no price.** A rental contract without a period or a rate cannot
   support late fees or excess mileage, and is thin as a contract.
4. **The return form does not show the pickup baseline.** "New damage" has no
   meaning without displaying what was recorded at handover.
5. **Who signs the return is ambiguous** — the brief says "Admin/Customer".
6. **No retention policy**, although Phase 2 moves identity documents into
   durable storage.
7. **Abandoned drafts** hold a vehicle forever.

## Decisions

1. **A rental is created by the office, not the customer.** New status `draft`
   is written when staff pick the vehicle, dates, starting mileage, deposit and
   price, and generate the customer link.

   This also settles the open question from Phase 1: the client's brief said
   mileage was "to be entered manually by me each time". Phase 1 put it on the
   customer because the form was public. With rentals created by staff, the
   original intent is restored — the customer never touches the odometer
   reading.

2. **Managed Postgres in the EU, one vendor.** Supabase for database, private
   file storage and admin authentication. Switzerland recognises the EU as
   providing adequate protection, so Frankfurt satisfies the revDSG without
   paying for Swiss residency.

   Rejected: self-hosting. Owning encryption at rest, patching, backup
   verification and breach notification for a store of passport scans is a
   large standing liability against a saving of roughly $25 a month.

   Rejected: MongoDB. It provides no object storage, so images would need a
   second vendor and authentication a third. The deciding factor is that this
   system records money — deposits taken, refunds, deductions — where
   transactions and foreign keys are worth more than schema flexibility.

3. **The customer signs the return on the staff device.** Staff record final
   mileage, fuel, new damage and the refund; the customer reviews and signs
   before the rental closes. A deduction the customer signed for is defensible;
   one recorded only by staff is not.

4. **Full commercial terms are captured** — pickup and expected return
   date/time, daily rate, total, and deposit taken. Without them the return
   step cannot calculate a refund, late fee or excess mileage, and the deposit
   figure the client asked to store has nothing to reconcile against.

5. **PDF generation moves server-side.** `lib/rental/contractPdf.ts` is already
   pure and runs unchanged in a route handler. This closes the Phase 1 trust
   gap where a determined customer could alter the document before sending.

6. **Tokens are stored hashed, single use, and expiring.** A 32-byte random
   token is generated per link; only its SHA-256 hash is stored. The pickup
   token is consumed on submit so a link cannot be replayed. Treating it as a
   password means a database leak does not hand over access to contracts.

7. **An append-only audit log records every state change** — who, what, when.
   Not in the client's requirements. When a customer disputes a CHF 800
   deduction, "the system says so" is weak; a timestamped record of which
   operator entered which figure is strong.

8. **Identity images have a defined lifetime, deleted by a nightly job.** The
   period is a configuration value, defaulting to 90 days after completion,
   with the contract PDF retained separately for accounting. The client and
   their lawyer set the final number; the system must not ship with retention
   undefined.

   The same job expires abandoned drafts. A rental left in `draft` past its
   token expiry moves to `expired` and releases the vehicle, so a customer who
   opens the link and never finishes does not block a car indefinitely.

9. **Email stays on Hostinger SMTP.** It works, `zuriauto.ch` publishes SPF,
   DKIM and DMARC, and it costs nothing. Adding Resend would solve a problem
   that no longer exists.

## Architecture

### Stack

| Concern | Choice |
| --- | --- |
| Database | Supabase Postgres, EU (Frankfurt) |
| Files | Supabase Storage, private buckets, signed URLs |
| Admin auth | Supabase Auth, magic link |
| Queries | Drizzle ORM with SQL migrations |
| PDF | existing `contractPdf.ts`, server-side |
| Mail | existing Hostinger SMTP via nodemailer |
| Scheduled work | Vercel Cron |

### Data model

```
vehicles     id, model, plate, vin, current_km, active
customers    id, first_name, last_name, birth_date, street,
             postal_code, city, mobile, email
rentals      id, status, vehicle_id, customer_id,
             starts_at, expected_return_at, returned_at,
             daily_rate, total_price, deposit_taken, deposit_refunded,
             km_out, km_in, fuel_out, fuel_in,
             damage_out, damage_in,
             pickup_token_hash, return_token_hash, token_expires_at,
             gtc_version, created_by, created_at
documents    id, rental_id, kind, storage_path, created_at
             kind: id_card | licence | condition_out |
                   condition_in | contract_pdf | return_pdf
signatures   id, rental_id, stage, image_path, signed_at, ip, gtc_version
             stage: pickup | return
audit_log    id, rental_id, actor, action, detail, created_at
```

`documents` is a typed table rather than columns on `rentals` so the retention
job can delete identity images by `kind` while leaving the contract PDFs in
place.

### Status transitions

```
draft ──(customer submits pickup)──► active ──(return signed)──► completed
  │
  └──(expires, nightly job)──► expired
```

Transitions happen in a single transaction with the audit log write, so a
half-completed status change is not possible.

### Routes

```
app/(admin)/                        auth-guarded segment
  rentals/page.tsx                  list, filter by status
  rentals/new/page.tsx              create a rental, generate pickup link
  rentals/[id]/page.tsx             detail, documents, resend link
  rentals/[id]/return/page.tsx      the return protocol
app/r/[token]/page.tsx              customer pickup form, token-fed
app/api/rentals/...                 server actions preferred where possible
app/api/cron/retention/route.ts     nightly deletion and draft expiry
```

The customer-facing path shortens to `/r/<token>` — it is typed from a phone
and pasted into WhatsApp.

### Reused from Phase 1

`contractPdf.ts`, `imageCompress.ts`, `schema.ts`, `labels.ts`,
`SignaturePad`, `PhotoCapture`, `GtcAcceptance` and the four-step wizard carry
over unchanged. The Phase 1 submit handler is replaced: instead of building the
PDF in the browser and posting it, the form posts its data and images, and the
server writes the record, stores the files, renders the PDF and sends the mail.

`/api/rental-contract` is retired once the tokenised flow is live.

### The return screen

The highest-value screen in the system, and the one the brief does not
describe. It shows the pickup baseline beside the return inputs:

```
Pickup (recorded 04.08.2026)      Return (now)
────────────────────────────      ─────────────────────
km_out      66 000                km_in      [_____]
fuel_out    4/4                   fuel_in    [ ¼ ½ ¾ F ]
damage_out  "Kratzer hinten"      new damage [_________]
[3 condition photos]              [add photos]

Deposit taken   CHF 500
Deductions      CHF [____]  reason [__________]
Refund          CHF 500          ← computed, not typed

                         [ customer signs ]
```

The refund is derived from deposit minus deductions rather than typed, so the
figure on the PDF always reconciles.

## Security

- Admin routes are guarded by Supabase Auth session; every mutation
  re-checks server-side rather than trusting the client.
- Storage buckets are private. Images are served only through short-lived
  signed URLs generated for an authenticated request.
- Row-level security is enabled so a leaked anon key grants nothing.
- Tokens are single use, hashed at rest, and expire.
- Rate limiting moves to the database, replacing the Phase 1 in-memory limiter
  that resets on cold start.
- The audit log is append-only, with no update or delete path in the app.

## Testing

The repository has no test framework. Phase 2 adds Vitest and covers:
the PDF builder, the schema and refund arithmetic, token generation and
verification, and status transitions including the illegal ones. Device testing
on real iOS and Android for camera and signature stays manual.

For a system producing signed legal documents and moving deposit money, this is
not the place to save two days.

## Milestones

| Milestone | Days |
| --- | --- |
| M1 — Supabase, schema, Drizzle, migrations, admin auth, rental creation | 4–5 |
| M2 — tokenised pickup, server-side PDF, storage, status transition | 4–5 |
| M3 — return flow, baseline comparison, second signature, final PDF | 4–5 |
| M4 — dashboard, retention job, hardening, tests, deploy | 4–5 |
| **Total** | **16–20 days** |

Four to five calendar weeks including review cycles. The estimate assumes the
fleet data is supplied, the client answers the retention question, and scope
does not grow into payments or invoicing.

Running cost: Supabase free tier covers roughly 1 000 contracts, then about $25
a month. Vercel Pro at about $20 a month is required regardless, as the Hobby
plan excludes commercial use.

## Open questions for the client

1. **Retention period** for identity images. Defaulting to 90 days after
   completion pending their lawyer's answer.
2. **Deposit amounts** — fixed per vehicle, per package, or entered each time?
3. **Who gets an account?** How many staff need admin logins.
4. **The remaining nine vehicles** — model, plate and chassis number. Still
   outstanding from Phase 1.
