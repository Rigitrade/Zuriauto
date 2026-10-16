# Rental account: deposits, late payments, cash and old weeks — design

**Status:** design, 15.10.2026. Implementation plan:
`docs/superpowers/plans/2026-10-15-payments-ledger.md`. Extends
`docs/superpowers/specs/2026-10-12-twint-payments-design.md` (read that first:
its decisions stand unless one below replaces it).

## What was asked

The owner, 15.10.2026: some renters pay the deposit at the pickup; some pay
after they have returned the car, late. Handle both, show it in the dashboard,
and organise the work. Answers given the same day:

- **Early return:** the office decides, rental by rental, whether the weeks
  after the return are still owed.
- **Old weeks:** start from a cut-over date. Weeks due before the go-live
  count as settled; the office reopens any it knows are unpaid.
- **Cash and bank:** yes — the office records them ("Barzahlung erfassen").

## What the data showed (15.10.2026, read-only on the live database)

- **Every `Charge` is still `SCHEDULED`**, including the weeks of rentals that
  were returned weeks ago. Nothing has ever marked a week paid.
- `Rental.depositCents` is the agreed deposit. Nothing records that it was
  received. The return addendum (`Contract`, kind `RETURN_ADDENDUM`) carries
  the renter's own claims: `fullyPaid`, `paymentMethods`, `paidAmountCents`,
  `paidOn`, `hasDuePayment`/`dueAmountCents`/`dueDate`/`dueMethod`,
  `depositBack`. `closeRental` turns a declared balance into week 0.
- **Once the daily cron is switched back on, every past week is requested at
  once.** `weeklyChargePass` (`lib/rental/scheduler.ts`) requests any
  `SCHEDULED` charge whose Zurich due day has arrived
  (`isDueForChargeRequest`, `lib/rental/passes.ts`), on running rentals and on
  rentals closed by a return (weeks begun before the return,
  `isOwedAfterReturn`). Weeks paid in cash months ago would all be requested.
- **ZH 615 166** — deposit CHF 250, weekly CHF 250, pickup signed 20.09 12:33.
  The renter paid CHF 500 by TWINT at 16:38 (deposit + week 1) and CHF 250 on
  29.09. The dry run of 15.10 booked the 29.09 payment to week 1, already paid
  by the 500. Right renter, wrong week.
- The 34 real notifications (17.08–12.10) named a plate in 32 and a week in
  none. 16 waited as `PAYER_MISMATCH`, 8 as `NO_RENTAL_AT_TIME`. Rentals made
  with "mark car as out" or imported from old PDFs have no weekly charges and
  no contact details.

## Decisions

1. **Cut-over, as data.** A script, run once per database, moves every charge
   with an open status (`OPEN_CHARGE`) and a due date before the go-live date
   to a new status `SETTLED` ("vor Systemstart erledigt"). **Week 0 is left
   open** (the owner, 15.10.2026): a balance the renter declared on the return
   form is a late payment still to come, not a week paid before the system.
   Data rather than a computed rule because the daily job reads
   `Charge.status`: a computed rule would leave the reminder passes chasing
   paid weeks. The date is stored on `Organisation.paymentsCutoverAt`. Each
   rental touched gets a `RentalEvent` listing the charges and their previous
   status. Paid and void weeks are never touched; a second run changes nothing.
   The office can **reopen** a settled week: `SETTLED → SCHEDULED`, recorded
   with who did it; the daily job then requests it like any due week.
2. **Office-recorded payments use the `Payment` table.** Cash, card, bank, or a
   TWINT payment whose email never arrived: `method` ≠ default, `externalId`
   `office:<uuid>`, `status BOOKED`, `matchedBy "office"`, an optional note.
   Same booking function, timeline and invariants as a TWINT payment. Undo of
   an office-recorded payment **cancels** it (`IGNORED`, event
   `payment.cancelled`) and puts back what it paid; it never waits for review.
3. **Deposit.** A payment carries `depositCents`: the part of it that is the
   deposit. Deposit received = the sum of `depositCents` over the rental's
   `BOOKED` payments — derived, so an undo needs no second bookkeeping. **One
   payment pays at most the deposit plus one week.** Deposit back = the return
   addendum's `depositBack`; refunds are not tracked as money.
4. **Weeks after an early return: the office decides per rental.** For a
   closed rental, open weeks (`weekNumber ≥ 1`) that had not begun at the close
   are *pending* until the office chooses:
   - **Stornieren** → `VOID`;
   - **Bleiben geschuldet** → `Charge.keptAfterReturn = true`, which
     `isOwedAfterReturn` honours, so the daily job chases them for a rental
     closed by a return.

   Until the office decides, today's rule holds: not chased, not counted as
   owed. The close moment is the first `rental.closed.return` or
   `rental.closed.manual` event. A rental closed by hand is still never chased
   by the daily job (its existing meaning); the decision then only changes what
   the rental account shows as owed and what a payment can be booked to.
5. **Matching order** (extends decision 4 of the TWINT spec):
   1. **Reference** — the text names a plate and a week. Unchanged.
   2. **Payer-led.** The payer is one of our customers — by email, by phone key,
      or by a remembered payer alias — and the plate is a car that customer
      rented. The payment is about *that customer's* rental of that car,
      whoever holds the car now.
      - *At pickup*: `paidAt` within [pickup − 24 h, pickup + 48 h] of that
        rental's signed pickup, and its deposit not yet fully received.
        Amount = outstanding deposit → deposit. Amount = deposit + week 1 (open)
        → deposit and week 1, from the one payment. Amount = week 1, and week 1
        differs from the deposit → week 1 (the deposit stays outstanding).
        Deposit = week 1 and the amount equals both → waits
        `PICKUP_PAYMENT`. Anything else → waits `PICKUP_PAYMENT`, that rental
        proposed.
      - *Otherwise*: that customer's rentals of the car, their **owed** open
        items (weeks owed under decision 4, plus week 0) of exactly this amount.
        One rental has such items → its earliest due. Several rentals → waits
        `REFERENCE_AMBIGUOUS`. None → waits `PAID_AFTER_RETURN` (the proposed
        rental is closed) or `AMOUNT_MISMATCH` (running).
      - `matchedBy`: `holder+payer+amount` when that rental held the car at the
        payment's minute, else `payer+plate+amount`; `payer+plate+deposit`
        when the deposit is in it.
   3. **Holder at the minute** — unchanged, for payers the system does not know.

   Still never on one signal: rule 2 needs the payer's identity and the plate to
   point at the same rental, and the amount to fit exactly.
6. **Remember the payer.** When the office books a payment by hand with
   "Zahler merken" ticked (default on), the payer's email and phone key become a
   `PayerAlias` of the rental's customer, unless that customer already has them.
   The next payment from that email or phone counts as the customer's (rule 2).
   Undo of the booking deletes the aliases it created.
7. **Screens** (German first, English in `lib/admin/labels.ts`):
   - **Zahlungen**: a "Wofür" column (Woche N · Kaution · Kaution + Woche N ·
     Restbetrag nach Rückgabe · Guthaben) and a method chip (TWINT · Bar ·
     Karte · Bank). The book form offers week / deposit / deposit + week /
     credit, "Zahler merken", and warns when the amount does not add up. A new
     tab **"Offene Beträge"**.
   - **Mietkonto**: a dialog per rental (there is no rental page), opened from
     Mieten, Verlauf, a payment's detail and Offene Beträge. Deposit (agreed,
     received and how, back), every week with what paid it, the balance after
     the return (week 0), credits, the renter's own return declaration, totals
     (fällig bis heute · bezahlt · offen), and three actions: Barzahlung
     erfassen, a settled week "wieder öffnen", the early-return decision.
   - **Overview**: one attention item "Offene Beträge", counting rentals with
     owed items due, running rentals started on or after the cut-over whose
     deposit has not arrived 48 h after pickup, and closed rentals with pending
     weeks. Links to the tab.
8. **Tested on a preview, never on production.** Previews share the live
   database today: the fines migrations ran on live at 06.10 04:57, before the
   05:55 merge. So the preview gets its own database first — a Neon branch of
   production — through Preview variables scoped to the git branch. Only then is
   the branch pushed.

## Data (additive only)

```
enum PaymentMethod       { TWINT CASH CARD BANK }
enum ChargeStatus        { … SETTLED }
enum PaymentReviewReason { … PICKUP_PAYMENT PAID_AFTER_RETURN }

Payment      + method PaymentMethod @default(TWINT)
             + depositCents Int @default(0)
             + note String?
Charge       + keptAfterReturn Boolean @default(false)
Organisation + paymentsCutoverAt DateTime?

PayerAlias(id, organisationId, customerId, kind "email" | "phone", value,
           sourcePaymentId?, createdById?, createdByName?, createdAt)
  @@unique([organisationId, kind, value, customerId])
  @@index([organisationId, kind, value])
```

`SETTLED` is not in `OPEN_CHARGE`, so the matcher, the reminder passes and the
office's week picker all treat it as not owed without further change.

## Out of scope

- Paying the deposit back as tracked money (shown from the return addendum).
- One payment across two weeks: it waits; the office books one week and the rest
  as credit, or two office-recorded payments.
- Reminders to returned renters beyond what the daily job already sends.
- Switching the daily cron back on. The cut-over is its precondition, not its
  trigger.

## Later (agreed, not scheduled)

- **A payment code per rental** (owner, 16.10.2026). Each rental gets a short
  code, printed on the contract and sent in the contract email. The renter
  types it in TWINT's message field, and the matcher books on the code
  instead of guessing from the plate and the payer's name. This would remove
  most of PAYER_MISMATCH and NO_PLATE. It fits the payment request's
  pre-filled TWINT link (twint spec, decision 8): that link would carry the
  code too.

## Measured

Filled in by plan Task D1: the dry run on the 34 real notifications against a
branch copy of production, before and after the cut-over, compared with the
15.10 baseline (2 booked, 32 waiting).
