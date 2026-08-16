# Persistence foundation (Phase 2)

**Date:** 2026-08-16
**Status:** Draft for review
**Companion to:** `2026-08-16-rental-platform-roadmap.md`
**Scope:** Phase 2 only. The pre-end reminder, the extension flow, the return
wizard, the admin dashboard and telematics are out of scope and belong to
Phases 3–6.

## Problem

Everything the client asked for reads from a rentals table that does not exist.
Phase 2 creates it, and connects it to the one tool the office already uses.

The pickup wizard captures who the renter is, which car they took, its mileage,
fuel level and condition, their ID and licence images, and a signature under
accepted terms. It captures **no rental period and no price** — see
`lib/rental/schema.ts`, which has no start date, end date, duration, amount or
deposit. So even with a database, there would be nothing for a reminder to fire
against. Both gaps close here.

## Decisions

1. **Postgres via Prisma, in this repo.** The schema is the old project's
   (`D:\Personal\zuriauto\backend\prisma\schema.prisma`) extended for
   fixed-term rentals and for what the wizard already captures. Neon in
   production, EU region; `docker-compose.yml` from the old repo for local
   development.

2. **Images go to object storage, never to Postgres.** Identity documents,
   licences, the portrait, the signature and condition photos are written to R2
   or Vercel Blob under opaque keys; the database stores the key, content type
   and byte count.

3. **The submit shape does not change.** The browser continues to compress
   images and post them to the route handler, which builds the PDF and now also
   uploads assets and writes records. Presigned direct-to-storage upload would
   remove the ~4.5 MB body cap and the existing retry-at-lower-quality
   workaround, but the current compression already fits under the cap and the
   handler needs the bytes to build the PDF regardless. Deferred until the cap
   actually bites.

4. **The database write must not be able to lose a contract to a mail failure.**
   Records are committed first, mail is sent after, and a send failure is
   recorded on the contract rather than rolled back. The office keeps the PDF
   download fallback introduced in Phase 1, and `MAIL_ARCHIVE` keeps running.

   This inverts the Phase 1 failure mode, where a mail failure meant the
   contract existed nowhere. Here it means the contract exists and the email is
   retried.

5. **Contract numbers come from a database sequence.** This replaces
   `buildContractNumber`'s date-plus-plate-plus-random-suffix, which its own
   comment describes as a stopgap awaiting "a real sequence backed by the
   rentals table". Format stays `ZA-YYYYMMDD-NNNN` so numbers already issued
   remain recognisable.

6. **Rate limiting moves to the database.** The in-memory `Map` in the route
   handler resets on every cold start and is not shared between instances,
   which the code says outright. A table of recent submissions keyed by IP
   replaces it.

7. **`lib/rental/fleet.ts` becomes the seed for the `Car` table, and stays.**
   Ownership splits: the file stays the source of truth for a car's *identity*
   — model, plate, chassis number — because a list of legal identifiers printed
   on a signed document belongs in code review, not in a database row a
   mistyped update can corrupt. The database owns a car's *status*, so a
   vehicle can be taken out of service without a deploy.

   A seed script reconciles identity from file to table on deploy and never
   touches status. The picker reads the table.

8. **`Customer` is deduplicated by email, case-insensitively.** A returning
   renter gets the same customer record and therefore a rental history. Names
   and addresses are updated from the newest contract; the contract PDF retains
   what was signed.

## Schema

```prisma
enum CarStatus       { available rented maintenance retired }
enum RentalType      { WEEKLY FIXED_TERM }
enum RentalStatus    { ACTIVE EXTENSION_REQUESTED RETURN_SUBMITTED COMPLETED CANCELLED }
enum ContractKind    { PICKUP RETURN_ADDENDUM }
enum FuelLevel       { empty quarter half three_quarter full }
enum AssetKind       { PORTRAIT ID_FRONT ID_BACK LICENCE_FRONT LICENCE_BACK
                       CONDITION_PHOTO SIGNATURE DAMAGE_PHOTO }

model Car {
  id                 String    @id @default(cuid())
  model              String
  plate              String    @unique
  vin                String?
  status             CarStatus @default(available)
  telematicsDeviceId String?                        // reserved for Phase 6
  rentals            Rental[]
}

model Customer {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String
  email       String   @unique                      // stored lowercased
  phone       String
  birthDate   DateTime @db.Date
  street      String
  postalCode  String
  city        String
  country     String
  createdAt   DateTime @default(now())
  rentals     Rental[]
}

model Rental {
  id                String       @id @default(cuid())
  carId             String
  customerId        String
  type              RentalType
  status            RentalStatus @default(ACTIVE)
  startAt           DateTime
  endAt             DateTime                        // derived for WEEKLY
  currency          String       @default("chf")
  depositCents      Int          @default(0)
  weeklyAmountCents Int?                            // WEEKLY only
  totalWeeks        Int?                            // WEEKLY only
  billingWeekday    Int?                            // WEEKLY only
  totalAmountCents  Int?                            // FIXED_TERM only
  createdAt         DateTime     @default(now())

  car        Car        @relation(fields: [carId], references: [id])
  customer   Customer   @relation(fields: [customerId], references: [id])
  contracts  Contract[]
  events     RentalEvent[]

  @@index([status, endAt])                          // Phase 3 reminder pass
  @@index([carId, startAt, endAt])                  // radar ticket lookup
}

model Contract {
  id             String       @id @default(cuid())
  rentalId       String
  contractNumber String       @unique
  kind           ContractKind
  mileageKm      Int
  fuelLevel      FuelLevel
  damageNotes    String       @default("")
  gtcVersion     String
  gtcLanguage    String
  acceptedAt     DateTime
  place          String       @default("")
  signedAt       DateTime     @default(now())
  pdfKey         String?
  mailSentAt     DateTime?
  mailError      String?
  rental         Rental       @relation(fields: [rentalId], references: [id])
  assets         Asset[]
}

model Asset {
  id          String    @id @default(cuid())
  contractId  String
  kind        AssetKind
  storageKey  String    @unique
  contentType String
  bytes       Int
  createdAt   DateTime  @default(now())
  contract    Contract  @relation(fields: [contractId], references: [id])
}

model RentalEvent {
  id        String   @id @default(cuid())
  rentalId  String
  type      String
  payload   Json?
  createdAt DateTime @default(now())
  rental    Rental   @relation(fields: [rentalId], references: [id])

  @@index([rentalId, createdAt])
}

model SubmissionAttempt {
  id        String   @id @default(cuid())
  ipHash    String
  createdAt DateTime @default(now())

  @@index([ipHash, createdAt])
}
```

`Charge`, `Notification` and `ActionToken` arrive in Phase 3 — no purpose
exists for them until something is scheduled.

`FuelLevel` is renamed, not redefined. `FUEL_LEVELS` in `lib/rental/fleet.ts`
is `["empty", "1/4", "1/2", "3/4", "full"]`, and a Prisma enum cannot contain a
slash. The mapping is one function in `lib/rental/fleet.ts`, alongside the
existing `fuelLevelToFraction`, so the contract keeps printing fractions and
only the storage representation differs.

`endAt` is written, not computed on read, so the Phase 3 reminder query is a
plain indexed range scan. For a `WEEKLY` rental it is
`startAt + totalWeeks × 7 days`; recomputing it is the job of whatever changes
`totalWeeks`, which in Phase 3 is the extension flow.

## The wizard's new step

A rental-terms step is added between vehicle selection and the documents step:

- **Type** — weekly or fixed term.
- **Start** — defaults to now, editable.
- **Duration** — number of weeks (weekly), or an end date and time (fixed term).
- **Amount** — weekly amount in CHF (weekly), or total (fixed term).
- **Deposit** — CHF, may be zero.

Validation extends `contractDetailsSchema` in `lib/rental/schema.ts`, which
already runs both in the browser and again in the route handler. The two rental
types are a discriminated union so an impossible combination — a fixed-term
rental with a weekly amount — cannot validate.

The PDF template gains a terms block. Everything else about the wizard is
untouched, as the Phase 1 spec anticipated.

## Request flow

1. Browser validates, compresses images, builds the PDF, posts it with metadata.
2. Handler validates again, checks the honeypot, checks the origin, checks the
   size cap, and checks the rate limit against `SubmissionAttempt`.
3. Assets upload to object storage. A failure here aborts before any database
   write; orphaned objects are acceptable and swept later.
4. One transaction: upsert `Customer` by lowercased email, resolve `Car` by id,
   allocate a contract number from the sequence, create `Rental`, create
   `Contract`, create `Asset` rows, set `Car.status = rented`, write a
   `RentalEvent` of type `pickup.completed`.
5. Mail is sent outside the transaction. Success stamps `mailSentAt`; failure
   records `mailError` and returns a partial success the wizard already knows
   how to present — the PDF download fallback.

## Error handling

| Failure | Behaviour |
|---|---|
| Storage upload fails | Abort before any write; wizard offers retry and PDF download |
| Database unreachable | Abort; wizard falls back to the Phase 1 path — download the PDF and mail manually |
| Mail fails | Records committed, `mailError` set, PDF download offered, retried in Phase 3 |
| Car already rented | Rejected with a clear message; the office resolves it |
| Duplicate contract number | Impossible by construction — sequence plus unique constraint |

## Testing

Vitest is new to this repo and arrives here.

**Unit, no database:** the extended schema's discriminated union and its
rejection of impossible combinations; `endAt` derivation for weekly rentals
across month and year boundaries and a DST change; contract number formatting;
email normalisation.

**Integration, against the docker-compose Postgres:** customer deduplication by
email including case and whitespace variation; the transaction rolls back
completely when any step fails; the rate limiter counts across simulated cold
starts, which the in-memory version could not; the radar-ticket query returns
the right driver for a timestamp inside a rental, and nobody for one in the gap
between rentals.

**Manual, once:** a real submission end to end, confirming the PDF that arrives
is byte-identical in content to the Phase 1 output.

## Done when

- A submitted pickup contract produces `Customer`, `Rental`, `Contract` and
  `Asset` rows, and the email arrives exactly as it does today.
- Restarting the server does not reset the rate limiter.
- Given a plate and a timestamp, one SQL query names the driver.
- The car picker reads from the database, and taking a car out of service needs
  no deploy.
- Neon and the object store are both in an EU or Swiss region, and `/privacy`
  describes what is now retained and for how long.

## Open questions

1. Retention period for identity documents, and who signs it off.
2. Whether `Car.status` should flip to `rented` on pickup, or whether
   availability is better derived from active rentals. Deriving is more
   truthful but slower to query; the old schema stored it.
3. Whether historic contracts sitting in `MAIL_ARCHIVE` should be backfilled.
   Recommended: no. They lack rental terms, and inventing them would put
   fiction in the system of record.
