# Rental pickup contract — setup

The pickup contract lives at **`/rental/pickup/`**. Everything up to the PDF
runs in the browser; the only server call is `/api/rental-contract`, which
emails the finished document to the office and to the customer.

## Environment variables

`.gitignore` excludes `.env*`, so these are set in the Vercel project settings
(or a local `.env.local`) rather than committed.

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_HOST` | yes | e.g. `mail.infomaniak.com` |
| `SMTP_PORT` | no | Defaults to `587`. Port `465` switches on implicit TLS. |
| `SMTP_USER` | yes | Mailbox login. |
| `SMTP_PASS` | yes | Mailbox password, or an app password where 2FA is on. |
| `MAIL_FROM` | no | Sender address. Falls back to `SMTP_USER`. |
| `MAIL_OFFICE` | yes | Where contracts are delivered. Comma-separate for several. |
| `MAIL_ARCHIVE` | no | Blind archive copy. See below — treat this as required. |

`MAIL_ARCHIVE` is the backup. Phase 1 writes nothing to disk, so a contract
deleted from the office inbox is unrecoverable, ID and licence images included.
Point this at a mailbox nobody works out of. The route logs a warning once per
cold start while it is unset. It is sent blind, so the customer never sees the
address.

Start from `.env.local.example`, which lists the SMTP host and port for the
common Swiss providers.

**Until these are set the page still works.** The route replies
`503 {"code":"mail-not-configured"}`, and the browser falls back to offering
the PDF as a download and a native share. Nothing is lost; it just is not
emailed.

Local example:

```
SMTP_HOST=mail.infomaniak.com
SMTP_PORT=587
SMTP_USER=vertrag@zuriauto.ch
SMTP_PASS=…
MAIL_FROM=vertrag@zuriauto.ch
MAIL_OFFICE=info@zuriauto.ch
```

## Adding the remaining vehicles

`lib/rental/fleet.ts` ships one real car — the Toyota Prius, `ZH 589 864` —
and nine placeholders. To put a car into service, fill in `model`, `plate` and
`vin` and delete its `placeholder` flag. Nothing else needs changing.

Placeholders are filtered out of the picker on purpose: a customer must never
be able to sign a contract naming a plate that does not exist.

## What the flow does

1. **Vehicle** — car, mileage, fuel level, pre-existing damage, up to four
   condition photos.
2. **Your details** — name, date of birth, address, mobile, email.
3. **Documents** — ID and driving licence, camera capture on mobile.
4. **Terms and signature** — the GTC render inline from `locales/gtc.ts`. The
   acceptance checkbox unlocks only after the panel is scrolled to the end, and
   the signature canvas unlocks only after acceptance.

On submit the browser builds the PDF, downscales the photos to fit inside
Vercel's ~4.5 MB request limit, and posts it. The result screen always offers
Download and Share, including on every failure path.

## Known limits (Phase 1)

- **Nothing is stored.** There is no rentals table, no status workflow and no
  return step. Those are Phase 2, and they need a database.
- **Contract numbers are not guaranteed unique** — date plus plate digits plus
  a random suffix, with nothing to check against.
- **The PDF is built client-side**, so a determined customer could alter it
  before sending. The office should read the document before releasing keys.
- **`/api/rental-contract` is public and unauthenticated.** It is fenced with a
  size cap, an origin check, a honeypot and a per-IP limiter held in memory
  that resets on cold start. That blunts casual abuse; it is not real rate
  limiting.
- **Identity documents travel by email**, which is not encrypted end to end.
  Worth a retention rule on the office mailbox.

## Testing it locally

```
npm run dev
```

Then open `http://localhost:3000/rental/pickup/`. Camera capture needs a real
phone; on desktop the photo fields fall back to a file picker.
