# What is kept, where, and for how long

**Status:** retention periods are NOT yet signed off. See "Retention" below.
**Applies from:** Phase 2 (persistence), 2026-08-18.

Phase 2 changed the obligation. Until now, identity documents were emailed and
no server-side copy was kept — the route handler documented that deliberately.
They are now stored, which brings this under the revised Swiss DSG and, for EU
tourists, under the GDPR.

## What is stored

| Data | Where | Why |
|---|---|---|
| Name, address, birth date, phone, email | Postgres (Neon, EU) | Party to a signed contract |
| ID / passport photographs, front and back | R2 (EU jurisdiction) | Identity verification at handover |
| Driving licence photographs, front and back | R2 (EU jurisdiction) | Legal requirement to verify entitlement to drive |
| Portrait photograph | R2 (EU jurisdiction) | Matching the person to the document |
| Signature image | R2 (EU jurisdiction) | Evidence of acceptance |
| Vehicle condition photographs | R2 (EU jurisdiction) | Condition at handover, compared on return |
| Contract PDF | R2 (EU jurisdiction) | The document itself |
| Hashed client IP | Postgres | Abuse limiting; row deleted after 10 minutes |

Raw IP addresses are never written — `lib/rental/rateLimit.ts` stores a salted
SHA-256 so the limiter does not itself become a store of personal data.
Payment card details are never handled: payment is a hosted link.

Object keys are deliberately meaningless (`pickup/<uuid>/ID_FRONT-<random>.jpg`)
so that a key appearing in a log, a storage console or a support ticket does
not reveal whose document it is. See `lib/storage/keys.ts`.

## Retention

**OPEN — requires the owner's sign-off. Do not deploy to production without a
number here.** This is open question 1 in both the persistence spec and the
roadmap. Recommended starting position, to be confirmed:

- **Identity and licence images: 90 days after the rental ends.** They serve
  verification at handover and any dispute that follows immediately; they are
  not needed for the ten-year retention that applies to the contract itself.
- **Contract PDF and rental records: 10 years**, matching the Swiss commercial
  record-keeping obligation under OR 958f.
- **Condition photographs: 2 years**, long enough for a damage claim.

No deletion job exists yet. It belongs with the Phase 3 scheduler, which is the
first thing in this system that runs on a timer. Until then deletion is manual
and the retention clock is documented rather than enforced. **That is precisely
why the period has to be agreed now rather than after the first hundred
contracts.**

## Region

Both stores must be in the EU or Switzerland. Neither is verifiable from the
code, so both are checked at deploy time and recorded here:

- [ ] **Neon project region** — must be an EU region (`eu-central-1`, Frankfurt,
  is the usual choice). A project created in a US region cannot be moved and
  must be recreated *before* any production data exists.
- [ ] **R2 bucket jurisdiction** — create with
  `wrangler r2 bucket create zuriauto-assets --jurisdiction eu`, and verify with
  `wrangler r2 bucket list`.

If either is wrong, fix it **before** the first production submission. After
that it is a data migration with a notification obligation attached.

## Deletion on request

A renter may ask for their data. Until the Phase 5 dashboard exists this is a
manual procedure:

1. Find the customer: `SELECT * FROM "Customer" WHERE email = '...';`
2. Find their assets: join `Rental` → `Contract` → `Asset` and collect
   `storageKey`.
3. Delete those objects from R2.
4. Redact the `Customer` row.

The contract itself is **not** deleted. A signed rental agreement is a
commercial record with its own retention obligation, which overrides an erasure
request for its duration. Say so plainly when answering the request.

## What has not changed

`MAIL_ARCHIVE` keeps running in parallel through Phase 2. It is still the only
*proven* durable record of a signed contract, and it should not be switched off
until the database has demonstrably replaced it in production.
