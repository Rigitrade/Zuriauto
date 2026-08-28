# Deploying Phases 2 and 3

**Status:** not yet deployed. Everything below is prepared and untested against
production, because it touches external accounts and real customer email.

Two phases now sit on `integrate/backend-plus-return`, which is
`feat/rental-contract-revisions` with `main` merged into it — so it carries the
return form, the TWINT option, the PDF document uploads and the branded
customer email alongside the persistence and lifecycle work. Until this runbook
is followed, the office is still using the Phase 1 stateless form: contracts are
emailed and nothing is recorded.

Read the whole thing before starting. Steps 1 and 2 are irreversible in ways
that matter.

**Free plan is enough to deploy and test this.** Every technical limit is far
away at this fleet size; what the free plan costs you is cron precision (once a
day, fired within the hour — see step 6) and one hour of runtime logs instead of
a day. The one thing it does not cover is Vercel's own terms, which restrict
Hobby to non-commercial use — a decision for the owner, not a blocker on
following these steps.

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

Expect four migrations: `…_init`, `…_lifecycle`, `…_returning_customer_recognition`
and `…_admin_accounts`. All additive — see "Rolling back" at the end of this
document.

**Also creates the office's first dashboard account, if you are ready for it.**
The command below runs `seedOwner()`, which reads `ADMIN_OWNER_USERNAME`,
`ADMIN_OWNER_NAME` and `ADMIN_OWNER_PASSWORD` — described in step 3's table,
two sections below this one — and does nothing if they are unset: no error,
just a missing `, owner created` in the log line. Nothing later in this
runbook re-runs the seed for you, so **read step 3's owner-variable note now**
and have those three values in your local `.env.local` (or inlined in the
command below) before running it, or the deploy ships a dashboard nobody can
sign into. Step 5h is the check that would catch it if you don't.

```bash
# One Organisation row, the nine fleet vehicles, and the first dashboard
# account (only if the three ADMIN_OWNER_* variables above are set).
DATABASE_URL="<neon pooled url>" pnpm db:seed
```

- [ ] Verify: `SELECT count(*) FROM "Car";` returns 9.
- [ ] Verify: `SELECT username, role FROM "AdminUser";` returns the one owner
      row you expect. Empty here is exactly the failure step 5h is for.

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
| `ADMIN_SECRET` | a fourth random string — **must differ from `APPLY_SECRET`** |
| `ADMIN_OWNER_USERNAME` | the first account's username, e.g. `chef` |
| `ADMIN_OWNER_NAME` | how it is displayed, e.g. `Die Chefin` |
| `ADMIN_OWNER_PASSWORD` | its initial password — **set before the deploy** |
| `SITE_URL` | `https://zuriauto.ch` — no trailing slash |

> **Set these three before running step 1's `pnpm db:seed`, not just before
> the deploy.** The seed creates the first account only when the organisation
> has none, and never overwrites a password that already exists — so a seed
> run without them ships a dashboard nobody can sign into, and setting
> `ADMIN_OWNER_PASSWORD` afterwards does nothing, because the account it
> would apply to was never created. `pnpm admin:password <username>
> <password>` only resets a *forgotten* password on an account that already
> exists — it cannot create the missing one. If step 5h finds nobody can sign
> in, the recovery is step 5h's, not this command: set the three variables,
> point `DATABASE_URL` at the production database, and re-run `pnpm db:seed`.

Already set, unchanged: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`MAIL_FROM`, `MAIL_OFFICE`, `MAIL_ARCHIVE`.

Two deliberate fail-closed behaviours, so a half-configured deploy stops rather
than misbehaving quietly:

- **No `R2_BUCKET` in production and the app refuses to start.** A deploy that
  silently discarded every ID scan while reporting success is the worse failure.
- **No `CRON_SECRET` and the cron endpoint returns 401 to everyone**, including
  Vercel. It sends email to real customers; an open trigger is not acceptable.
- **No `ADMIN_SECRET` and `/admin` cannot be signed into at all.** Every admin
  endpoint refuses, so the fleet page is unusable rather than open.

### The fleet page

`/admin` is where the office adds, edits and retires cars, sees what is out on
rental, and closes a rental that has come back. It is unlinked and `noindex` —
nothing in the site points at it — but the secret is what actually protects it.

**`ADMIN_SECRET` must not be the same value as `APPLY_SECRET`.** The pickup key
is pasted into WhatsApp by staff and leaks the moment a link is forwarded; the
admin key can rewrite the fleet. Sharing one value would put fleet management
behind a semi-public string. See the warning in `lib/applyKey.ts`.

Sign-in is a username and a password against an account in the database, and
exchanges them for an httpOnly cookie lasting twelve hours. `ADMIN_SECRET` is
no longer the password: it signs those cookies, so rotating it signs everyone
out at once, which stays the emergency lever.

Per-person revocation is real from Phase 5: disabling an account takes effect
on that person's next click, and changing their password ends their other
sessions. There are two roles — an owner manages accounts, staff manage the
fleet.

- [ ] `MAIL_ARCHIVE` is still set. It runs in parallel through this phase and is
      the only *proven* durable record. Do not switch it off yet.

---

## 4. Merge and deploy

**Set the environment variables in step 3 first.** Two of them change what the
live site does the moment this merges, and neither failure is loud:

- Without `APPLY_SECRET`, every submission is refused with 401. The customer
  still gets their PDF — the wizard falls back to the Phase 1 download — but
  nothing is recorded, and the office finds out only from a missing row.
- Without `DATABASE_URL` or `R2_BUCKET`, the write path answers 503 and the
  same fallback happens. `/api/fleet` degrades quietly too: the picker keeps
  the compiled-in list from `lib/rental/fleet.ts`, so the form still works and
  the failure is invisible on screen.

- [ ] **Test on a Preview deployment before merging.** Vercel builds every
      branch, so set the same variables in the Preview environment, push, and
      run the whole of step 5 against the preview URL. That exercises the real
      database and the real bucket without the office's link changing.
- [ ] Open a PR to `main` and read the diff. It is large — two phases, plus the
      return form and the customer email that arrived on `main` meanwhile.
- [ ] Merge. Vercel builds `main`.
- [ ] `pnpm build` runs `prisma generate` first, so the generated client is
      rebuilt on the deploy. `postinstall` does the same for installs.

### The office's link changes — warn them before you merge

Phase 1 had no gate: `https://zuriauto.ch/apply/` opened the form for anybody.
From Phase 2 the page needs `?k=<APPLY_SECRET>`, and without it a browser shows
"Link nicht gültig" and no form.

So **every bare link already sent to a customer stops working at the merge.**
Old links that carry the key keep working: `/apply/` now redirects to
`/pickup/`, and the redirect preserves the query string, so
`/apply/?k=<secret>` lands on `/pickup/?k=<secret>`. Verified, not assumed.

- [ ] Tell the office the new link before merging, not after.
- [ ] Check whether anyone is mid-handover with a bare link open. They should
      submit before the deploy or be re-sent the new one.

---

## 5. Smoke test, in this order

**a. The fleet endpoint reads the database.**

```bash
curl -s https://zuriauto.ch/api/fleet/ | head -c 200
```
Expect nine vehicles.

**b. The write fence holds.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://zuriauto.ch/api/rental-contract/
```
Expect `401`.

**c. The gate holds.** Open `https://zuriauto.ch/pickup/` in a *browser* —
expect "Link nicht gültig" and no form. Then open
`https://zuriauto.ch/pickup/?k=<APPLY_SECRET>` and expect the five-step wizard.

Use a browser, not curl. The gate is a client-side decision, so the
server-rendered HTML contains the form either way and `curl` will appear to
show it. That is not a hole — the fence that matters is the `APPLY_SECRET`
check on the write endpoint, tested in **b** — but it does make curl the wrong
tool for this step.

- [ ] `https://zuriauto.ch/apply/?k=<APPLY_SECRET>` still reaches the form, so
      keys already circulated keep working.

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

**h. The owner can actually sign in.** This is the check that catches an
unseeded owner — nothing earlier in this runbook attempts a sign-in, so a
deploy can pass every other smoke test and still leave nobody able to open
the dashboard.

- [ ] Open `https://zuriauto.ch/admin/` in a browser and sign in with
      `ADMIN_OWNER_USERNAME` / `ADMIN_OWNER_PASSWORD`. Expect the dashboard,
      not the sign-in form staying up with a failure message.

If it fails: the seed in step 1 most likely ran before the three
`ADMIN_OWNER_*` variables were set, so `seedOwner()` silently created no
account. Recover by setting `ADMIN_OWNER_USERNAME`, `ADMIN_OWNER_NAME` and
`ADMIN_OWNER_PASSWORD`, pointing `DATABASE_URL` at the production database,
and re-running `pnpm db:seed`. This is safe to do at any time, including
against a database that already has data: the seed never overwrites a
password that already exists, so re-running it only fills in the missing
owner and otherwise changes nothing. `pnpm admin:password` cannot substitute
for this — it resets a forgotten password on an account that already exists,
not create one that was never seeded.

---

## 6. Turn the cron on

`vercel.json` already declares it, along with the execution region:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/cron/daily/", "schedule": "0 7 * * *" }]
}
```

**Keep that file free of commentary.** Vercel validates it against a schema
that rejects unknown properties, so a `_comment` key — a common way to annotate
JSON — fails the build outright with *"should NOT have additional property"*.
The explanations that used to live in the file are below instead.

**`regions: ["fra1"]` is Frankfurt, and it is load bearing.** Vercel executes
functions in Washington DC for every new project unless told otherwise. The
bucket's jurisdiction and the database region were both chosen to keep identity
documents in the EU; without this line the function that *receives* the upload
would run in the United States, which defeats the reason for choosing them.
Frankfurt is also nearest the Neon project in `eu-central-1`.

**Vercel cron schedules are UTC, not Zurich.** `0 7 * * *` is 09:00 Zurich in
summer and 08:00 in winter. That drift is harmless here — the 48-hour reminder
window absorbs it — but do not read the expression as a local time.

**On the free plan the trigger is also imprecise.** Hobby allows one run per
day and fires it anywhere inside the hour, so `0 7 * * *` means "somewhere
between 07:00 and 07:59 UTC". The 48-hour window covers that too. What the free
plan will not do is a tighter schedule: a cron expression that would run more
than once a day fails at deployment rather than being silently downgraded.

If an exact 24-hour reminder is wanted without upgrading, point any external
scheduler at the same URL with the same bearer token — GitHub Actions,
cron-job.org and Upstash QStash all work, the endpoint accepts POST as well as
GET for exactly this reason, and nothing in the code changes. Remove the
`crons` block from `vercel.json` if you do, so the run does not happen twice.

- [ ] Confirm the first scheduled run in Vercel's cron log. Note that cron only
      fires on production deployments of the default branch, so a preview
      deployment never triggers it — trigger those by hand with the bearer.

---

## 7. Hand over to the office

- [ ] Give them `https://zuriauto.ch/pickup/?k=<APPLY_SECRET>` and explain that
      the link *is* the credential: anyone who has it can create a rental, so it
      should not be forwarded outside the office.
- [ ] The return form at `https://zuriauto.ch/return/` is **not** fenced by this
      key, because it is filled in by the renter. Since Phase 4 it **records
      the return**: the rental moves to `RETURN_SUBMITTED` and the signed
      report is stored against it. It deliberately does **not** free the car —
      an unfenced form must not be able to put a car somebody is driving back
      into the picker. The office confirms in `/admin`, which is one click.
- [ ] Show them how to take a car off the road:
      `UPDATE "Car" SET status = 'maintenance' WHERE plate = '…';`
- [ ] Show them the traffic-fine lookup — see `docs/RENTAL-CONTRACT-SETUP.md`.
- [ ] Tell them marking a charge paid is a SQL statement until Phase 5.
- [ ] **Closing a rental is a button, not SQL.** `/admin` lists every rental
      that is out; one marked **Zurückgegeben – bestätigen** is one the renter
      has already filled the return form for. Confirming it sets the rental
      `COMPLETED` and the car `available` in one transaction, and the car
      reappears in the picker.
      This is the first thing they will hit in real use, so show them the
      button rather than leaving it in a document.
- [ ] Tell them what the **Rückgabe offen** count means: cars the renter says
      are back that nobody here has confirmed. It should normally be zero by
      the end of the day.

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

The one thing that does not roll back is a sent email. That is why step 5f
runs after every safer check in that list, and why it uses your own address.
