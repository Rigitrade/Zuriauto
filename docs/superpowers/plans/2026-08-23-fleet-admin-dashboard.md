# Fleet Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hidden, secret-gated page where the office can add, edit and retire cars, see what is out on rental, close a rental that has come back, and read the system's state without a SQL client.

**Architecture:** `/admin` is unlinked and `noindex`. A sign-in form exchanges a new `ADMIN_SECRET` for an httpOnly cookie carrying a signed, expiring session token; every admin endpoint verifies that cookie. One `GET /api/admin/overview/` populates the whole page; three small writes change it. No schema migration — `CarStatus` already has `retired` and `RentalStatus` already has `COMPLETED`.

**Tech Stack:** Next.js 15.5 App Router, Prisma 7.9, PostgreSQL 18, Zod v4, Vitest (`unit` + `db`).

**Spec:** none. Approved in conversation on 2026-08-23; the decisions are recorded in "Decisions" below rather than in a separate design document, because this is one page over an existing schema.

## Global Constraints

- **Every route file** declares `export const runtime = "nodejs"`.
- **`trailingSlash: true`** — fetch admin endpoints with the trailing slash or a POST loses its body to a 308.
- **`ADMIN_SECRET` is a new variable, never `APPLY_SECRET`.** See decision 1.
- **The dashboard never writes `rented`, and never moves a car out of it.** Only closing a rental does. See decision 4.
- **No delete.** Retire only. See decision 3.
- **One off-road status.** Expose `available` and `retired` only; `maintenance` stays in the enum, unused.
- **Unit tests** in `lib/**/*.test.ts`, **DB tests** in `tests/db/**/*.test.ts`. Add any new table to the TRUNCATE list in `tests/db/setup.ts`.
- **Commit after every task**, conventional prefix, `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` trailer.

## Decisions

1. **A new `ADMIN_SECRET`, not `APPLY_SECRET`.** The pickup key is pasted into WhatsApp by staff and leaks the moment a link is forwarded; `lib/applyKey.ts` carries an explicit warning against generalising it. A page that can rewrite the fleet must not share a semi-public credential.

   Accepted limitation, stated plainly because it will matter later: this is one shared secret, so there is no per-person attribution and no revoking one person's access. Rotation is changing the variable. Named accounts — and with them real values for the `createdBy` columns that have said `"office"` since Phase 2 — remain Phase 5.

2. **A cookie, not `?k=`.** The pickup form is opened once from a link, so a URL secret is an acceptable trade there. This page is opened daily, and a URL secret would accumulate in history, bookmarks and referrer headers. The cookie holds an HMAC-signed token rather than the secret itself, following `lib/rental/reuseToken.ts`, so the stored value expires on its own and is not the credential.

3. **Retire, never delete.** A car with rentals against it cannot be removed: `driverAt` reaches back through `Rental` to attribute traffic fines, and a contract naming a plate that no longer exists is a broken commercial record. Retiring hides it from the picker — `/api/fleet/` already returns only `available` — and keeps every row that points at it.

4. **The dashboard never touches `rented`.** Allowed transitions are `available → retired` and `retired → available`. A `rented` car is freed by closing its rental, which is one action that moves both rows in a transaction.

   Rejected: letting the office set a rented car to `available`. That would leave a rental row saying someone is driving it while the picker offers it to the next customer — the exact double-handover that `persistPickup` already refuses to create.

5. **Closing a rental is an administrative override, and is labelled as one.** It sets `COMPLETED`, frees the car, and writes a `RentalEvent` so the action is attributable to the moment it happened. It is not the return protocol — the Phase 4 return wizard records mileage, fuel, damage and a signature. This exists because the alternative today is hand-written SQL.

6. **The slug is derived once, at creation, and never changes.** `Car.slug` is what the pickup form submits as `vehicleId`, so it has to be stable across an edit that corrects a plate. Derived as `slugify(model)-slugify(plate)`; uniqueness follows from `@@unique([organisationId, plate])`.

## File structure

| File | Responsibility |
|---|---|
| `lib/admin/session.ts` | Issue and verify the signed session token; the cookie name |
| `lib/admin/cars.ts` | Slug derivation, the create/update schemas, the status-transition rule |
| `app/api/admin/session/route.ts` | POST to sign in, DELETE to sign out |
| `app/api/admin/overview/route.ts` | GET: cars, active rentals, counts — the whole page in one call |
| `app/api/admin/cars/route.ts` | POST: add a car |
| `app/api/admin/cars/[id]/route.ts` | PATCH: edit fields or change status |
| `app/api/admin/rentals/[id]/close/route.ts` | POST: complete a rental and free its car |
| `app/admin/page.tsx` | Route shell, `noindex` |
| `components/admin/AdminDashboard.tsx` | Sign-in form and the three panels |

---

### Task 1: The admin session

**Files:** Create `lib/admin/session.ts`, `lib/admin/session.test.ts`

**Produces:** `ADMIN_COOKIE`, `ADMIN_SESSION_TTL_MS`, `adminSecretValid(supplied: string): boolean`, `issueAdminSession(now?: Date): string`, `adminSessionValid(token: string | undefined, now?: Date): boolean`

- [ ] **Step 1: Write the failing test** — round trip valid; expired rejected; tampered rejected; wrong-secret-signed rejected; missing cookie rejected; `adminSecretValid` false when `ADMIN_SECRET` unset (fail closed) and false for a wrong value; issuing without the secret throws.
- [ ] **Step 2: Run** `pnpm test -- admin/session` — expect module-not-found.
- [ ] **Step 3: Implement.** HMAC over `admin.<expiry>` keyed with `ADMIN_SECRET`, base64url, 12-hour TTL, `timingSafeEqual` with the length guard used in `lib/applyKey.ts`. Fail closed when the variable is absent.
- [ ] **Step 4: Run** — expect pass.
- [ ] **Step 5: Commit** `feat: add a signed admin session behind its own secret`

---

### Task 2: Car rules

**Files:** Create `lib/admin/cars.ts`, `lib/admin/cars.test.ts`

**Produces:** `carSlug(model: string, plate: string): string`, `newCarSchema`, `updateCarSchema`, `OFF_ROAD: "retired"`, `statusChangeAllowed(from: CarStatus, to: CarStatus): boolean`

- [ ] **Step 1: Write the failing test.**
  - `carSlug("Toyota Prius Hybrid", "ZH 513 925")` → `"toyota-prius-hybrid-zh513925"`; diacritics folded; punctuation collapsed to single hyphens; no leading or trailing hyphen.
  - `newCarSchema` rejects an empty model, an empty plate, and over-long values; accepts an absent VIN; trims and upper-cases the plate.
  - `statusChangeAllowed`: `available → retired` true, `retired → available` true, `rented → available` **false**, `rented → retired` **false**, `available → rented` **false**.
- [ ] **Step 2: Run** — expect module-not-found.
- [ ] **Step 3: Implement.** The transition rule is a whitelist of the two allowed pairs, not a blacklist — anything involving `rented` is refused by omission, so a future status cannot accidentally become reachable.
- [ ] **Step 4: Run** — expect pass.
- [ ] **Step 5: Commit** `feat: derive a car slug and pin the allowed status changes`

---

### Task 3: Sign-in and overview endpoints

**Files:** Create `app/api/admin/session/route.ts`, `app/api/admin/overview/route.ts`, `tests/db/adminOverview.test.ts`

**Consumes:** Task 1. **Produces:** the cookie, and the overview payload the UI renders.

Overview shape:

```ts
{
  cars: { id, slug, model, plate, vin, status, activeRentalId }[],
  rentals: { id, carPlate, carModel, customerName, startAt, endAt, contractNumber }[],
  counts: { available, retired, rented, activeRentals, contracts, mailFailed },
  latestContractAt: string | null,
}
```

- [ ] **Step 1: Write the failing test** — POST with the right secret sets the cookie; wrong secret → 401 and no cookie; overview without the cookie → 401; overview with it returns every car including retired ones, the active rentals with customer names, and correct counts; DELETE clears the cookie.
- [ ] **Step 2: Run** — expect module-not-found.
- [ ] **Step 3: Implement.** Cookie flags: `httpOnly`, `sameSite: "strict"`, `secure` outside development, `path: "/"`, `maxAge` matching the token TTL. Overview returns all cars (unlike `/api/fleet/`, which filters to `available`) because managing them is the point.
- [ ] **Step 4: Run** — expect pass.
- [ ] **Step 5: Commit** `feat: add the admin sign-in and overview endpoints`

---

### Task 4: Adding and editing a car

**Files:** Create `app/api/admin/cars/route.ts`, `app/api/admin/cars/[id]/route.ts`, `tests/db/adminCars.test.ts`

- [ ] **Step 1: Write the failing test** — unfenced → 401; POST creates a car with a derived slug, `available`; a duplicate plate → 409 rather than a 500 from the unique constraint; PATCH edits model, plate and VIN **without changing the slug**; PATCH to `retired` succeeds from `available`; PATCH to `retired` on a `rented` car → 409; PATCH `available` on a `rented` car → 409; a retired car is absent from `GET /api/fleet/` and a re-activated one is present again.
- [ ] **Step 2: Run** — expect module-not-found.
- [ ] **Step 3: Implement.** Catch Prisma `P2002` for the plate and answer 409. The `[id]` param arrives as a promise in Next 15 — `const { id } = await params`.
- [ ] **Step 4: Run** — expect pass.
- [ ] **Step 5: Commit** `feat: add and edit cars from the admin endpoints`

---

### Task 5: Closing a rental

**Files:** Create `app/api/admin/rentals/[id]/close/route.ts`, `tests/db/adminCloseRental.test.ts`

- [ ] **Step 1: Write the failing test** — unfenced → 401; closing an active rental sets `COMPLETED`, sets the car `available`, and writes a `RentalEvent` of type `rental.closed.manual`; the car reappears in `GET /api/fleet/`; closing an already-completed rental → 409; closing an unknown id → 404; both rows move in one transaction.
- [ ] **Step 2: Run** — expect module-not-found.
- [ ] **Step 3: Implement.** One `$transaction`. The event type says `manual` on purpose: a later reconciliation must be able to tell an override from a rental closed by the Phase 4 return flow.
- [ ] **Step 4: Run** — expect pass.
- [ ] **Step 5: Commit** `feat: close a rental and return its car to the fleet`

---

### Task 6: The page

**Files:** Create `app/admin/page.tsx`, `components/admin/AdminDashboard.tsx`

- [ ] **Step 1: Build the route shell** — `export const metadata = { robots: { index: false, follow: false } }`, and confirm nothing links to `/admin` from any nav, footer or sitemap.
- [ ] **Step 2: Build the sign-in state** — a single password field posting to `/api/admin/session/`. On 401 show one message that does not say whether the secret was wrong or missing.
- [ ] **Step 3: Build the three panels** — counts across the top; the fleet table with inline edit and an off-road toggle; active rentals with a Close button behind a confirm step, since it moves two rows and is an override.
- [ ] **Step 4: Verify by hand.**
  ```bash
  pnpm db:up && pnpm db:seed && pnpm dev
  ```
  Sign in at `/admin`. Add a car and confirm it appears in the pickup picker. Retire it and confirm it disappears. Complete a pickup, confirm the car shows as rented and cannot be toggled, close the rental, confirm it returns to the picker.
- [ ] **Step 5: Run** `pnpm test:all && pnpm lint && npx tsc --noEmit`
- [ ] **Step 6: Commit** `feat: add the hidden fleet admin dashboard`

---

### Task 7: Document the new variable

**Files:** Modify `docs/DEPLOY-PHASE-2-3.md`, `app/api/health/route.ts`

- [ ] **Step 1:** Add `ADMIN_SECRET` to the health endpoint's `EXPECTED.fence` group, so a deployment missing it says so instead of answering 401 at the desk.
- [ ] **Step 2:** Add it to the runbook's variable table, with a note that it must differ from `APPLY_SECRET` and where `/admin` lives.
- [ ] **Step 3:** Run `pnpm test:all`, then commit `docs: record ADMIN_SECRET and the admin page`

---

## Self-review

**Coverage.** Decision 1 → Tasks 1, 7. Decision 2 → Tasks 1, 3. Decision 3 → Task 4 (no delete endpoint exists to test; the absence is the design) and the fleet-visibility assertions. Decision 4 → Task 2's whitelist and Task 4's two 409 cases. Decision 5 → Task 5. Decision 6 → Task 2's slug tests and Task 4's "PATCH does not change the slug".

**Type consistency.** `CarStatus` and `RentalStatus` come from `@/generated/prisma/client` throughout. The overview payload declared in Task 3 is the type the UI consumes in Task 6; nothing else defines it.

**Known risk.** No new table, so `tests/db/setup.ts` needs no change — worth re-checking if a session table is ever added.
