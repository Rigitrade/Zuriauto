# Phase 5, stage 1 — accounts for the fleet dashboard

**Date:** 2026-08-28
**Status:** accepted
**Scope:** Named accounts, two roles, account management, and the dashboard
rewrite that comes with them — German and English, refreshed layout.

Stage 1 of three. Stage 2 is the rentals review page with owner-only access to
signed contracts; stage 3 is `admin.zuriauto.ch`. Both are separate specs and
neither is designed here.

## Problem

`/admin` is opened with a single shared code. One value, held by everybody,
pasted into whatever chat delivered it. That was the right trade for a page that
did not exist yet — the roadmap put named accounts in Phase 5 precisely because
they are needed when the dashboard becomes real, and it now is: it manages the
fleet, closes rentals, and since Phase 4 confirms returns.

What the shared code cannot do is name anybody or exclude anybody. There is no
record of who retired a car, and no way to stop one person signing in without
changing the code for all ten. `lib/admin/session.ts` says both limitations out
loud and defers them here.

## What this is not

**It is not attribution on contracts.** See decision 6 — this matters and is
easy to assume otherwise.

**It is not a permission system.** Two roles, one guard. Capability-level
permissions were considered and rejected as unearned at ten accounts.

**It is not self-service.** No signup, no email invitations, no password-reset
links. The owner sets passwords and hands them over. The consequence, accepted
deliberately: a password stays valid in whatever message delivered it until
somebody changes it.

## Decisions

### 1. Accounts in the database, two roles

`AdminUser` rows, `owner` or `staff`.

An owner does everything a staff member does, plus creating accounts, setting
passwords, changing roles and disabling people. Staff manage the fleet, close
rentals and confirm returns — everything the dashboard does today — and may
change their own password and nothing else.

Two roles rather than one because a staff member should not be able to quietly
mint a second login for themselves, and that costs exactly one enum column and
one guard. Two rather than five because nothing in the office's description
distinguishes a third kind of person, and a capability matrix nobody asked for
is a matrix nobody maintains.

### 2. scrypt, from `node:crypto`

No new dependency, no native build to fail on Vercel, and the same module every
other credential in this codebase already goes through — `createHmac` for the
session cookie, `timingSafeEqual` for the write fence, `randomBytes` for action
tokens.

Rejected: `bcryptjs`, which is a dependency for something the standard library
does; `argon2`, which is better in the abstract and needs native bindings that
have to survive a serverless build.

The stored value carries its own parameters:

```
scrypt$16384$8$1$<salt base64url>$<hash base64url>
```

Reading the cost out of the hash rather than a constant means raising it later
is a change to new passwords only, with old ones still verifying. A constant
would silently invalidate every existing password the day somebody edited it.

`N=16384, r=8, p=1` needs about 16 MB, which fits inside Node's default
`maxmem` — worth knowing, because exceeding it fails at verification time
rather than at startup.

Comparison is `timingSafeEqual` over the derived key, for the reason the write
fence gives: an auth path should not use `===`.

### 3. The cookie keeps its shape; `ADMIN_SECRET` keeps its name

The session stays a signed, expiring cookie rather than becoming a row. What
changes is the payload, which gains the user id and the moment it was issued:

```
admin.<userId>.<issuedAt>.<expiresAt>   +  HMAC over that
```

`ADMIN_SECRET` stays in the environment under the same name, but its job
narrows from *being the password* to *signing sessions*. Keeping the name means
no environment churn on any deployment; the variable is already set everywhere,
and renaming it would break every configured environment for no gain. Its
meaning is documented at the top of `lib/admin/session.ts`.

Rotating it still signs everyone out, which stays the emergency lever.

### 4. Revocation costs one database lookup, and is worth it

A purely stateless cookie cannot be withdrawn before it expires. Disabling
somebody who is holding a twelve-hour session would do nothing until the
evening, which is not what "disable" means.

So validation, after verifying the signature and the expiry, loads the user and
checks two things:

- `disabledAt` is null — **disabling somebody logs them out on their next click**
- `credentialsChangedAt` is not newer than the cookie's `issuedAt` —
  **changing a password kills that person's other sessions**

One indexed read per admin request. The dashboard serves a handful of requests
a day from one office, so the cost is irrelevant and the property is not.

The mechanical consequence is the real cost. The existing
`requestIsAdmin(request): boolean` is **replaced** by
`requireAdmin(request): Promise<AdminUser | null>` — async, because it reads
the database, and returning the user because every caller now wants to know
who. Every admin route changes at its first line. That is a wide, shallow edit
and it is where most of the work is.

### 5. Seeding: create if absent, never overwrite

The preset owner comes from `ADMIN_OWNER_USERNAME` and
`ADMIN_OWNER_PASSWORD`, upserted by `pnpm db:seed` — the same split the fleet
uses, where code owns identity and the database owns everything mutable.

**The seed is run by hand — `pnpm db:seed` — against a live database,
possibly more than once, so it must never write a password that already
exists.** Otherwise a re-run silently resets the owner's password to
whatever is currently in the environment variable, and the person who
changed it last week is locked out with no error anywhere. (There is no
`prisma.seed` hook in `package.json` and no seed step in `vercel.json`; a
Vercel deploy never runs this on its own.) Same rule as `seedFleet`, which
reconciles identity and never touches status.

Two consequences worth stating:

- Deleting the owner row in the database and redeploying recreates it from the
  environment. That is the way back in, and it is deliberately a database
  operation rather than anything the dashboard offers.
- A *forgotten* owner password is not recoverable through the seed, by design.
  `scripts/set-admin-password.ts`, run with `DATABASE_URL` like the other
  backfills, is the recovery path.

### 6. What attribution does and does not buy

Dashboard actions get a name: who closed a rental, who added a car, who retired
one, who disabled an account.

**Contracts do not.** The three `createdBy: "office"` writers live in
`persistPickup` and `persistReturn`, and both are reached from public forms —
the pickup form is opened from a WhatsApp link behind `APPLY_SECRET`, the return
form has no credential at all. There is no signed-in user in either request, so
there is nothing to attribute to.

`Contract.createdBy` and `Rental.createdBy` therefore keep saying `"office"`
after this ships. Recorded here because "named accounts fill `createdBy`" is
the obvious assumption and it is wrong. Real attribution on a handover is a
question about how the office works — whether staff sign in to open the pickup
form at all — not something accounts deliver on their own.

What does change: `rental.closed.manual` events record the user, so "who freed
this car" becomes answerable.

### 7. Delete, only where it cannot lose anything

`DELETE /api/admin/cars/[id]` succeeds only when the car has no rentals.

Anything with history returns 409 and says to retire instead. A car row is
pointed at by every rental and every contract naming it, so deleting one with
history would either be refused by the database or — worse, if the foreign keys
were relaxed to allow it — break the traffic-fine lookup and orphan signed
contracts under a ten-year retention obligation.

`retired` remains the delete that is safe: the car leaves the picker and stays
in the history. Delete exists for exactly one case, the typo somebody just
added.

### 8. Dashboard strings live beside the dashboard

`lib/admin/labels.ts`, a `de`/`en` table shaped like `lib/rental/labels.ts`,
and outside the i18n catalogue for the reason that file already gives: the
dashboard is a self-contained tool, and routing it through `t()` means adding
keys to `locales/de.ts`, `locales/en.ts` and `types/i18n.ts` for strings
nothing else uses.

German stays the default, matching the rest of the site. The choice is
remembered in `localStorage` — a per-browser convenience, not a per-account
setting, because it is not worth a column and a migration.

### 9. The rewrite is for legibility, not decoration

The dashboard is used standing at a desk, often on a phone, and it is now the
place a return is confirmed. So the effort goes into reading it at a glance:

- A header carrying the organisation, the signed-in person, the language
  toggle and sign out.
- Counters where colour carries meaning rather than just size, and returns
  awaiting confirmation read as the one demanding action.
- The fleet as a table with status pills and inline edit, replacing a stack of
  forms. Plates in tabular figures so the column aligns.
- Rentals as rows with awaiting-confirmation pinned to the top — which is
  already true of the query, and should be true of the page.
- Larger tap targets, and every destructive action confirmed the way closing a
  rental already is.

Rewriting every component is not extra scope here; it is the consequence of
decision 4, which changes each one's first line anyway. Doing the layout and
the labels in the same pass is cheaper than touching them twice.

## Schema

```prisma
enum AdminRole {
  owner
  staff
}

/// A person who can sign into the fleet page.
///
/// Disabled, never deleted: an event that says a rental was closed by this
/// person has to keep resolving after they leave.
model AdminUser {
  id             String @id @default(cuid())
  organisationId String

  /// Lowercased and trimmed on write. `[a-z0-9._-]{3,32}`.
  username    String
  /// What attribution shows, e.g. "Eng Ahmed".
  displayName String
  role        AdminRole @default(staff)

  /// scrypt$N$r$p$salt$hash — parameters travel with the hash so the cost can
  /// be raised without invalidating existing passwords.
  passwordHash String

  /// Set to disable. Checked on every request, so it takes effect at once.
  disabledAt DateTime?
  /// Bumped when the password changes, which invalidates every cookie issued
  /// before it.
  ///
  /// Deliberately not bumped on a role change: the cookie carries no role, so
  /// a demotion is already in force on the demoted person's next request.
  credentialsChangedAt DateTime @default(now())
  lastSignInAt         DateTime?

  createdAt DateTime @default(now())
  /// The owner who created this account. Null for the seeded one.
  createdById String?

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, username])
  @@index([organisationId, disabledAt])
}
```

One additive change to an existing table. The IP limiter needs its own budget
per endpoint:

```prisma
model SubmissionAttempt {
  // …
  /// Which fence recorded this attempt: "pickup", "return", "signin".
  ///
  /// Added because a shared budget lets a burst against one endpoint starve
  /// another — the reasoning already written in app/api/rental-return/route.ts
  /// for keeping that route's limiter its own.
  scope String @default("pickup")

  @@index([scope, ipHash, createdAt])
}
```

Both migrations are additive; nothing existing changes shape.

## Endpoints

| Route | Guard |
|---|---|
| `POST /api/admin/session` | none — username and password, IP-limited under scope `signin` |
| `DELETE /api/admin/session` | any signed-in user |
| `GET /api/admin/overview` | any signed-in user |
| `POST /api/admin/cars` | any signed-in user |
| `PATCH /api/admin/cars/[id]` | any signed-in user |
| `DELETE /api/admin/cars/[id]` | any signed-in user; 409 if the car has rentals |
| `POST /api/admin/rentals/[id]/close` | any signed-in user |
| `GET /api/admin/users` | **owner** |
| `POST /api/admin/users` | **owner** |
| `PATCH /api/admin/users/[id]` | **owner**, except that any user may change their own password |

`requireAdmin(request)` returns the user or null; `requireOwner(request)` also
checks the role. One helper each, used at the first line of every handler.

### Locking yourself out

`PATCH /api/admin/users/[id]` refuses, with 409, to disable or demote **the
last enabled owner**. Without that check a single mis-click leaves an office
with a dashboard nobody can administer and no way back except the database.

## Fail-closed behaviour

Consistent with the four already documented in the deploy runbook:

- **No `ADMIN_SECRET`** — no cookie can be signed or verified, so nobody is
  signed in. `sign()` throws and `adminSessionValid` catches it, which is
  already how it behaves.
- **No `AdminUser` rows** — every sign-in is refused. The dashboard is
  unusable rather than open. `pnpm db:seed` with `ADMIN_OWNER_*` set is the
  way in.
- **A wrong password, an unknown username, a disabled account** — one answer,
  401, as today. A caller learns only that they are not in.

## Testing

**Unit** — no database:

- `scrypt` round trip; a wrong password fails; a tampered hash string fails;
  parameters are read from the stored value, so a hash written at a lower cost
  still verifies.
- Cookie payload: signed and verified; a rewritten expiry fails; a rewritten
  user id fails.
- Username normalisation and validation.
- `carSlug` is unchanged — a regression guard, since delete now exists near it.

**Database:**

- Sign in, get a cookie, reach `/api/admin/overview` with it.
- Disable the user → the same cookie is refused on the next request.
- Change the password → cookies issued earlier are refused, a new sign-in works.
- Staff reaching `/api/admin/users` gets 403; an owner gets the list.
- Staff may change their own password; staff may not change anybody else's.
- Disabling the last enabled owner is refused with 409; disabling one of two
  owners succeeds.
- `DELETE` a car with no rentals succeeds; with a rental it is refused and the
  car survives.
- The seed creates the owner when absent and **does not** overwrite an existing
  password on a second run.
- Sign-in attempts are limited under their own scope, and exhausting that
  budget does not affect the pickup endpoint's.

## Migration and rollout

Two additive migrations, one deploy. At the changeover the shared code stops
working and everybody signs in with an account, which is why
`ADMIN_OWNER_USERNAME` and `ADMIN_OWNER_PASSWORD` have to be set in the
environment **before** the deploy that carries this.

There is no transition to manage: `/admin` has never run in production. On
preview it has, so whoever is testing signs in with the seeded owner
afterwards.

## Open questions

1. Should a staff member be able to see the fleet page's counters for
   *contracts* and *mail failed*? They are organisation-wide health numbers
   rather than per-car facts. Left visible to both roles for now; it is a
   one-line change if not.
2. Should `lastSignInAt` be shown on the accounts list? Useful for spotting a
   login nobody uses, and it is one more thing on a small screen. Included,
   easily dropped.
3. Sessions last twelve hours, unchanged from the shared-code design. With real
   accounts a longer session is more defensible and a shorter one more
   cautious; nothing here depends on the number.
