# Lifecycle automation (Phase 3)

**Date:** 2026-08-18
**Status:** Draft for review
**Companion to:** `2026-08-16-rental-platform-roadmap.md`
**Builds on:** `2026-08-16-rental-persistence-design.md` (Phase 2, shipped)
**Scope:** The pre-end reminder, the tokenised manage page, extension and its
payment request, weekly charges, and the overdue and mail-retry passes. The
return wizard is Phase 4; the dashboard is Phase 5.

## Problem

This is the client's headline ask: email the renter before a rental ends and
offer confirm-return or extend-and-pay. Phase 2 built everything it reads from
— `Rental.endAt` is written rather than computed, and the
`[organisationId, status, endAt]` index exists for exactly this query — but
nothing yet runs on a timer, nothing can be sent to a renter, and there is no
way for a renter to answer.

Three things are missing, and each is a decision rather than a line of code.
A renter has no account, so a link has to authenticate them. A reminder that
sends twice is worse than one that sends late, so repetition has to be
impossible rather than discouraged. And an extension changes money, so the
system has to be able to ask for it without knowing who processes it.

## Decisions

1. **A renter authenticates by holding a link, and nothing else.** `ActionToken`
   is 32 random bytes in the URL; the database stores only its SHA-256 hash,
   its purpose, its rental, an expiry and a `usedAt`. Verification is a lookup
   by hash.

   Chosen over a signed stateless token (HMAC or JWT) because single use and
   revocation are the properties that matter here, and both need a row anyway.
   Chosen over storing the token in plaintext because a database dump should
   not hand over a set of live links to strangers' rental records.

   **This is emphatically not `APPLY_SECRET`.** That is an office credential
   pasted into WhatsApp by staff. Mailing customers the office key would give
   every past renter permanent write access to the system of record, which is
   the warning already written into `lib/applyKey.ts`.

2. **Every send is a row whose uniqueness makes a double-send impossible.**
   `Notification` carries `@@unique([rentalId, kind, dedupeKey])`, and a pass
   inserts the row *before* it sends. A unique violation means someone already
   sent it, and the pass moves on.

   This is roadmap decision 6, and it is why the client's proposed
   `reminderSent: boolean` is rejected: a boolean is set *after* the send, so
   two concurrent runs both read false and both send. The old repo's
   `@@unique([rentalId, weekNumber])` on charges encodes the same rule.

   Consequence worth stating plainly: if the send then fails, the row exists and
   blocks a retry. So the row records the failure and `mailRetryPass` picks it
   up. The dedupe key guards *the decision to send*; delivery state is a
   separate column.

3. **The payment processor stays undecided, and this design does not need it
   to be.** One interface — *create a request for an amount against a
   reference, return a URL* — and one degenerate implementation that returns
   the existing static SumUp link, with the office confirming payment by hand.

   Carried forward verbatim from roadmap decision 3. The open question of
   whether that SumUp link already offers TWINT is still open, and Phase 3
   ships either way: with a working payment path if it does, a manual one if
   it does not.

4. **Passes are pure functions guarded twice.** An `isDueFor…(row, now)`
   predicate decides, and the write is a conditional `updateMany` whose WHERE
   repeats the precondition. Ported from `backend/src/scheduler/passes.ts` in
   the old repo, which is the one part of that system whose tests were worth
   keeping.

   The double guard is what makes a concurrent second run harmless: the
   predicate can be true twice, the update can only succeed once.

5. **One cron route, bearer-protected, running every pass in order.** Because
   the passes are pure functions behind a single handler, the trigger is
   swappable in minutes — Vercel Cron, GitHub Actions, cron-job.org or a manual
   `curl` all call the same URL. Daily is adequate for a 24-hour notice, which
   is what the free tier allows.

6. **An extension mutates `totalWeeks` and recomputes `endAt`.** This is the job
   the Phase 2 spec assigned to it: recomputing `endAt` is the job of whatever
   changes `totalWeeks`, which in Phase 3 is the extension flow. New `Charge`
   rows are created for the added weeks, and the reminder for the new `endAt`
   becomes due later under a different dedupe key.

7. **"Confirm return" records intent; it does not complete the rental.** The
   renter says they are bringing it back, the office is told, and a
   `RentalEvent` records it. Status stays `ACTIVE` — the car is not back yet,
   and the overdue pass should still fire if it never arrives.

   `RentalStatus.RETURN_SUBMITTED` stays reserved for Phase 4, when the return
   wizard is actually submitted. Overloading it here would leave the Phase 5
   dashboard unable to tell a promise from a handover.

8. **A weekly rental's charges are generated up front, not on the fly.** The
   full schedule is written when the rental is created, so the pass walks rows
   instead of doing date arithmetic at runtime. Ported from
   `generateWeeklyCharges` in the old repo.

   Consequence: rentals already created under Phase 2 have no charges. A
   backfill is provided as a script rather than a migration, because it needs a
   human to confirm the amounts are right before money is asked for.

## Schema additions

```prisma
enum ChargeStatus       { SCHEDULED REQUESTED REMINDED OVERDUE PAID VOID }
enum NotificationKind   { RENTAL_ENDING RENTAL_OVERDUE CHARGE_REQUESTED
                          CHARGE_REMINDER CHARGE_OVERDUE EXTENSION_CONFIRMED
                          RETURN_INTENT }
enum ActionTokenPurpose { MANAGE_RENTAL }

model Charge {
  id              String       @id @default(cuid())
  organisationId  String
  rentalId        String
  /// 1-based. Extensions continue the sequence rather than restarting it.
  weekNumber      Int
  dueDate         DateTime
  amountCents     Int
  currency        String       @default("chf")
  status          ChargeStatus @default(SCHEDULED)
  paymentUrl      String?
  providerRef     String?
  requestedAt     DateTime?
  remindedAt      DateTime?
  officeAlertedAt DateTime?
  paidAt          DateTime?
  createdAt       DateTime     @default(now())

  rental Rental @relation(fields: [rentalId], references: [id])

  /// The old repo's rule, kept. Two runs cannot create two week-3 charges.
  @@unique([rentalId, weekNumber])
  @@index([status, dueDate])
}

model Notification {
  id             String           @id @default(cuid())
  organisationId String
  rentalId       String
  kind           NotificationKind
  /// What makes this send distinct — the Zurich day of an endAt, a week
  /// number. Never a timestamp, which would be unique on every run and so
  /// would dedupe nothing.
  dedupeKey      String
  to             String
  sentAt         DateTime?
  error          String?
  attempts       Int              @default(0)
  createdAt      DateTime         @default(now())

  rental Rental @relation(fields: [rentalId], references: [id])

  @@unique([rentalId, kind, dedupeKey])
  @@index([sentAt, attempts])
}

model ActionToken {
  id             String             @id @default(cuid())
  organisationId String
  rentalId       String
  purpose        ActionTokenPurpose
  /// SHA-256 of the token. The token itself exists only in the email.
  tokenHash      String             @unique
  expiresAt      DateTime
  usedAt         DateTime?
  createdAt      DateTime           @default(now())

  rental Rental @relation(fields: [rentalId], references: [id])

  @@index([rentalId, purpose])
}
```

`Rental` gains `charges`, `notifications` and `tokens` back-relations. Nothing
that already exists changes shape, so the migration is additive.

## The passes

Run in this order by `runDailyPasses(now)`. Each returns a count.

| Pass | Selects | Does | Dedupe key |
|---|---|---|---|
| `preEndReminder` | `ACTIVE`, `endAt` within the next 24–48 h | Mints a `MANAGE_RENTAL` token, emails the renter a link | Zurich day of `endAt` |
| `weeklyCharge` | `SCHEDULED` charges whose `dueDate` has arrived in Zurich terms, rental `ACTIVE` | Creates a payment request, emails the link, moves to `REQUESTED` | `week-<n>` |
| `chargeReminder` | `REQUESTED`, unpaid, `CHARGE_REMIND_AFTER_HOURS` elapsed | Re-sends the link, moves to `REMINDED` | `week-<n>` |
| `chargeOverdue` | `REMINDED`, unpaid, `CHARGE_ALERT_AFTER_HOURS` elapsed | Alerts the office, moves to `OVERDUE` | `week-<n>` |
| `rentalOverdue` | `ACTIVE`, `endAt` in the past | Alerts the office | Zurich day of `endAt` |
| `mailRetry` | `Notification` unsent, `attempts < 3`, at least an hour old | Tells the office delivery failed | — |

**The 24–48 hour window is a deliberate widening of the client's "24 hours",
and needs confirming.** A daily cron running at 09:00 would otherwise miss a
rental ending at 08:00 the next morning entirely. Looking two days ahead and
deduping on the Zurich day of `endAt` means the notice goes out between 24 and
48 hours before the end, always exactly once. The alternative is an hourly
cron, which needs a paid Vercel plan.

`mailRetry` is the mitigation the Phase 1 and Phase 2 specs both promised for
SMTP-from-serverless, finally implemented: send failures are recorded and
retried rather than lost.

The minimum age is deliberate. Without it the pass runs last in the same daily
run that failed and escalates within milliseconds, so a transient SMTP blip —
the common case on a serverless mailer — would bother the office instead of
simply succeeding on the next run.

## The manage page

`/rental/manage/?t=<token>` — a server component that resolves the token and
renders one of three states.

- **Valid.** The rental, the car, the agreed return, and two choices: *I will
  return it* or *extend by N weeks*. An extension shows its price before it is
  confirmed.
- **Expired or already used.** An explanation and the office's phone number.
  Never a form.
- **Unknown.** The same message. A wrong token and a used token are
  indistinguishable to the caller by design.

Two actions, both `POST` route handlers taking the token in the body:
`/api/rental/return-intent/` and `/api/rental/extend/`. Both consume the token,
so a forwarded link cannot be replayed.

Single use means a renter who extends and then wants to extend again needs a
new link. That is acceptable — the next reminder brings one.

## Error handling

| Failure | Behaviour |
|---|---|
| Mail fails inside a pass | `Notification.error` set, `attempts` incremented, retried by `mailRetry` up to three attempts |
| Payment provider fails | Charge stays `SCHEDULED`; the next run retries. No partial state. |
| Token used twice | The second use gets the expired page. The first action stands. |
| Extension when the car is already re-let | Rejected; the office resolves it. |
| Cron runs twice in a minute | Every pass is a no-op the second time. Pinned by a test that runs the whole day twice and asserts one send. |
| Cron does not run for three days | Reminders for rentals that have already ended are suppressed; the overdue pass alerts instead. |

## Testing

**Unit, no database.** Every `isDueFor…` predicate at its boundary — one second
either side of the threshold, and across a Zurich DST change; token generation
and hashing; the weekly charge schedule across a month boundary; extension
arithmetic.

**Integration, against Postgres.** The whole daily run twice over, asserting
exactly one notification per rental; a token consumed once and refused twice;
an extension that moves `endAt`, adds charges and leaves earlier ones alone; a
rental ending in 36 hours reminded and one ending in 90 hours not; a mail
failure retried and then succeeding.

**Manual, once.** A real reminder to a real inbox, its link followed, an
extension taken, and the office copy checked.

## Out of scope

- The return wizard itself. Phase 4.
- Automatic card charging. TWINT is a push payment; the pay-link model is
  deliberate.
- SMS and WhatsApp notifications. Email only.
- Any admin UI. Marking a charge paid is a SQL statement until Phase 5.
- Webhooks. There is no provider to receive them from yet; the reconciliation
  pass that repairs missed webhooks ports in Phase 5 with the real provider.

## Open questions

1. **The 24–48 hour window.** Confirm it satisfies "24 hours before", or fund
   an hourly cron.
2. **Extension pricing.** Does an extension use the same weekly rate, or may
   the office quote a different one? Assumed the same rate.
3. **How many weeks may a renter add unilaterally?** Assumed a maximum of four
   before the office has to intervene.
4. **Does the SumUp link offer TWINT?** Still open from the roadmap. Decides
   whether the payment path is real or manual.
5. **Backfilling charges for rentals created under Phase 2.** A script is
   provided and deliberately not run automatically.
