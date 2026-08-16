# Rental platform — roadmap and target architecture (Phases 2–6)

**Date:** 2026-08-16
**Status:** Draft for review
**Scope:** The decomposition, the cross-cutting decisions and the infrastructure
for everything after the pickup contract. Each phase gets its own design spec
and its own implementation plan; this document is the map they hang from.

Phase numbering continues `2026-08-10-rental-pickup-contract-design.md`, where
Phase 1 is the stateless pickup contract now in production.

## Problem

The client asked for four things: email the renter 24 hours before a rental
ends with a confirm-return or extend-and-pay choice; track cars via Flespi;
keep records of cars and renters; and an analytics dashboard.

None of them can be built today, for one shared reason. This site has no
database. `app/api/rental-contract/route.ts` builds a PDF and emails it, and
its own header says so — *"Stateless by design: nothing is written down in
Phase 1."* The fleet is a hardcoded array in `lib/rental/fleet.ts`. There is no
rentals table, so a reminder job would have nothing to read, a dashboard
nothing to chart, and a GPS position nothing to attach to.

A second constraint shapes the answer. A previous project at
`D:\Personal\zuriauto` already built most of the missing half: a NestJS backend
with Prisma, Postgres, Stripe with TWINT, Resend, JWT auth, a React owner
dashboard, and — most valuably — an idempotent daily scheduler with unit tests
(`backend/src/scheduler/passes.spec.ts`) and a reconciliation pass that repairs
missed webhooks. It reached `8ad5485 — v1 complete` and was never deployed.

The work is therefore mostly a merge, not a greenfield build.

## Decisions

1. **The old backend folds into this repo rather than deploying alongside it.**
   The Prisma schema, the scheduler pass logic, the Stripe module and the
   idempotency rules port across as Route Handlers and library modules. NestJS
   does not.

   Chosen over keeping two apps because one deploy, one domain, one auth story
   and one codebase is worth more than the head start a running NestJS service
   would give. Accepted cost: the in-process cron becomes a triggered handler,
   and the Vite dashboard screens are rebuilt as Next.js routes.

2. **Rentals come in two shapes on one table.** `WEEKLY` reproduces the old
   model — N weeks × a fixed weekly amount, one `Charge` per week — and serves
   the Uber and taxi drivers the old system was designed for. `FIXED_TERM`
   serves tourists: an explicit start and end, paid once.

   Both carry `endAt`, derived for weekly rentals and explicit for fixed-term,
   so the pre-end reminder is a single query rather than two code paths that
   can drift.

3. **The payment processor is deliberately undecided, and the design does not
   need it to be.** The requirement is TWINT, not a particular provider. A
   narrow interface — *create a payment request for an amount against a
   reference, return a hosted URL* and *learn that it was paid* — keeps the
   rental lifecycle ignorant of who processes the money.

   The existing static SumUp link (`lib/payment.ts`) is a valid degenerate
   implementation: no amount, no webhook, payment confirmed by hand in the
   admin screen. Stripe, the SumUp API, or a Swiss PSP such as Payrexx slot in
   later by adding one module.

   Open question for the office: does the existing SumUp link already offer
   TWINT? SumUp supports it in Switzerland. If it does, TWINT is available for
   zero integration work.

4. **A rental is created by the pickup wizard, not by an admin screen.**
   `RentalPickupWizard` gains a rental-terms step and the route handler writes
   records instead of only emailing. This keeps the first useful output close
   and reuses the tool the office already operates, at the cost of asking
   whoever runs the handover to enter commercial terms.

   This also settles the open question left in the Phase 1 spec — whether the
   office or the customer enters the mileage. The wizard is an
   office-and-customer-together tool at handover, so terms and mileage are
   entered there.

5. **Email stays on the existing SMTP mailbox.** No second mail provider. At a
   six-car fleet the volume does not justify Resend, and the current mailbox
   sends from a real address with no DNS work.

   Noted risk, carried over from the Phase 1 spec: SMTP from a serverless
   function is slower and less reliable than an HTTP mail API, and this class
   of setup has failed in production here once already. Mitigated by recording
   send failures and retrying them in a scheduler pass rather than by changing
   provider. Revisit if reminders start landing in spam.

6. **Idempotency lives in unique constraints, never in booleans.** Every
   repeatable action — a weekly charge, a pre-end reminder, an overdue alert —
   is a row whose uniqueness makes a double-send impossible. This is the rule
   the old `@@unique([rentalId, weekNumber])` already encodes, and it is why
   the client's proposed `reminderSent: boolean` is rejected in the Phase 3
   spec.

7. **Telematics is reserved, not built.** `Car.telematicsDeviceId` exists from
   Phase 2 so that adding Flespi later is additive. Nothing else is built
   against it until hardware is installed and the requirement is known.

## Phases

Each phase is independently useful and leaves the system in a shippable state.

### Phase 2 — Persistence foundation

Postgres, Prisma, object storage, and the pickup wizard writing records.
Detailed in `2026-08-16-rental-persistence-design.md`.

Pays off two TODOs already written into the code: the contract number becomes a
real sequence instead of date-plus-random-suffix, and rate limiting stops being
an in-memory `Map` that resets on every cold start.

**Standalone value:** the radar-ticket lookup — *who was driving `ZH 589 864` at
14:30 on the 10th* — works at the end of this phase. It is one index and one
query, not a subsystem.

### Phase 3 — Lifecycle automation

The client's headline ask. A scheduler pass sends the reminder 24 hours before
`endAt`; signed single-use links lead to `/rental/manage`; the renter confirms
return or extends and pays; the office is notified. Weekly charges and overdue
alerts port from the old `passes.ts`.

### Phase 4 — Return wizard

The mirror of the pickup contract, and the thing "confirm return tomorrow"
actually leads to. Mileage, fuel, damage photos, self-reported fines, deposit
settlement and a signature, producing a return addendum PDF and freeing the
car. The Phase 1 condition baseline exists precisely so this comparison is
possible.

### Phase 5 — Admin dashboard and analytics

Single-owner password and JWT auth, ported from the old repo. Fleet, rentals,
renters, rental detail, the ticket lookup, and an overview of utilisation,
revenue, outstanding deposits and overdue rentals. The old repo's five screens
are the design reference. Analytics reads `RentalEvent` and `Charge`, both of
which Phases 2–4 populate.

### Phase 6 — Flespi telematics

Deferred. Documented integration shape only: Flespi pushes to a webhook handler
which writes positions keyed by `Car.telematicsDeviceId`, with polling as a
fallback. Scope to be set once trackers are installed.

## Infrastructure

New services, all on free tiers:

| Item | Phase | Purpose | Cost |
|---|---|---|---|
| Neon Postgres, EU region | 2 | System of record | CHF 0 |
| Cloudflare R2 or Vercel Blob | 2 | ID, licence, signature and damage images | CHF 0 |
| Cron trigger | 3 | Runs the scheduler passes | CHF 0 |
| Vitest | 2 | Test runner; the repo has none | — |
| Flespi + trackers | 6 | Telematics | ~CHF 2–5/device/mo + hardware |

Unchanged: Vercel hosting, the SMTP mailbox, the `zuriauto.ch` domain, the
SumUp link.

Local development reuses `docker-compose.yml` from the old repo verbatim —
Postgres 16 on port 5433.

**Cron trigger choice is deferred and reversible.** Vercel Cron needs a paid
plan for sub-daily schedules; the free tier is limited to roughly daily, which
is adequate for a 24-hour-ahead notice. If a tighter window is wanted, a free
external pinger (GitHub Actions, cron-job.org, Upstash QStash) calls the same
bearer-protected route. Because the passes are pure functions behind one
handler, switching costs minutes.

## Data protection

Storing ID scans, driving licences and personal photos is a materially
different obligation from today's arrangement, where they are emailed and no
server-side copy is kept — a property the current route handler is careful to
document.

Under the revised Swiss DSG, and under GDPR for EU tourists, Phase 2 must
settle: the database and object store both pinned to an EU or Swiss region; a
written retention period for identity documents; a deletion path; and an
updated `/privacy` page. These are decisions rather than infrastructure, but
retrofitting them is far more expensive than setting them in Phase 2.

`MAIL_ARCHIVE` keeps running in parallel through Phase 2. It is currently the
only durable record of a signed contract, and it should not be switched off
until the database has demonstrably replaced it.

## Out of scope

- Customer accounts or a self-service portal. Renters reach the system only
  through tokenised links.
- Staff roles and permissions. Single owner, as in the old system.
- Automatic card charging or stored payment credentials. TWINT is a push
  payment; the pay-link model is deliberate.
- Booking and availability calendar. `/book` continues to hand off over
  WhatsApp until Phase 5 at the earliest.
- SMS and WhatsApp notifications. Email only.

## Open questions

1. Does the existing SumUp link already offer TWINT? Determines whether Phase 3
   ships with a working payment path or a manual one.
2. Retention period for identity documents, and who approves it.
3. Vercel plan tier, which decides the cron trigger.
4. Deposit handling — currently recorded on the contract but not collected
   through the system. Phase 4 settles whether it stays informational.
