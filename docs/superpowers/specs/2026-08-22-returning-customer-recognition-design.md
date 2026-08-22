# Returning-customer recognition

**Date:** 2026-08-22
**Status:** Draft for review
**Builds on:** `2026-08-16-rental-persistence-design.md` (Phase 2, shipped)
**Scope:** Finding an existing renter by phone number at the pickup desk,
prefilling their details, and carrying their identity documents forward from
their last rental. Also settles the retention periods that Phase 2 left open.

## Problem

A repeat renter is retyped from scratch. Ten fields of personal data and five
document photographs, all of which the system already holds — Phase 2's
`upsertCustomer` has been deduplicating on `[organisationId, email]` since the
first contract, so the fourth rental by the same driver is already one
`Customer` row with a history hanging off it.

Nothing reads it back. The identity exists; the path from a person standing at
the desk to the record describing them does not.

Retyping is not merely slow. It is where a street name acquires a typo on a
document the renter then signs, and where a birth date arrives a year out. The
record is authoritative for radar-fine attribution; a hand-copied version of it
is a second, worse copy.

Three things have to be decided rather than written. What identifies a person
when neither of their identifiers is reliable. How a client that has just been
told "this person exists" proves it when it comes back to claim their
documents. And whether identity evidence photographed months ago can stand
behind a contract signed today.

## Decisions

1. **The lookup key is a normalised phone number, indexed and deliberately not
   unique.**

   A new nullable `Customer.phoneKey`, E.164, written by `normalisePhone()`:
   separators stripped, `00` → `+`, a bare leading `0` read as Swiss and
   rewritten `+41…`, an existing `+` passed through untouched.

   Not unique, for two independent reasons. A couple renting on one mobile is
   one number belonging to two people, and a design where that is impossible is
   a design that meets it eventually. And a `UNIQUE` migration is a migration
   that can fail on data already in the table. So a lookup returns *up to five*
   matches and the staff member picks the right one.

   Email remains the deduplication key for `upsertCustomer`. That constraint is
   untouched: phone answers "who is this", email answers "is this the same
   person as last time", and conflating them would mean rewriting the one thing
   in Phase 2 that has been correct since the first contract.

   Chosen over `libphonenumber-js`: 150 KB of parser to serve an office typing
   Swiss numbers and the occasional German one, where a miss degrades to typing
   the details by hand. If foreign numbers become common, that is the upgrade.

   **The normaliser's output must stay stable for the life of the column.**
   Changing the rules later leaves every backfilled key silently unmatchable —
   no error, just a returning customer who is never found again. This is why the
   backfill runs the real function through a script rather than reimplementing it
   as SQL regex, and why the function carries a comment saying so.

2. **A successful lookup returns a signed, expiring token naming the contract
   whose documents may be reused. The client never sends a contract id.**

   An HMAC over `{contractId, exp}` keyed with `APPLY_SECRET`, valid 30 minutes,
   following the construction in `lib/rental/actionToken.ts`.

   This is the authorisation for the copy. Without it, the submit path would
   have to trust a client-supplied contract id and then prove the caller was
   entitled to it — and the obvious check, matching the submitted email against
   the stored one, refuses the reuse precisely when a returning customer has
   changed their email, which is a normal thing to have done.

   **Deliberately not an `ActionToken` row**, and the difference from decision 1
   of the lifecycle design is the point. `ActionToken` is mailed to a customer,
   must be single-use, and must be revocable — properties that need a row.
   This token lives for half an hour inside one staff session, authorises
   nothing the holder has not already legitimately read, and needs no
   revocation. A row would add a write and a cleanup obligation to buy nothing.

3. **Documents are copied, never shared.**

   `persistPickup` gains an optional source contract. Before its transaction it
   asks the object store to copy each source object into the new submission's
   prefix, then inserts `Asset` rows pointing at the *new* contract.

   Chosen over making `Asset.contractId` nullable and hanging assets off the
   customer, which is the obvious way to "reuse" a file and the wrong one. It
   would turn a per-contract deletion sweep into reference counting, and the
   retention rules below into a question about who else still points at a file.
   Copying keeps the invariant that every contract owns its own set on its own
   clock, and the storage cost is a few hundred kilobytes per rental.

   The copy is server-side (`CopyObjectCommand`); the bytes never travel through
   a function. Every column of the new row — `kind`, `contentType`, `bytes` —
   comes from the source `Asset` row, so nothing has to be re-inspected in R2.

4. **The identity images never reach the browser. The PDF carries a reference
   page instead.**

   `buildContractPdf` is where this bites: it currently takes the five document
   images as mandatory `Uint8Array`s and emits a page each. They become
   optional, and a new `documentsOnFile` input produces one page in their place,
   naming the source contract, its date, and the attestation from decision 5.

   Chosen over presigned R2 URLs the browser downloads and re-embeds, which
   would leave `buildContractPdf` and `persistPickup` untouched and produce a
   signed document identical to a first-time contract. Rejected because it moves
   passport scans R2 → browser → function → R2 on every repeat pickup, adds a
   PII read surface, and pushes the request back toward Vercel's 4.4 MB body
   cap that the current payload already approaches.

   **Guard:** neither images nor `documentsOnFile` must throw. A contract with
   no identity evidence at all has to be unbuildable, not merely discouraged.

5. **Reuse requires the staff member to attest they saw the originals.**

   A required tick on the reuse path only — `I have seen the original ID and
   driving licence today and they are valid` — stored as
   `Contract.identityCheckedAt` and printed on the reference page.

   This is what distinguishes attaching a scan from February from verifying a
   person in August. It is also the licence-expiry safeguard: the reason to look
   at the physical licence is that the stored photograph cannot expire and the
   document can. Not asked on a first rental, where the fresh photograph is
   itself the evidence that someone looked.

6. **Reuse is all-or-nothing, and only from the most recent pickup.**

   Offered only when all five of `PORTRAIT`, `ID_FRONT`, `ID_BACK`,
   `LICENCE_FRONT`, `LICENCE_BACK` are present on the customer's latest `PICKUP`
   contract and it falls inside the retention window. A partial set is treated
   as none.

   Never reusable: `SIGNATURE`, which is signed today by definition, and
   `CONDITION_PHOTO`, which describes the car rather than the person.

   A half-populated document step — three slots filled, two empty, no
   explanation — is worse than an empty one.

7. **Retention: five years for everything about the person, ten for the
   contract PDF.**

   This settles open question 1 from the persistence spec, on the owner's
   instruction of 2026-08-22. It replaces the proposal of 90 days for identity
   images and two years for condition photographs; one clock is enforceable in
   a way that three are not, and the condition photographs are not the sensitive
   part. Ten years for the contract itself is OR 958f, which is a floor and not
   a preference.

   Two consequences to state plainly rather than discover:

   - **Passport and licence scans are now held for five years.** This is the
     highest-risk data in the system and the hardest part of it to justify under
     DSG proportionality. It was chosen with the trade-off named, and it is why
     `/privacy` saying so in plain language is a release blocker rather than a
     follow-up.
   - **Because reuse copies, a loyal customer's documents live five years past
     their *last* rental, not their first.** Each contract restarts the clock on
     a fresh copy. That is the correct behaviour for a per-contract sweep, but
     it means the effective retention for a regular renter is longer than the
     stated period suggests, and the privacy page should not imply otherwise.

## Data model

```prisma
model Customer {
  // …
  /// E.164, written by normalisePhone(). Indexed for the desk lookup, and
  /// deliberately not unique: one mobile can belong to a couple.
  /// Nullable because the backfill script, not the migration, populates it.
  phoneKey String?

  @@index([organisationId, phoneKey])
}

model Contract {
  // …
  /// Set when identity documents were carried forward instead of photographed.
  documentsReusedFromId String?
  /// When the staff member confirmed they saw the originals. Required whenever
  /// documentsReusedFromId is set; null on a first rental, where the fresh
  /// photograph is the evidence.
  identityCheckedAt     DateTime?

  documentsReusedFrom Contract?  @relation("DocumentReuse", fields: [documentsReusedFromId], references: [id])
  documentsReusedBy   Contract[] @relation("DocumentReuse")
}

/// One row per desk lookup, so "who looked up whom" is answerable without the
/// audit log becoming a second copy of the customer list. The number is hashed
/// with RATE_LIMIT_SALT, as in lib/rental/rateLimit.ts.
model CustomerLookup {
  id        String   @id @default(cuid())
  phoneHash String
  matches   Int
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

`AssetStore` gains one method:

```ts
copy(fromKey: string, toKey: string, contentType: string): Promise<void>;
```

`CopyObjectCommand` for R2; read-and-write for `createMemoryStore`, which is
what the tests run against.

## Data flow

**Lookup** — `POST /api/customers/lookup`

POST rather than GET so the number never lands in a URL, an access log or a
referrer. Fenced with `APPLY_SECRET` and the same-origin check, and rate-limited
through the existing DB-backed limiter, so the endpoint cannot be walked to test
numbers against the customer list.

```
{ phone } → normalisePhone → Customer.findMany(phoneKey, take 5)
         → per match: prefill fields, rentalCount, firstRentalAt,
                      documentsOnFile? { contractNumber, signedAt, kinds },
                      reuseToken?
         → write CustomerLookup row
```

No image bytes. No `customerId` — nothing downstream needs it, so it is not
sent.

Zero matches is `200 { matches: [] }`. It is a query that succeeded and found
nothing, not a missing resource, and a 404 would make the staff member think
something broke.

**Submit** — the existing `POST /api/rental-contract/`

The wizard sends `reuseToken` in place of the five `asset:` document files,
alongside the attestation. The route verifies signature and expiry, extracts the
contract id, and passes it to `persistPickup`. An invalid or expired token is
`400`, not a silent fall back to capturing fresh — half an hour has passed and
the wizard should say so.

**A reuse token without the attestation is `400`.** The tick is a claim about
what a person did, and the whole reason it exists is to stand behind a contract
later; enforcing it only in the browser would make it advisory. This mirrors the
rule already stated in `lib/rental/schema.ts` — the schema runs on both sides so
that a crafted request cannot skip a check the form enforces. `gtcAccepted` is
`z.literal(true)` for the same reason, and `identityCheckedAt` is validated the
same way.

## Wizard

**Step 3 (renter)** opens with the mobile field and a *Check* button. Found:
fields populate and a banner reads `Returning customer — 3 rentals since March
2026`, with the documents-on-file line and an explicit *Use fresh photos
instead* escape. Not found: nothing happens and they type as they do now.

A button rather than firing on a complete-looking number, so a lookup is one
deliberate, auditable act instead of one per typo — and so half-typed numbers
do not walk the customer list.

Multiple matches render a small chooser keyed on name and birth date. This is
rare, and staff have the person in front of them.

**Step 4 (documents)** collapses the five identity slots into a summary card
plus the required attestation tick when reusing. Condition photographs are
untouched — always fresh.

## Error handling

| Case | Behaviour |
|---|---|
| Number does not normalise | No lookup, no error. The field is still a phone number for the contract. |
| Lookup endpoint unreachable | Banner: could not check. Form stays fully usable by hand. Never blocks a handover. |
| Reuse token expired | `400` on submit, wizard returns to the document step and asks for fresh photographs. |
| Source object missing from R2 | Copy fails before the transaction, so nothing is written. Surfaces as the existing `not-recorded` path, whose fallback is already download-and-mail-by-hand. |
| Partial document set on file | Reuse not offered. Fresh capture, silently. |

The rule throughout: a failure in this feature costs typing, never a handover.
None of it may become a reason a customer cannot be given a car.

## Testing

**Unit** — the normalisation table, including `079 123 45 67`, `+41 79 123 45
67`, `0041791234567` and a German mobile all reaching the expected key, and
unparseable input yielding null. Reuse token valid, expired and tampered.
`buildContractPdf` with `documentsOnFile` and no images; throwing with neither.

**DB** — lookup found, not found, multiple matches, unfenced `401`,
rate-limited `429`, and that a `CustomerLookup` row is written with the number
hashed rather than stored. `persistPickup` with a reuse token: five objects
copied to new keys, five rows on the new contract, source rows untouched,
`identityCheckedAt` and `documentsReusedFromId` set.

## Out of scope

- Deleting anything. No retention sweep exists yet; decision 7 sets the periods
  the future job will enforce, and until it ships deletion stays manual and
  documented. Naming the numbers now is the point — they cannot be applied
  retroactively to data already collected under no stated period.
- Reuse on the return wizard. Returns identify a rental, not a person.
- Merging two `Customer` rows discovered to be the same person. Needs the
  Phase 5 dashboard.
- Any change to `upsertCustomer`'s email deduplication.

## Follow-on work this obliges

1. `docs/DATA-RETENTION.md` rewritten to decision 7, replacing the open
   question with the agreed periods and both consequences.
2. `/privacy` rewritten: what is held, that it is in the EU, five years and ten,
   that documents carry forward across rentals, and how to request deletion.
   **Release blocker.** It is currently written for a system that stored
   nothing.
