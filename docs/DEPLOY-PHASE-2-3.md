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
`ADMIN_OWNER_NAME` and `ADMIN_OWNER_PASSWORD` — described in step 3's
owner-variable note, two sections below this one — and does nothing if they
are unset: no error, just a missing `, owner created` in the log line.
Nothing later in this runbook re-runs the seed for you, so **read step 3's
owner-variable note now** and have those three values in **your local
`.env.local`** (or inlined in the command below) before running it, or the
deploy ships a dashboard nobody can sign into. Step 5h is the check that
would catch it if you don't.

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
| `SITE_URL` | `https://zuriauto.ch` — no trailing slash |

`ADMIN_OWNER_USERNAME`, `ADMIN_OWNER_NAME` and `ADMIN_OWNER_PASSWORD` are
**deliberately not in this table.** They do not belong on Vercel at all —
they belong in the *operator's own local* `.env.local`, for the one command
below.

> **Why not Vercel.** Nothing in the deployment ever reads them there. The
> build is `prisma generate && next build` (see `package.json`); there is no
> `prisma.seed` hook, and `vercel.json` runs no seed step. `seedOwner()` runs
> only from `pnpm db:seed`, a command an operator runs by hand, and `prisma/
> seed.ts` loads `.env.local` itself — the operator's local file, not
> anything Vercel injects into a Function. Setting these three on Vercel
> would not create the account faster or more reliably; it would do nothing
> at all except leave the owner's initial password sitting in the Vercel
> dashboard permanently, readable by anyone with project access, with no
> code that ever consumes it.
>
> **Set these three in your local `.env.local` before running step 1's
> `pnpm db:seed`, not on Vercel and not "before the deploy."** The seed
> creates the first account only when the organisation has none, and never
> overwrites a password that already exists — so a seed run without them
> ships a dashboard nobody can sign into, and setting
> `ADMIN_OWNER_PASSWORD` afterwards does nothing, because the account it
> would apply to was never created. `pnpm admin:password <username>
> <password>` only resets a *forgotten* password on an account that already
> exists — it cannot create the missing one. If step 5h finds nobody can sign
> in, the recovery is step 5h's, not this command: set the three variables
> locally, point `DATABASE_URL` at the production database, and re-run
> `pnpm db:seed` from your machine.

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

If it fails, there are two indistinguishable causes — the sign-in form shows
the same failure message and the server logs stay silent either way, so
check both:

1. **No owner was seeded.** The seed in step 1 most likely ran before the
   three `ADMIN_OWNER_*` variables were set, so `seedOwner()` silently
   created no account.
2. **`ADMIN_SECRET` is unset or was rotated.** `issueAdminSession()` throws
   when it is missing, and the sign-in route answers the same 401 as a wrong
   password by design (see `lib/admin/session.ts`) — so a correct username
   and password can fail this check for a reason that has nothing to do with
   the owner row at all.

Check `https://zuriauto.ch/api/health/` before doing anything else — it is
deliberately unfenced for exactly this. Its `env.fence.ADMIN_SECRET` field
reports whether the variable is present, without revealing its value, and
its `database.admins` field reports how many `AdminUser` rows exist. Nonzero
`admins` with `ADMIN_SECRET` present but sign-in still failing points at a
third possibility (a typo in the credentials); zero `admins` points at cause
1; `ADMIN_SECRET` reporting absent points at cause 2 regardless of what
`admins` says.

**Recovering from cause 1:** set `ADMIN_OWNER_USERNAME`, `ADMIN_OWNER_NAME`
and `ADMIN_OWNER_PASSWORD` in your local `.env.local`, point `DATABASE_URL`
at the production database, and re-run `pnpm db:seed` from your machine.
This is safe to do at any time, including against a database that already
has data, for the owner row specifically: the seed never overwrites a
password that already exists, so re-running it only fills in the missing
owner and never touches an existing account. `pnpm admin:password` cannot
substitute for this — it resets a forgotten password on an account that
already exists, not create one that was never seeded.

**But re-running `pnpm db:seed` is not a no-op on a system the office has
already been using.** The same run also calls `seedFleet()`, and its
`update` branch writes `model`, `plate` and `vin` from `lib/rental/fleet.ts`
over whatever is currently in each `Car` row — the same three fields the
dashboard's fleet section lets the office correct by hand (a typo'd plate,
a corrected VIN). `status` is genuinely untouched, so a car the office took
off the road stays off the road. A plate is a legal identifier printed on
signed contracts, so **before re-running the seed against a live system,
diff the fleet's current plates against `lib/rental/fleet.ts` and update the
file first** if the office has corrected anything there — otherwise the seed
silently reverts the correction on every affected car.

**Recovering from cause 2:** set (or reset) `ADMIN_SECRET` on Vercel and
redeploy or wait for the next request to pick it up. This also signs
everyone else out at once, which is the same lever step 3 describes for
rotating it deliberately.

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
- [ ] **Taking a car off the road is a button, not SQL.** In `/admin`'s
      fleet table, each car has a **Ausser Betrieb** / "Take off the road"
      button (**Wieder aktivieren** / "Put back on the road" once it is).
      It disappears from the picker on the next page load. There is no SQL
      to show anyone for this any more.
- [ ] **Explain the change the office will actually notice: everyone now
      signs in with their own account.** The shared `ADMIN_SECRET` that used
      to double as the dashboard's password stops working as a password —
      it still signs the session cookie behind the scenes, but nobody types
      it any more. Each person signs in at `/admin` with their own username
      and password instead. Walk the owner through the **Konten** /
      "Accounts" section at the bottom of the dashboard: it is where they
      create a login for each staff member (name, username, initial
      password, and a role of owner or staff), disable somebody who leaves,
      and reset a password for somebody who forgot theirs. Each person can
      also change their own password from the "My password" card once
      signed in.
- [ ] **Tell the owner what happens if *they* forget their own password.**
      Resetting it through the dashboard needs to be signed in already, which
      a locked-out owner by definition is not — the accounts section cannot
      get them back into their own account. The way back in is `pnpm
      admin:password <username> <password>`, run by whoever has
      `DATABASE_URL` for the production database — the same command and the
      same person who could already recover any forgotten dashboard
      credential before this handover.
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
