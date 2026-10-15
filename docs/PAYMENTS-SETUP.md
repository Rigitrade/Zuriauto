# TWINT payments — switching it on

The site reads TWINT's payment emails (from `no-reply@twintpay.ch`), books
each payment to the right weekly charge when two signals agree, and lists
the rest under **Zahlungen** in `/admin`. Design:
`docs/superpowers/specs/2026-10-12-twint-payments-design.md`.

Nothing here runs until `TWINT_IMAP_USER` is set. Without it the cron route
answers `{"ok":true,"skipped":"not-configured"}` and does nothing else.

## 1. A mailbox only for TWINT

1. Hostinger hPanel → **Emails** → create `payments@zuriauto.ch`.
2. In the webmail of `info@zuriauto.ch` add a filter: **From contains**
   `no-reply@twintpay.ch` → **forward a copy** to `payments@zuriauto.ch`
   (keep the original in info@).

   Why: the site then holds the password of a mailbox that only ever
   contains TWINT's emails — never the password to customer mail.
3. Check that the forwarded copy still carries TWINT's signature. Put the
   `payments@` login in `.env.local` and run:

   ```
   TWINT_IMAP_USER=payments@zuriauto.ch
   TWINT_IMAP_PASS=<that mailbox's password>
   ```

   ```bash
   pnpm twint:peek
   ```

   Every email must show `DKIM pass`. If the forwarded copies do not, read
   `info@` directly instead (set `TWINT_IMAP_USER=info@zuriauto.ch`) and
   write that decision here.
4. See what the site would do with those emails, against the real data,
   before anything is switched on:

   ```bash
   pnpm twint:dry-run              # -- --days 60 looks further back
   ```

   It runs the cron's own steps inside a read-only database transaction:
   nothing is stored, booked or sent. Each email ends in "would BOOK" (and
   to which rental) or "would WAIT" (and why). Without a mailbox login,
   saved originals work too: `pnpm twint:dry-run -- --eml <folder>`.

## 2. The variables in Vercel

Vercel → project **zuriauto-6v88** → Settings → Environment Variables,
Production:

| Variable | Value |
| --- | --- |
| `TWINT_IMAP_USER` | `payments@zuriauto.ch` (or `info@…`, see above) |
| `TWINT_IMAP_PASS` | that mailbox's password |
| `TWINT_IMAP_HOST` | only if not `imap.hostinger.com` |
| `TWINT_IMAP_PORT` | only if not `993` |
| `TWINT_IMAP_MAILBOX` | only if not `INBOX` |
| `TWINT_LOOKBACK_DAYS` | only if not `14` |
| `TWINT_STORE_NAME` | only if the "Name des Stores" line in TWINT's email is not `Zuriauto` — a notification for any other store books nothing |

`CRON_SECRET` already exists; the payments route uses the same one.
Redeploy after changing variables — they are read at build time.

## 3. The trigger, every 10 minutes

Vercel's free plan runs crons once a day, so use an external scheduler:

- **cron-job.org** (free): new job, URL
  `https://www.zuriauto.ch/api/cron/payments/`, every 10 minutes, method
  **POST**, header `Authorization: Bearer <CRON_SECRET>`.
- Or, on Vercel Pro, add to `crons` in `vercel.json`:
  `{ "path": "/api/cron/payments/", "schedule": "*/10 * * * *" }`.

Switch on the scheduler's failure email (cron-job.org: job → Notifications
→ "execution failed"). A run that cannot read the mailbox — a changed
password, Hostinger down — answers 500, and nothing else will tell anyone.

## 4. The first run

Call it once by hand and read the counts:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.zuriauto.ch/api/cron/payments/
```

The first run reads everything from the last 14 days. Payments older than
the feature mostly land in `review` — their weeks may already be marked
paid by hand. `unsigned` or `unreadable` above 0 means: look at that email
with `pnpm twint:peek` before going further.

Running it twice is harmless: the second run counts every email as
`duplicate`.

## 4b. Emails nothing was booked from

An email that claims to be from TWINT but is not signed by it, one whose
fields cannot be read, or one for another store books nothing. Each is listed
once under **Zahlungen → TWINT-Mails ohne Buchung** and counted on the
Overview until somebody marks it **Erledigt**. Several "Nicht lesbar" at once
usually means TWINT changed its email: send one to the developer.

## 5. The first week

Open **Zahlungen** daily. Note how many payments booked themselves and why
the others waited. If most wait because customers do not write the plate
and week, two things help, in this order:

1. In the TWINT merchant portal, make the **Nachricht** field mandatory and
   label it "Kennzeichen + Woche (z. B. ZH 513 925 W3)".
2. Pre-fill the reference in the payment-request emails (plan Task 10) —
   after one test payment shows where TWINT puts `trxInfo`.

If it is still noisy, the sturdier route is a payment provider with
webhooks (Stripe or Payrexx), where the reference cannot be edited.

## Switching it off

Delete `TWINT_IMAP_USER` in Vercel and redeploy. The route answers
`skipped`; payments already recorded stay where they are.
