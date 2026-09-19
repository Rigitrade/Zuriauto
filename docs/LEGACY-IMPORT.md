# Importing the pre-backend contracts

Between 17.08.2026 and 13.09.2026 the office ran the pickup and return wizards
against a build that produced a signed PDF and mailed it, but wrote no database
rows. Thirteen PDFs are the only record of what happened in those four weeks:
eleven handovers and two returns.

`scripts/import-legacy-contracts.ts` loads them. This document explains what it
does and why; it deliberately contains no renter's name, address or telephone
number, so that it can live in the repository.

## Running it

```bash
pnpm db:import-legacy              # dry run — prints the plan, writes nothing
pnpm db:import-legacy --apply      # writes
```

It needs `DATABASE_URL`, taken from `.env.local` or from the environment, and
it prints the host it is about to write to before it starts. Run `pnpm db:seed`
first: the organisation and the cars have to exist, and the import creates
neither.

It is idempotent on `Contract.contractNumber`. The numbers come off the PDFs
rather than from `allocateContractNumber`, so they are stable, and a re-run
after a half-finished attempt completes it instead of duplicating it. An entry
whose contract number is already present is **skipped whole and never
updated** — by then the office may have corrected the row, and a re-run of an
import must not undo that.

## The data file

`scripts/legacy-contracts.json`, which is **gitignored**.

It holds seven real renters' names, birth dates, addresses, telephone numbers
and email addresses. Committing it would put that in the git history
permanently: readable by everyone with repository access, copied into every
clone, and impossible to remove if one of those seven ever asks to be erased —
which the nFADP entitles them to, and which `docs/DATA-RETENTION.md` is
otherwise careful about. The database is where this data belongs.

The importer therefore *reads and validates* the file at run time rather than
importing it as a module. A TypeScript `import` of a gitignored file would
break `tsc --noEmit` on a clean clone, since `tsconfig.json` includes
`**/*.ts`. Validation is by zod, so a hand-edit that mistypes a fuel level or
drops an email stops the run with a readable error instead of reaching Postgres
as a constraint violation halfway through.

Keep the file with the signed PDFs it was transcribed from. If it is lost, the
import has already run and the database is the record.

Its shape:

| Key | What it holds |
| --- | --- |
| `customers` | One entry per renter, keyed by email — what `Customer` is unique on per organisation. |
| `pickups` | One per `ZA-*` PDF: car slug, renter email, signing and acceptance times, mileage, fuel, damage note, GTC version and language. |
| `returns` | One per `ZR-*` PDF, naming the pickup it closes — or carrying a `stub` where no pickup exists. |
| `excluded` | PDFs deliberately not imported, with the reason. |

Every entry also carries a `notes` array. Those are printed as warnings on each
run, so the problems below stay visible instead of being discovered later.

## What the import writes

**Rentals, as COMPLETED history.** The PDFs record a handover — car, renter,
mileage, fuel, signature — and nothing at all about the term or the money: no
start date, no end date, no weekly rate, no deposit. Three consequences follow:

- `type` is `FIXED_TERM`, which the schema defines as "explicit `endAt`".
  `WEEKLY` would imply a `weeklyAmountCents`, `totalWeeks` and `billingWeekday`
  that no document states.
- No `Charge` rows. `generateWeeklyCharges` needs an amount and a term;
  inventing either would put fabricated money in front of a customer.
- `Car.status` is left exactly as it is. It is owned by the office — the same
  rule `prisma/seed.ts` follows — and a completed rental has no claim on it.

`endAt` is the return's signing time where a return closes the rental, and
otherwise equals `startAt`. Nothing in the documents supports anything else.

**COMPLETED is also what keeps the daily pass quiet.** `runDailyPasses` mails
every ACTIVE rental whose `endAt` has passed (`lib/rental/scheduler.ts:435`)
and chases charges on any rental that is not COMPLETED or CANCELLED. Importing
four-week-old rentals as ACTIVE would send overdue notices to six real
customers on the next cron run. This is the single most important reason not to
loosen the status.

**Contracts, verbatim.** Mileage, fuel and damage notes are what the customer
signed, including where that is visibly wrong. `damageNotes` is empty where the
PDF prints the generator's placeholder for an empty field
(`lib/rental/labels.ts:388`, `:775`), because that string is the *absence* of a
note rather than a note saying there was no damage.

**`createdBy: "import:legacy-pdf"`**, not `"office"` as every row written by
the live wizard says. These were reconstructed from a PDF a month later, and a
dispute reaching back into one of these rows should be able to see that
immediately.

**A `RentalEvent` per row**, recording the source PDF and the notes, so the
provenance travels with the rental rather than living only in a file.

One transaction per contract, not one for the whole run: a failure on the
eighth should leave the first seven standing, and the re-run skips them.

## What it does not write

**No `Asset` rows, and no `pdfKey`.** The identity photographs are embedded in
the PDFs but were never uploaded to the object store, so there is nothing for a
row to point at. Two consequences, both real:

- These contracts render in the dashboard, but their PDF link does not work.
- The retention sweep only knows about `Asset` rows, so these renters' ID and
  licence images live on inside PDFs that sit outside the policy in
  `docs/DATA-RETENTION.md`. **Whoever holds those PDFs is holding the most
  sensitive data in the system with none of the automatic expiry the rest of it
  gets.**

## Corrections, and where they are not applied

The customer record is corrected; the contract is not. This is the split
`upsertCustomer` already makes — it refreshes a renter's details from each new
contract while the signed PDF keeps whatever was signed. The customer row is
where the next letter goes, not a historical record.

Corrected on the customer:

- **Swapped names.** Five contracts have the given and family names in the
  wrong boxes. The signature line prints `${firstName} ${lastName}`
  (`lib/rental/contractPdf.ts:509`), so the PDFs print them reversed — which is
  how the mistake is provable rather than assumed. One renter's own return
  protocol, filled in separately, has them the right way round.
- **One address spelled two ways** across two contracts, where the later
  version carries an impossible six-digit French postcode. The earlier,
  coherent version is used — mixing a valid postcode from one document with a
  city spelling from another would produce an address that appears on neither.
- **One telephone number missing its country code.** `normalisePhone` refuses
  it, correctly: nothing in the string says which country. Stored verbatim, that
  renter would be permanently invisible to the desk lookup, so the country code
  is added.

Not corrected, and left as signed:

- **A mileage reading of 18'000 km** on a car that read 177'400 km eight days
  earlier and 181'500 km six days later.
- **A mileage reading of 66'000 km** on a car that reads 257'000 and 258'000 km
  nine days later.

Both are on documents a customer signed. The office should amend them
deliberately, in the dashboard, rather than have an import quietly improve the
evidence.

## Known problems in the source data

These survive the import and need a human.

**A double handover.** Two pickup contracts hand the *same car* to two
different renters six minutes apart on the evening of 08.09.2026. Both cannot
be right. One renter had returned another car twenty minutes earlier and
plainly took something, so the likely error is the vehicle chosen in the
picker — but that is a guess. Both are imported as signed.

**A return that does not match its pickup on mileage.** One return protocol
states a pickup reading that appears on none of the three candidate pickups for
that car. It is matched by car and chronology instead — same car, same renter,
no other open rental — and one of the two figures is mistyped.

**An orphan return.** One return protocol arrived with no pickup contract for
its car. Its rental is created as a **stub**: a `Rental` with a
`RETURN_ADDENDUM` and **no `PICKUP` contract at all**, because inventing a
signed document is worse than showing a gap. This is safe — every consumer of a
pickup contract handles its absence (`app/api/admin/overview/route.ts:247`,
`app/api/admin/cars/[id]/history/route.ts:100`, `lib/rental/lookup.ts:60`,
`lib/rental/scheduler.ts:100` all use `?.` or `.find()`). Its `startAt` equals
the return moment, i.e. a zero-length rental, because no supplied document says
when it began.

That renter is also **incomplete and needs the office**: a return protocol
prints only a name and an email. `Customer.birthDate` is not nullable, so it
holds the sentinel `1900-01-01` — visibly not a birthday, where a plausible
invented date would be indistinguishable from a real one forever. The address
and phone are empty, so this renter cannot be found by the desk phone lookup
until somebody fills them in.

They also carry an **open debt of CHF 370.00**, recorded on the contract as a
claim and not as a `Charge` — exactly as `persistReturn` does, so nobody is
chased over a number a customer typed and nobody reviewed.

**One PDF is not imported at all**: a test submission, identifiable by a
six-figure mileage on a car that read far less days earlier, a nonsense street,
a foreign mobile on a Zurich rental, and the office's own email address.

## Why this is not in `prisma/seed.ts`

The seed reconciles *identity that lives in code* — the organisation, the fleet
from `lib/rental/fleet.ts`, the first owner account. It is meant to be run
against any database, at any time, including a fresh one, and to converge on
what the code already knows.

This import is the opposite: a one-time migration of *customer data* that
exists in no code and can never be regenerated. Folding it into the seed would
mean every developer's local database, every preview branch and every CI run
gets seven real renters' personal data — and it would put that data in the
repository, which is the thing the gitignore above exists to prevent.

They are separate for the same reason `scripts/backfill-charges.ts` and
`scripts/backfill-phone-keys.ts` are.
