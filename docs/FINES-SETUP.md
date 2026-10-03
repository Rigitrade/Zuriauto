# Traffic fines — setup and daily use

What has to be in place before the **Bussen** section in `/admin` can read
letters in production, and how the office uses it. The design is in
`docs/superpowers/specs/2026-10-03-traffic-fines-design.md`.

## Before the first upload

### 1. Let the browser upload to the bucket (once, in Cloudflare)

Scans go from the browser straight to R2 — they are too large for a Vercel
function. R2 must allow that. In the Cloudflare dashboard: **R2 → the
project's bucket → Settings → CORS policy → Edit**, and paste:

```json
[
  {
    "AllowedOrigins": ["https://www.zuriauto.ch", "https://zuriauto.ch"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 600
  }
]
```

Without it, every upload in the dashboard ends in "Hochladen fehlgeschlagen"
and the browser console shows a CORS error.

### 2. Environment variables

Nothing new is required. The feature uses what the site already has:
`DATABASE_URL`, the `R2_*` variables, the `SMTP_*`/`MAIL_*` variables and
`SITE_URL` (the links in renter emails). Optional:

| Variable | Default | Meaning |
|---|---|---|
| `FINES_HANDLING_FEE_CENTS` | `2000` | The GTC fee per fine and per Mahnung, in Rappen. `0` turns it off. Only charged to renters who accepted the GTC of 30.07.2026 or later. |

### 3. The daily job must run

`vercel.json` has had `"crons": []` since go-live. Without the daily job:

- letters whose reading was interrupted are never read again;
- renters get no reminder a week before the deadline;
- the office gets no overdue alerts and no daily review digest;
- old payment screenshots are never deleted.

Restoring it also restarts every other daily pass (weekly charges, payment
reminders, MFK warnings) — see `docs/GO-LIVE.md`. That is a decision for the
owner, separate from this feature.

## Daily use

1. **Scan before anyone writes on the letter.** Handwriting and marker boxes
   are read as text; a box over the plate makes the plate unreadable.
   One letter per PDF; 300 DPI, colour or greyscale.
2. **Bussen → drop the PDFs in.** Several at once is fine. Each line shows its
   progress; reading takes a minute or less per letter.
3. Clean letters go to the renter on their own: email in their contract
   language, the letter attached, a link to confirm payment. They appear
   under **Offen**.
4. Anything the system would not send alone appears under **Prüfen**, with
   the reason. Open it: the letter is beside what was read, each value marked
   *bestätigt*, *gelesen*, *unsicher* or *fehlt*. Correct what is wrong, pick
   the renter if it is a handover case, and press **An Mieter senden**.
5. A renter's payment screenshot that shows the amount and the reference marks
   the fine **Bezahlt** by itself. One the system cannot read waits under
   Prüfen for **Akzeptieren** or **Ablehnen**.
6. A **Mahnung** for a fine is uploaded like any letter. It joins the fine;
   if the fine was marked paid, it reopens and both the renter and the office
   are told.
7. A fine the office handles another way — paid it, named the driver to the
   police, disputed it — is closed with **Anders erledigt** and a note.

## The number to watch

The section header shows how many of the last 30 days' letters went out with
nobody looking. If that share stays low on real letters, reading with AI (the
spec's phase 2) is worth its few Rappen per letter.

## Adding real letters to the tests

Unmarked scans from the pile make the reader's tests stronger. Copy a PDF to
`lib/fines/__fixtures__/`, add an entry with what it should read to
`lib/fines/golden.test.ts`, and run `pnpm test`. A real letter is addressed
to Rigitrade AG and names a plate, a place and a time — no renter — but
check the scan carries nothing else before committing it.
