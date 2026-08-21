# Rental pickup contract — setup

The pickup contract lives at **`/pickup/`** — the former `/rental/pickup/` and
`/apply/` paths redirect there, since links to both had already been sent to
customers. The route is marked `noindex`, because a form that invites identity
documents should be reachable only by someone the office sent the link to.

Everything up to the PDF
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
- ~~**Contract numbers are not guaranteed unique**~~ — fixed in Phase 2. They
  come from a per-day database sequence, `ZA-YYYYMMDD-NNNN`. The random-suffix
  form survives only as the offline fallback when the database is unreachable.
- **The PDF is built client-side**, so a determined customer could alter it
  before sending. The office should read the document before releasing keys.
- ~~**`/api/rental-contract` is public and unauthenticated**~~ — fixed in
  Phase 2. It now requires `APPLY_SECRET`, and the per-IP limiter is backed by
  the database, so it survives a cold start and is shared across instances.
- **Identity documents travel by email**, which is not encrypted end to end,
  *and* are now stored in EU object storage. Both need a retention rule — see
  `docs/DATA-RETENTION.md`.

## Phase 2 — the database

From Phase 2 a signed handover is recorded, not just emailed. Several of the
limitations listed above no longer apply; the list has been annotated.

### First-time setup

```
docker compose up -d --wait db     # or: pnpm db:up
pnpm db:migrate                    # creates the tables
pnpm db:seed                       # one Organisation, the 8 fleet vehicles
```

Local Postgres is `zuriauto-site-db` on **port 5434** — not 5433, which the
earlier project at `D:Personalzuriauto` already uses for its own database.

### New environment variables

All documented in `.env.local.example`. Four groups:

| Key | What it is |
|---|---|
| `DATABASE_URL` | Postgres. Neon, EU region, in production. |
| `ORGANISATION_NAME` | Name on the single Organisation row the seed creates. |
| `APPLY_SECRET` | The key in the /apply link. Without it the form refuses to open and the endpoint returns 401. |
| `RATE_LIMIT_SALT` | Salt for hashing client IPs. Any long random string. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Object storage for ID scans, licences, signatures, photos and the PDF. |

Unset in development, R2 falls back to an in-memory store and warns. Unset in
**production the app refuses to start** — a deploy that silently discarded
every ID scan while reporting success is the worse failure.

### The link the office uses

```
https://zuriauto.ch/apply/?k=<APPLY_SECRET>
```

Without `?k=`, the page shows "Link nicht gültig" and no form. This is checked
at load, not at submit, so nobody photographs four documents and signs before
being told the link was bad.

**Do not reuse this key for the Phase 4 return form.** That one is opened by
renters from an email; mailing customers the office key would give every past
renter permanent write access. It uses Phase 3 single-use tokens instead.

### Taking a car off the road — no deploy

```sql
UPDATE "Car" SET status = 'maintenance' WHERE plate = 'ZH 886 530';
```

It disappears from the picker on the next page load. `available`, `rented`,
`maintenance`, `retired`. Identity — model, plate, chassis number — stays in
`lib/rental/fleet.ts` and is reconciled by `pnpm db:seed` on every deploy;
the seed never touches status.

### Who was driving on the 10th at 14:30?

`driverAt()` in `lib/rental/lookup.ts`, or in SQL:

```sql
SELECT cu.*, c."contractNumber"
FROM "Rental" r
JOIN "Car" ca ON ca.id = r."carId"
JOIN "Customer" cu ON cu.id = r."customerId"
LEFT JOIN "Contract" c ON c."rentalId" = r.id AND c.kind = 'PICKUP'
WHERE ca.plate = 'ZH 589 864'
  AND r."startAt" <= '2026-08-10 14:30' AND r."endAt" > '2026-08-10 14:30'
  AND r.status <> 'CANCELLED';
```

### Data protection

Storing identity documents is a new obligation. See `docs/DATA-RETENTION.md` —
**the retention period still needs the owner's sign-off before production.**

### Running the tests

```
pnpm test        # pure logic, no services
pnpm test:db     # needs the database up; truncates every table between tests
pnpm test:all
```

## Testing it locally

```
npm run dev
```

Then open `http://localhost:3000/pickup/`. Camera capture needs a real
phone; on desktop the photo fields fall back to a file picker.
