# Turning the backend on in production

Production has run the marketing site alone since it was first deployed. `main`
contains no `app/api/admin`, no `prisma/migrations` and no scheduler — the
whole system lives on `integrate/backend-plus-return`, ninety-seven commits
ahead of it. Merging that branch is therefore not a deploy, it is a go-live:
`zuriauto.ch` starts writing to a database, generating contracts, and emailing
real customers in one step.

This is the order to do it in, and the reason for each step.

## The one thing that must not be skipped

**The daily cron is switched off for the first 48 hours**, by an empty `crons`
array in `vercel.json`. JSON has no comments, so this file is the only record
of it.

```jsonc
"crons": []                       // ← restore before 21.09.2026
```

Restore it with:

```json
"crons": [{ "path": "/api/cron/daily/", "schedule": "0 7 * * *" }]
```

Why it is off: `/api/cron/daily/` runs at 07:00 Europe/Zurich with the live
SMTP credentials and mails real customers — overdue notices on any ACTIVE
rental whose `endAt` has passed, and chases on unpaid charges. The first run
after an import is the moment a transcription mistake becomes a letter to a
customer. Forty-eight hours is enough to read what the passes *would* have
sent. Leaving it off longer is its own failure: no MFK warnings, no service
reminders, and nobody on the waiting list ever hears that a car is free.

## Order of operations

The database is prepared **before** the merge, not after. The build applies
migrations by itself (`scripts/migrate-on-build.mjs`), so merging first would
work — but it would put a live car-rental site in front of the public with an
empty fleet, which the new waiting-list notice renders, quite correctly, as
"No cars are available right now."

### 1. Back up the Neon production branch

The production database is the `production` branch of the Neon project. In the
Neon console, take a snapshot, or branch from it — a branch is instant and is
the fastest way back if an import goes wrong.

While there: the branch is currently **Not protected**. Protecting it stops it
being reset or deleted by accident, which is worth doing on the branch that
holds signed contracts.

### 2. Apply the schema

Ten migrations, none of which has ever run against production.

```bash
export DATABASE_URL='<the production connection string, from Neon>'
npx prisma migrate deploy
```

`migrate deploy` only applies what is pending and never rolls anything back.
It is the same command the build runs, so running it here makes the build's
own attempt a no-op.

### 3. Seed identity

```bash
export ADMIN_OWNER_USERNAME='<username>'
export ADMIN_OWNER_PASSWORD='<a long password>'
pnpm db:seed
```

Creates the organisation, the ten cars from `lib/rental/fleet.ts`, and the
first owner account. It is idempotent and reconciles identity only: it never
writes a car's status, and **it will not overwrite an existing password** — so
a second run cannot lock the office out. If the owner variables are unset it
skips the account and says so; `pnpm admin:password <user> <password>` is the
way in afterwards.

### 4. Import the pre-backend contracts

Thirteen PDFs from 17.08–13.09.2026. See `docs/LEGACY-IMPORT.md` for what they
contain and the four known problems in the source data that survive the import.

```bash
pnpm db:import-legacy            # dry run — prints the plan, writes nothing
pnpm db:import-legacy --apply
```

Read the dry run. It prints the host it is about to write to and one warning
per known problem. The import is idempotent on `Contract.contractNumber`, and
an entry already present is skipped whole rather than updated.

Needs `scripts/legacy-contracts.json`, which is gitignored and lives beside the
signed PDFs.

### 5. Merge and deploy

```bash
git checkout main && git merge integrate/backend-plus-return && git push
```

Vercel builds `main` and `zuriauto.ch` cuts over. The build runs
`prisma migrate deploy` again, harmlessly.

### 6. Smoke test, in this order

1. `/` — the public site still renders, and the fleet shows ten cars.
2. `/admin` — sign in with the seeded owner.
3. Fleet — ten rows, the ⋮ menu opens, the maintenance dialog saves a mileage.
4. Rentals — the thirteen imported contracts are listed as completed history.
   Their PDF links do not work, by design: no `Asset` rows exist for them.
5. `/pickup` — walk one test handover to the signature step **without
   submitting**, and confirm the vehicle picker lists cars from the database.
6. `/api/health` — all groups green.

### 7. Two days later — but not before this is settled

**There is one ACTIVE rental on production that ended on 28.08.2026 and was
never closed**: a `WEEKLY` rental on the Prius ZH 918 474, signed 21.08 by
"office" on a private gmail address, carrying six identity images. It predates
the go-live; it was almost certainly a test of the wizard, but nobody has
confirmed that and it holds real photographs, so it has been left alone.

It matters because of what the daily pass does with it. `runDailyPasses` mails
every ACTIVE rental whose `endAt` has passed, and `generateWeeklyCharges`
raises charges against any rental that is not COMPLETED or CANCELLED. The
first 07:00 run after the cron returns would therefore send that address an
overdue notice and begin billing it weekly, three weeks in arrears.

So: **close it, cancel it, or delete it before restoring the cron entry.** Then
restore the entry at the top of this file, deploy, and watch the first run.

Until then the Prius also shows as "Rented out" on the fleet screen and cannot
be booked, which is the visible symptom of the same row.

## Rolling back

Redeploy the previous production build from the Vercel dashboard; it is the
marketing site and has no database dependency, so it comes back cleanly.

The database does not roll back with it. Migrations are additive, so an old
build simply ignores the new tables — but any contract signed while the new
build was live is real, and restoring a pre-go-live Neon snapshot would erase
it. Roll the code back first, then decide about the data deliberately.
