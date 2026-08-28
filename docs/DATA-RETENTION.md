# What is kept, where, and for how long

**Status:** retention periods agreed by the owner on 2026-08-22. See
"Retention" below. No deletion job exists yet, so the clock is documented
rather than enforced.
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
| Lookup audit: salted hash of a phone number, match count | Postgres | Recording who was looked up at the desk, without the log becoming a second copy of the customer list |

Raw IP addresses are never written — `lib/rental/rateLimit.ts` stores a salted
SHA-256 so the limiter does not itself become a store of personal data.
Payment card details are never handled: payment is a hosted link.

Object keys are deliberately meaningless (`pickup/<uuid>/ID_FRONT-<random>.jpg`)
so that a key appearing in a log, a storage console or a support ticket does
not reveal whose document it is. See `lib/storage/keys.ts`.

When a returning customer's documents are carried forward, the objects are
**copied** server-side into the new contract's prefix rather than shared. Every
contract therefore owns its own set under its own key, and deletion stays a
per-contract sweep instead of reference counting. See
`lib/rental/reuseDocuments.ts`.

## Retention

**Agreed by the owner, 2026-08-22.** This closes open question 1 in both the
persistence spec and the roadmap.

- **Everything about the person: five years** after the rental ends. The
  `Customer` row, the identity and licence photographs, the portrait, the
  signature image and the condition photographs.
- **The contract PDF and the rental records: ten years**, matching the Swiss
  commercial record-keeping obligation under OR 958f. This is a floor, not a
  preference, and it overrides the five-year rule for these two.

This replaces the earlier proposal of 90 days for identity images and two years
for condition photographs. One clock is enforceable in a way that three are not,
and the condition photographs are not the sensitive part.

Two consequences, recorded because they are easy to discover late:

- **Passport and licence scans are held for five years.** This is the
  highest-risk data in the system, and "it saves typing at the desk" is a weak
  proportionality argument under the revised DSG. It was chosen deliberately,
  with the trade-off named, to make returning-customer document reuse possible.
  See `docs/superpowers/specs/2026-08-22-returning-customer-recognition-design.md`.
- **A regular customer's documents live five years past their _last_ rental,
  not their first.** Reuse copies rather than shares, so each new contract
  starts a fresh clock on its own copy. For someone who rents every summer the
  effective retention is indefinite. The privacy notice must not imply
  otherwise.

**Enforced since 29 August 2026.** `lib/admin/retention.ts` runs as the last
pass of the daily cron: it deletes the bytes of every person-asset whose rental
ended more than five years ago, and stamps `Asset.deletedAt`.

Three properties worth knowing, because they are the ones a reader will want to
check against this document:

- **The row outlives the object.** An `Asset` is the record that a passport
  *was* photographed and checked at that handover. The bytes go; the row, its
  kind and its recorded size stay, so the office can still show what was
  verified. The documents view lists a deleted asset as deleted rather than
  omitting it, because "checked, and since deleted" is a different answer from
  "never taken".
- **The object is deleted before the row is stamped.** The reverse order would
  let a crash between the two leave a row claiming deletion over a passport
  still sitting in the bucket — and nothing would revisit it, because the sweep
  skips stamped rows.
- **The ten-year records are untouched.** The sweep never reads
  `Contract.pdfKey`. Nothing is ten years old yet; when something is, it needs
  its own pass and a decision about what a contract PDF minus its images is
  worth.

## Region

Both stores must be in the EU or Switzerland. Neither is verifiable from the
code, so both are checked at deploy time and recorded here:

- [x] **Neon project region** — must be an EU region (`eu-central-1`, Frankfurt,
  is the usual choice). A project created in a US region cannot be moved and
  must be recreated *before* any production data exists.

  **Verified 22 August 2026.** The project host is
  `ep-snowy-heart-b2cj4kl9.c-6.eu-central-1.aws.neon.tech` — `eu-central-1`,
  Frankfurt. Running PostgreSQL 18.6, which is also the local version, so the
  database tests exercise the same major the production server runs. Both
  migrations are applied and the seed has written one organisation and the
  eight fleet vehicles, all `available`.
- [x] **R2 bucket jurisdiction** — create with
  `wrangler r2 bucket create zuriauto-assets --jurisdiction eu`, and verify with
  `wrangler r2 bucket list`. The dashboard can do it too: Create bucket →
  Location → Specify jurisdiction → European Union.

  **Verified 22 August 2026.** Bucket `zuriauto-assets`, jurisdiction European
  Union. The evidence is the bucket's own S3 endpoint, which reads
  `https://<account>.eu.r2.cloudflarestorage.com/zuriauto-assets` — a
  jurisdiction-pinned bucket answers only on that `.eu.` host, so the presence
  of the label *is* the verification. A bucket created without a jurisdiction
  would have no label and would have to be deleted and recreated, since the
  setting is fixed at creation.

  This is also why `lib/storage/r2.ts` builds the host from
  `R2_JURISDICTION` rather than the account's plain hostname — see
  `lib/storage/r2.test.ts`, which pins the default to `eu`.

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
