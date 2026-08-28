# Phase 6 — the fleet dashboard as a console

**Status:** design agreed, not implemented. Direction chosen from the three drawn
in `docs/admin-dashboard-options.html`; the office picked **Option C, the
console**, over the recommendation of Option A.

---

## Problem

`/admin` works and looks like a debug view. That is a fair description rather
than a harsh one, and the specific failure is not the styling:

- **Everything carries equal weight.** Seven counters sit in one flat grid.
  `returnsAwaiting` and `mailFailed` — the only two that mean a person must act
  — are fifth and seventh, beside `contracts`, which is trivia nobody acts on.
- **The rarest jobs occupy the best space.** The *add a vehicle* form is
  permanently expanded above the fleet list, and *create account* does the same
  lower down. Both are used a handful of times a year.
- **Nothing answers "what is due back today".** That is the question the phone
  is ringing about, and the data to answer it is already in the payload.
- **A blocked car is invisible.** A rental at `RETURN_SUBMITTED` keeps its car
  `rented` until somebody confirms. Today that state is a number in a tile. The
  cost of missing it is a car nobody can rent that everyone believes is out.
- **One file holds all of it.** `components/admin/AdminDashboard.tsx` is 1,017
  lines: sign-in, counters, fleet list, add-car form, rentals list, accounts
  table, create-account form and change-my-password control.

## What this is not

- **Not a redesign of `/pickup/` or `/return/`.** Different audience, different
  job, separate piece of work. Explicitly out of scope.
- **Not new capability.** Every action the console offers is one the API already
  performs, with two named exceptions in decision 5.
- **Not a component library.** Tokens and a handful of primitives, defined
  because three screens need them, not because a design system is a goal.
- **Not a mobile-first build.** The office works at a desk. Mobile has to be
  usable, not equal — decision 6.

---

## Decisions

### 1. Real routes, not client-side tabs

Each section is a route under `/admin`, not a `useState` tab index.

```
/admin/                 Overview
/admin/rentals/         Open rentals
/admin/vehicles/        Fleet
/admin/customers/       Customers          (stage 3)
/admin/contracts/       Contracts          (stage 3)
/admin/accounts/        Accounts           (owner only)
/admin/password/        My password        (everyone)
```

The office lives in this tool daily. Routes buy three things a tab index cannot:
a link to a section that can be sent to a colleague, a browser Back button that
does what it looks like it does, and per-section data fetching so opening
Accounts does not also pull every car.

The cost is that `requireAdmin` now gates several routes rather than one page.
That cost is already paid — every admin endpoint calls it on every request
(`lib/admin/session.ts`), and it is one indexed read.

### 2. The shell owns identity; sections own their data

`app/admin/layout.tsx` becomes the shell. It fetches `me` once, and renders
either the sign-in card or the rail plus the section outlet. No section
component ever renders a sign-in form, and no section refetches identity.

This is what makes the split safe. Today the single component owns identity,
data and every form at once, which is why it is 1,017 lines: there is nowhere
else for anything to go.

The shell is also the only place that handles `401` from a section fetch — a
cookie that died mid-session drops the whole console back to sign-in with
`errors.signedOut`, rather than each section inventing its own answer.

### 3. "Needs you" is a pure selector, not an endpoint

The band at the top of Overview is derived in one pure function:

```ts
// lib/admin/attention.ts
export function attentionItems(data: Overview, now: Date): AttentionItem[]
```

Three sources, in this order:

1. **Returns to confirm** — rentals at `RETURN_SUBMITTED`. Highest priority,
   because a car is blocked while this sits.
2. **Rentals ending inside 24 hours** — from `endAt`, already in the payload.
3. **Contracts whose mail never left** — see decision 4.

Pure, so it is unit-testable without a database or a browser, and that test is
the highest-value one in this whole piece of work. **A console that says
"nothing to do" while a car sits blocked is worse than today's screen**, because
today's screen at least never claimed to be complete. The selector is where that
promise is kept or broken.

An empty band renders as an explicit "Nothing waiting" state, never as absence.
Absence of a band is indistinguishable from a component that failed to render.

### 4. The overview payload has to grow, slightly

**This corrects a claim made in `docs/admin-dashboard-options.html`:** that
document says none of the three options needs API work. That is true of A and of
C's fleet, rentals and counters — and false for one row.

`mailFailed` is a `count()`:

```ts
prisma.contract.count({ where: { organisationId, mailSentAt: null } })
```

A count cannot render "C-2026-0142 · R. Fischer". So `GET /api/admin/overview`
gains one array beside the existing counters:

```ts
unsentContracts: Array<{
  id: string;
  contractNumber: string;
  customerName: string;
  signedAt: string;
}>;
```

Capped at the twenty most recent, with the existing count retained so the UI can
say "20 of 34". Nothing else about the payload changes, and `counts.mailFailed`
stays exactly as it is so no existing caller breaks.

### 5. The two new capabilities, named honestly

Everything else in the console drives an endpoint that exists. Two do not:

- **`POST /api/admin/contracts/[id]/resend`** — behind the *Send again* button.
  Owner or staff, rate-limited on its own scope, and it must be idempotent in
  the way that matters: sending twice is a duplicate email, not a corrupt
  record. It sets `mailSentAt` only on success.
- **List endpoints for Customers and Contracts** — `/admin/customers/` and
  `/admin/contracts/` have no data source today.

Both are **stage 3**. Stage 1 ships the resend row without a button — the
information alone already beats a number in a tile — and the two rail items
appear only when their endpoints do. A rail item that leads nowhere is worse
than a rail with five entries.

### 6. The rail collapses to a bar, not a drawer

Below `768px` the rail becomes a horizontal scrolling bar of the same items,
pinned under the header. Not a hamburger drawer.

Seven items fit in a scrolling bar. A drawer costs a tap before every navigation
and hides the attention badge, which is the one piece of information the console
exists to push at somebody. The badge stays visible on the Overview item at
every width.

### 7. The split follows sections, not widgets

```
app/admin/layout.tsx                 shell: identity, rail, signed-out state
app/admin/page.tsx                   Overview
app/admin/rentals/page.tsx
app/admin/vehicles/page.tsx
app/admin/accounts/page.tsx
app/admin/password/page.tsx

components/admin/shell/Rail.tsx
components/admin/shell/SignIn.tsx
components/admin/overview/AttentionBand.tsx
components/admin/overview/TodayTimeline.tsx
components/admin/overview/Counters.tsx
components/admin/vehicles/VehicleTable.tsx
components/admin/vehicles/AddVehicle.tsx      dialog, not an inline form
components/admin/rentals/RentalTable.tsx
components/admin/accounts/AccountTable.tsx
components/admin/accounts/AddAccount.tsx      dialog
components/admin/accounts/MyPassword.tsx

lib/admin/attention.ts               the selector from decision 3
lib/admin/labels.ts                  unchanged
```

Split by section rather than by widget because sections are what get worked on.
`lib/admin/labels.ts` is not touched: both language sets are complete and
correct, and every string the mockups use is already in it.

`AddVehicle` and `AddAccount` become dialogs opened from a button. That is the
fix for "the rarest job holds the best space", and it is the same move in both
places.

### 8. Design tokens, defined once

The palette drawn in the mockups becomes CSS custom properties in
`app/globals.css` under an `--admin-*` prefix: a cool near-white ground, a deep
petrol accent, and **three semantic states kept separate from the accent** —
good, attention, critical. Status is never carried by the accent colour, because
an accent that also means "fine" cannot also mean "look here".

The public site keeps its own look. The console is a staff tool and is allowed
to be visually distinct from the shopfront; the two share no components today
and should not start.

Status is never carried by colour alone: every chip pairs its colour with a
word, which is also what makes the tables readable in a screenshot pasted into
WhatsApp.

### 9. Staged so each stage ships

Not one large pull request. Each stage leaves `/admin` working:

- **Stage 1 — the shell.** Routes, layout, rail, sign-in moved into the shell,
  tokens, existing sections rehoused unchanged. No visual redesign of the
  section interiors. This is the risky refactor, isolated and shipped alone.
- **Stage 2 — Overview.** The attention band, the Today timeline, the reduced
  counter set, and `unsentContracts` on the overview endpoint.
- **Stage 3 — the sections.** Vehicles and Rentals redrawn as real tables;
  add-forms become dialogs; Accounts rebuilt per the mockup.
- **Stage 4 — the new surfaces.** Customers, Contracts, resend.

---

## Fail-closed behaviour

| Condition | What the console does |
|---|---|
| No session | Sign-in card. No rail, no section data in the HTML. |
| Session dies mid-use | Whole console returns to sign-in with `errors.signedOut`. |
| Staff opens `/admin/accounts/` | Rail never shows it; the route redirects to Overview. The API answers `403` regardless — the UI is not the fence. |
| Overview fetch fails | Band renders an error state, never an empty "nothing to do". |
| `unsentContracts` absent | Row is omitted; the counter still shows. Older deployments degrade rather than crash. |

The rule behind the third and fourth rows: **the UI never becomes the security
boundary, and never reports absence as good news.**

---

## Testing

- `lib/admin/attention.ts` — unit, no database. Every combination of the three
  sources, boundary cases at exactly 24 hours, and the empty case. This is the
  test that matters most.
- Rail badge count equals the selector's length. Guards the drift where a badge
  says 3 and the band shows 2.
- Route gating — a staff session hitting `/admin/accounts/` lands on Overview,
  and the API still answers `403` when called directly.
- `unsentContracts` — a db test that a contract with `mailSentAt: null` appears
  and one with a timestamp does not.
- The existing 360 tests must stay green throughout. Stage 1 changes no
  behaviour, so any red there is a real regression, not an expected update.

---

## Rollout

No migration. No schema change. No environment variable. Every stage is
front-end plus, in stage 2, one additive field on an existing endpoint.

The one thing to watch is that `/admin` is the office's live tool on the day
stage 1 ships. It should land on a preview and be signed into by somebody from
the office before it merges — the same rule the rest of this branch has followed.

---

## Open questions

1. **Does the office want the Today timeline at all,** or is the attention band
   enough? The timeline is the one piece of Overview that is not derived from a
   problem — it is context. Worth confirming against a real week before building.
2. **Customers: list, or search only?** Stage 4 assumes a list. If the real need
   is "find this person who is on the phone", a search box is less work and more
   useful, and would pull Option B's search idea into C's frame.
3. **Should resend be owner-only?** Sending mail on the company's behalf is
   arguably a different class of action from closing a rental. Currently
   specified as available to staff.
