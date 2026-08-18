# Deploying Phases 2 and 3

**Status:** not yet deployed. Everything below is prepared and untested against
production, because it touches external accounts and real customer email.

Two phases sit on `feat/rental-contract-revisions` and have never run outside a
laptop. Until this runbook is followed, the office is still using the Phase 1
stateless form: contracts are emailed and nothing is recorded.

Read the whole thing before starting. Steps 1 and 2 are irreversible in ways
that matter.

---

## 0. Before you touch anything

- [ ] **Agree the retention period for identity documents.** See
      `docs/DATA-RETENTION.md`. This is a legal decision, not a technical one,
      and every later step assumes it is settled. Recommended: 90 days after
      the rental ends for ID and licence images, ten years for the contract
      under OR 958f, two years for condition photographs.
- [ ] Decide the reminder cadence — see step 6. Daily is what the free Vercel
      plan allows, and is why the reminder window is 48 hours wide rather than
      24.
- [ ] Confirm whether the existing SumUp link already offers TWINT. If it does,
      the payment path is real from day one; if not, the office confirms payment
      by hand. Nothing blocks either way.

---

## 1. Neon Postgres — EU region

**Irreversible.** A Neon project cannot change region. Creating it in the wrong
one means recreating it, which is only cheap while there is no production data.

- [ ] Create a Neon project in an **EU region** — `eu-central-1` (Frankfurt) is
      the usual choice.
- [ ] Copy the pooled connection string.
- [ ] Record the region in `docs/DATA-RETENTION.md`, which has a checkbox for it.

```bash
# Apply the schema. `migrate deploy`, never `migrate dev` — dev can prompt to
# reset the database, which against production would be catastrophic.
DATABASE_URL="<neon pooled url>" pnpm exec prisma migrate deploy
```

Expect two migrations: `…_init` and `…_lifecycle`.

```bash
# One Organisation row and the eight fleet vehicles.
DATABASE_URL="<neon pooled url>" pnpm db:seed
```

- [ ] Verify: `SELECT count(*) FROM "Car";` returns 8.

---

## 2. Cloudflare R2 — EU jurisdiction

**Irreversible.** A bucket's jurisdiction is fixed at creation, and this bucket
will hold ID scans and driving licences.

```bash
wrangler r2 bucket create zuriauto-assets --jurisdiction eu
wrangler r2 bucket list          # confirm the jurisdiction reads EU
```

- [ ] Create an R2 API token scoped to **this bucket only**, with object
      read/write.
- [ ] Record the jurisdiction in `docs/DATA-RETENTION.md`.

The bucket must not be public. Nothing in the application serves an object back
to a browser; the only reader is a human in the Cloudflare console.

---

## 3. Environment variables on Vercel

All of these go in **Production** and **Preview**. `.env.local.example`
documents every one.

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `ORGANISATION_NAME` | `ZURIAUTO` |
| `APPLY_SECRET` | `node -e "console.log(crypto.randomUUID())"` |
| `RATE_LIMIT_SALT` | a second, different random string |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | from the scoped token |
| `R2_SECRET_ACCESS_KEY` | from the scoped token |
| `R2_BUCKET` | `zuriauto-assets` |
| `CRON_SECRET` | a third random string |
| `SITE_URL` | `https://zuriauto.ch` — no trailing slash |

Already set, unchanged: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`, `MAIL_OFFICE`, `MAIL_ARCHIVE`.

Two deliberate fail-closed behaviours, so a half-configured deploy stops rather
than misbehaving quietly:

- **No `R2_BUCKET` in production and the app refuses to start.** A deploy that
  silently discarded every ID scan while reporting success is the worse failure.
- **No `CRON_SECRET` and the cron endpoint returns 401 to everyone**, including
  Vercel. It sends email to real customers; an open trigger is not acceptable.

- [ ] `MAIL_ARCHIVE` is still set. It runs in parallel through this phase and is
      the only *proven* durable record. Do not switch it off yet.

---

## 4. Merge and deploy

- [ ] Open a PR from `feat/rental-contract-revisions` to `main` and read the
      diff. It is large — 10 commits across two phases.
- [ ] Merge. Vercel builds `main`.
- [ ] `pnpm build` runs `prisma generate` first, so the generated client is
      rebuilt on the deploy. `postinstall` does the same for installs.

---

## 5. Smoke test, in this order

**a. The fleet endpoint reads the database.**

```bash
curl -s https://zuriauto.ch/api/fleet/ | head -c 200
```
Expect eight vehicles.

**b. The write fence holds.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://zuriauto.ch/api/rental-contract/
```
Expect `401`.

**c. `/apply` refuses without the key.** Open `https://zuriauto.ch/apply/` —
expect "Link nicht gültig" and no form. Then open
`https://zuriauto.ch/apply/?k=<APPLY_SECRET>` and expect the five-step wizard.

**d. One real contract, end to end.** Use a car you can take out of service
afterwards, and your own email as the renter.

- [ ] The PDF arrives and its terms block is correct.
- [ ] `SELECT "contractNumber", "mailSentAt", "mailError" FROM "Contract";` —
      expect a sequenced `ZA-YYYYMMDD-0001`, `mailSentAt` set, `mailError` null.
- [ ] Seven assets and the PDF are in R2 under one `pickup/<uuid>/` prefix.
- [ ] `SELECT status FROM "Car" WHERE plate = '…';` reads `rented`.
- [ ] Weekly rental? `SELECT count(*) FROM "Charge";` matches the week count.

**e. The cron endpoint.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://zuriauto.ch/api/cron/daily/
# expect 401

curl -s -H "Authorization: Bearer $CRON_SECRET" https://zuriauto.ch/api/cron/daily/
# expect {"ok":true,...}; run it twice and the second must be all zeros
```

**f. One real reminder.** This is the test that could not be run locally, and
the one most likely to surface a problem: SMTP from a serverless function has
failed in this project before.

- [ ] Set the test rental's `endAt` to about 36 hours out.
- [ ] Trigger the cron. Expect `reminded: 1`.
- [ ] The email arrives, in the language the contract was signed in, and its
      link opens the manage page.
- [ ] Take the extension. Expect the confirmation email, the office copy, a new
      `endAt`, and new `Charge` rows.
- [ ] Open the same link again. Expect the "link no longer valid" page.
- [ ] `SELECT kind, "sentAt", error FROM "Notification";` — every row sent, no
      errors.

**g. Clean up.** Delete the test rental, its contract, charges, notifications
and tokens; set the car back to `available`; delete its objects from R2.

---

## 6. Turn the cron on

`vercel.json` already declares it:

```json
{ "crons": [{ "path": "/api/cron/daily/", "schedule": "0 7 * * *" }] }
```

**Vercel cron schedules are UTC, not Zurich.** `0 7 * * *` is 09:00 Zurich in
summer and 08:00 in winter. That drift is harmless here — the 48-hour reminder
window absorbs it — but do not read the expression as a local time.

If a tighter window is wanted later, point any external pinger at the same URL
with the same bearer token. GitHub Actions, cron-job.org and Upstash QStash all
work, and nothing in the code changes.

- [ ] Confirm the first scheduled run in Vercel's cron log.

---

## 7. Hand over to the office

- [ ] Give them `https://zuriauto.ch/apply/?k=<APPLY_SECRET>` and explain that
      the link *is* the credential: anyone who has it can create a rental, so it
      should not be forwarded outside the office.
- [ ] Show them how to take a car off the road:
      `UPDATE "Car" SET status = 'maintenance' WHERE plate = '…';`
- [ ] Show them the traffic-fine lookup — see `docs/RENTAL-CONTRACT-SETUP.md`.
- [ ] Tell them marking a charge paid is a SQL statement until Phase 5.

---

## Existing rentals

Any rental created between the Phase 2 deploy and the Phase 3 deploy has no
charge schedule, so nothing will be billed for it.

```bash
pnpm db:backfill-charges                 # prints a plan, writes nothing
pnpm db:backfill-charges -- --commit     # applies it
```

Read the plan first. It decides what money to ask for, which is why it is a
script and not a migration — and charges whose due date has already passed will
be requested on the next cron run.

---

## Rolling back

- **The application**: redeploy the previous Vercel build. The Phase 1 path is
  intact — `/apply` falls back to download-and-email whenever the write path is
  unavailable.
- **The cron**: remove the `crons` block from `vercel.json`, or rotate
  `CRON_SECRET`, which makes every trigger 401 immediately.
- **The database**: migrations are additive; nothing that already existed
  changed shape. There is no down-migration and it should not be needed.

The one thing that does not roll back is a sent email. That is why step 5f is
last, and why it uses your own address.
