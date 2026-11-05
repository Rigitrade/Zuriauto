# TWINT payments from the notification email — design

**Status:** design, 12.10.2026. Implementation plan:
`docs/superpowers/plans/2026-10-12-twint-payments.md`. Feasibility report (with
sources): "ZURIAUTO — Twint payment tracking & Flespi telematics: feasibility
report", 11.10.2026.

## What was asked

Eng Ahmed: TWINT emails `info@zuriauto.ch` from `no-reply@twintpay.ch` on every
payment. Read those emails, take the date and time, the amount ("Betrag") and
the car number (always `ZH…`), find who had that car at that moment, and record
the amount as a credit for that person and car.

## What the email actually carries

From the 05.10.2026 sample (a test: payer and contact are Zuriauto's own):

| Label | Example | Filled by |
| --- | --- | --- |
| Betrag | `CHF 250.00` | TWINT |
| Transaktionsdatum | `05.10.2026, 10:00` (Zurich, to the minute) | TWINT |
| Transaktions-Nr. | `ce21e52e-2354-4f6d-a7d7-64a448f335f8` | TWINT |
| Name des Stores | `Zuriauto` | TWINT |
| Name | two lines, first and last | customer |
| Kontakt | email, then phone | customer |
| Nachricht | `Auto vermieten` / `ZH918747` | customer, free text |

The plate is customer-typed. The sample's `ZH918747` is no car of ours — the
Prius is `ZH 918 474`. So the plate is evidence, not a key.

## Decisions

1. **No AI agent.** A deterministic parser over a fixed machine template. The
   mailbox holds customer mail and anyone can write to it; money needs the same
   answer every time.
2. **Only signed TWINT mail counts.** DKIM is verified by the site itself
   (`mailauth`), not read from a header Hostinger may or may not add: a pass for
   `d=twintpay.ch` that signs `From`, with no `l=` body-length limit. Anything
   else is logged and skipped. No link in the email is ever followed — one of
   them refunds the payment.
3. **One row per TWINT transaction.** `Payment` is unique on
   `(organisationId, externalId)`, the Transaktions-Nr. Reading the mailbox
   again is therefore harmless; the mailbox is read, never modified.
4. **Three signals, booked only when two agree.**
   - *Reference*: the Nachricht names one of our plates **and** a week
     (`W3`, `W 3`, `Woche 3`) — the reference every payment request already
     quotes (`lib/rental/scheduler.ts`, `` `${plate} W${week}` ``).
   - *Plate + time*: the Nachricht names one of our plates; whoever held that
     car at the payment moment (`responsibleAt`, the fines rule: real handover
     times, 2-hour handover margin, overlap detection).
   - *Payer*: the Kontakt email equals a customer's email, or its phone
     normalises (`normalisePhone`) to a customer's `phoneKey`.

   Booked automatically when **reference + exact amount of that charge**, or
   **plate-and-time renter = payer customer + an open charge of exactly that
   amount**. Everything else waits for the office with a reason and the
   candidates. Never booked on one signal.
5. **"Credit" means: the charge is PAID.** A booked payment points at one
   `Charge`, which moves to `PAID` with `paidAt` = the payment moment. A
   payment the office links to a rental without a charge (deposit, damage,
   anything else) is a credit on that rental. One payment pays at most one
   charge in this version.
6. **Every booking is reversible and attributed.** `PaymentEvent` records who
   booked, ignored or undid what (`actorId` null = the system), like
   `FineEvent`. Undo restores the charge's previous status.
7. **The trigger is a separate cron route**, `/api/cron/payments/`, behind the
   same bearer secret as the daily run. Vercel's free plan runs crons once a
   day, so the 10-minute trigger is an external scheduler (cron-job.org) or
   Vercel Pro. Unconfigured mailbox → the route answers `skipped`, never fails.
8. **The payment request carries the reference into TWINT.** The charge-due
   email gains a TWINT link with `&trxInfo=<reference>&amount=<CHF>`. Only
   after a real test payment shows where `trxInfo` lands.

## Out of scope (this version)

- Importing the TWINT portal's *Transaktionen* export for reconciliation — no
  real export file seen yet; its columns are unverified.
- Refunds: TWINT is not known to email them. The office undoes the booking.
- Splitting one payment across several charges.
- A payment provider with webhooks (Stripe, Payrexx) — the sturdier route if
  the email proves too noisy; `lib/payments/index.ts` is already the seam.

## Data

```
enum PaymentStatus { BOOKED NEEDS_REVIEW IGNORED }
enum PaymentReviewReason {
  NO_PLATE PLATE_NOT_IN_FLEET PLATE_AMBIGUOUS PLATE_DOUBTFUL
  NO_RENTAL_AT_TIME HANDOVER_BOUNDARY OVERLAPPING_RENTALS
  PAYER_MISMATCH AMOUNT_MISMATCH CHARGE_ALREADY_PAID
}
Payment(id, organisationId, externalId, amountCents, currency, paidAt,
        storeName?, payerName?, payerEmail?, payerPhone?, message?,
        status, reviewReason?, matchedBy?, candidates String[],
        rentalId?, chargeId?, mailUid?, createdAt, updatedAt)
PaymentEvent(id, paymentId, type, payload Json?, actorId?, actorName?, createdAt)
```

## Configuration

| Variable | Meaning |
| --- | --- |
| `TWINT_IMAP_USER` | Mailbox to read, e.g. `payments@zuriauto.ch`. Unset = feature off |
| `TWINT_IMAP_PASS` | Its password |
| `TWINT_IMAP_HOST` | Default `imap.hostinger.com` |
| `TWINT_IMAP_PORT` | Default `993` |
| `TWINT_IMAP_MAILBOX` | Default `INBOX` |
| `TWINT_LOOKBACK_DAYS` | How far back each run searches, default `14` |
