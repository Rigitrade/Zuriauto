# Multi-company Phase A — Walls Between Companies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every office endpoint reads and writes only the signed-in account's company, and every public form, job and the public fleet works on one named company (ZURIAUTO), so a second company can exist in the database without seeing or touching ZURIAUTO's records.

**Architecture:** `requireAdmin` returns the account's `organisationId`, read from the account row. Each admin route uses that id instead of `prisma.organisation.findFirst()`, and every lookup by id includes the company (directly, or through the parent for tables without the column). List queries in `lib/` take `organisationId` as an argument. Public code resolves its company through `lib/organisation.ts` (`siteOrganisation()`, plus `organisationBySlug()` for the phase-C company links). `Organisation.slug` is added now, with ZURIAUTO = `zuriauto`.

**Tech Stack:** Next.js 15 App Router, Prisma 7 / Postgres, zod, Vitest (`unit`, `db`).

**Spec:** `E:\Personal\Ahmed Katamish\Zuriauto-Multi-Company-Design.html`, section 4 (Phase A).

## Global Constraints

- **No visible change for ZURIAUTO.** Same screens, same data, same responses for its own staff.
- Another company's record answers **404 `not-found`** (never 403, never the record).
- No `prisma.organisation.findFirst()` may remain in `app/` or `lib/`. Scripts in `scripts/` and `prisma/seed.ts` may keep it, because they are ZURIAUTO-only tools; mark them with a comment.
- `siteOrganisation()` = the company whose id is in env `SITE_ORGANISATION_ID`, else the company with slug `zuriauto`, else the oldest by `createdAt`. Cached per process.
- Reserved slugs (refused for companies): `admin, api, book, pickup, return, privacy, gtc, availability, fines, rental, partner, _next, public, static, favicon.ico, robots.txt, sitemap.xml, icon.jpg`. Slug pattern `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`.
- The daily run, reminders and the TWINT job keep their current behaviour. The TWINT job books into `siteOrganisation()` only. Per-company jobs come in phase C.
- User rule: branch `feat/multi-company`, **no commit, push, merge or deploy without the user's explicit OK**. The "Stage" steps mean "leave in the working tree and note in the ledger".

## Review Focus

1. Company B's staff opening A's document, contract PDF, fine letter or payment-proof file by id → 404, and no `AssetAccess` row is written (Task 3 enumerated test).
2. List endpoints (overview, fines, payments, owed, mails, history) for company B → none of A's plates, renter names or ids in the JSON (Task 3).
3. B's staff writing to A's records (close rental, waive or reopen charge, payment actions, fine actions, car edit, account edit) → A's rows unchanged (Task 3 snapshot).
4. Creating a car or account in company B with the same plate or username as in A → allowed (uniques are per company); the response refers to B's row (Task 4).
5. The public fleet and the pickup and return forms with two companies present → only ZURIAUTO's cars (Task 6).

---

### Task 1: The session carries the company

**Files:**
- Modify: `lib/admin/session.ts` (`AdminIdentity.organisationId: string`; `requireAdmin` selects it)
- Modify: `app/api/admin/session/route.ts` (no change in response shape, verify only)
- Test: `tests/db/adminSession.test.ts` (add)

**Interfaces:**
- Produces: `AdminIdentity { id; username; displayName; role: "owner" | "staff"; organisationId: string }`

- [ ] **Step 1: Write the failing test.** `"requireAdmin returns the account's company"`. Create two orgs and an account in the second, then expect `requireAdmin(req).organisationId` to be the second org's id.
- [ ] **Step 2: Run.** `npx vitest run --project db tests/db/adminSession.test.ts`. Expected: FAIL (`organisationId` undefined).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS. `npx tsc --noEmit` is clean.
- [ ] **Step 5: Stage.**

### Task 2: Company resolution for public code, and `Organisation.slug`

**Files:**
- Modify: `prisma/schema.prisma` (`Organisation.slug String? @unique`)
- Create: `prisma/migrations/20261115120000_organisation_slug/migration.sql`. It adds the column and sets `zuriauto` on the oldest organisation (no-op on an empty DB).
- Create: `lib/organisation.ts`, `lib/organisation.test.ts`, `tests/db/organisation.test.ts`
- Modify: `prisma/seed.ts` (`ensureOrganisation` creates with `slug: "zuriauto"`)

**Interfaces:**
- Produces:
  - `isValidCompanySlug(slug: string): boolean` (pattern and reserved list from Global Constraints)
  - `siteOrganisation(client?: PrismaClient): Promise<{ id: string; slug: string | null }>`, which throws `NoOrganisation` when none exists
  - `organisationBySlug(slug: string, client?): Promise<{ id: string; slug: string } | null>`
  - `resetSiteOrganisationCache(): void` (tests)

- [ ] **Step 1: Write the failing tests.**
  - Unit:
    - `"accepts meier and auto-meier-2"`;
    - `"refuses admin, pickup, GTC (any case), -meier, a, and 40-char names"`.
  - DB:
    - `"siteOrganisation prefers SITE_ORGANISATION_ID, then slug zuriauto, then the oldest"`;
    - `"organisationBySlug finds by slug and returns null for unknown"`.
- [ ] **Step 2: Run.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the schema change, the migration (generated with `prisma migrate diff --from-config-datasource`, after checking the SQL file contains only SQL), the module and the seed.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Stage.**

### Task 3: The isolation test (two companies, every office endpoint)

**Files:**
- Create: `tests/db/companyFixture.ts`, `tests/db/companyIsolation.test.ts`

**Interfaces:**
- Produces:
  - `buildCompany(label: "A" | "B"): Promise<CompanyFixture>`. It creates an org (slug `co-a` / `co-b`), an owner account, a car with a distinctive plate (`ZH 9100A1` / `ZH 9200B2`), a renter (`Annabelle Zzyzx` / `Bertram Yyxw`) and a weekly ACTIVE rental with:
    - a PICKUP contract carrying a `pdfKey` and an Asset (ID_FRONT) whose objects are in the memory store;
    - one REQUESTED charge;
    - one UNMATCHED payment (`NEEDS_REVIEW`);
    - a CarRepair;
    - a fine in NEEDS_REVIEW with a FineDocument and a FinePaymentProof;
    - a PaymentMailIssue.
    It returns every id and the cookie headers.
  - `snapshot(f: CompanyFixture): Promise<string>`: a JSON of the status and updatedAt-like fields of every row above, used to prove nothing changed.

- [ ] **Step 1: Write the test.**
  - `it.each(ROUTES)` over every `app/api/admin/**/route.ts` handler except `session`. `ROUTES` is built by walking the folder, so a new route can't be missed. The test asserts that the walk and the `CASES` map cover the same set.
  - For each `{ file, method }`, `CASES[file][method]` gives the params built from fixture A's ids by name (`id`, `repairId`, `key`) and a JSON body that A's own owner could send successfully. Each body is taken from that route's zod schema.
  - The test:
    1. builds A and B;
    2. takes `before = snapshot(A)`;
    3. calls the route as B's owner and expects status not in 200–299, or, for routes without an id param, a body whose text contains none of A's plate, renter last name, or any of A's ids;
    4. expects `snapshot(A)` to equal `before`;
    5. expects no `AssetAccess` row with `userId` = B's owner;
    6. as a control, calls the same request as A's owner and expects the response not to be `404 not-found`. This proves the params and body actually reach A's record.
- [ ] **Step 2: Run.** `npx vitest run --project db tests/db/companyIsolation.test.ts > .superpowers/sdd/<ws>/t3.log`. Expected: many FAIL. List them in the ledger; that list is the work list for Tasks 4–5.
- [ ] **Step 3: Stage** (the test stays red until Task 5).

### Task 4: Office endpoints use the account's company

**Files:** every route on the Task 3 failure list, plus the `lib/` functions they call that read by id or list without a company. Expected at least:
- `app/api/admin/{assets/[id], cars/**, charges/**, contracts/**, fines/**, overview, payments/**, rentals/**, users/**}/route.ts`
- `lib/fines/queries.ts` (`listFines(client, organisationId, tab, now)`)
- `lib/payments/queries.ts` (`paymentList(client, organisationId, tab)`, `paymentMailIssues(client, organisationId)`, and the other exported list functions gain `organisationId` as their second parameter)
- Create: `lib/admin/scope.ts`

**Interfaces:**
- Produces: `lib/admin/scope.ts`:
  - `inCompany = { car, rental, contract, charge, payment, fine, fineDocument, paymentMailIssue, adminUser, carRepair }`: each is `(client, organisationId, id) => Promise<boolean>`, using the column directly.
  - `assetInCompany(client, organisationId, assetId)` goes through `contract.organisationId`.
  - `finePaymentProofInCompany(client, organisationId, proofId)` goes through `fine.organisationId`.
- Rule: a route checks its record with these helpers (or adds `organisationId` to its own `where`) **before** any read of the record's contents or any write, and returns `404 { code: "not-found" }` when it fails. `prisma.organisation.findFirst()` is replaced by `user.organisationId`.

- [ ] **Step 1:** The failing test is Task 3's. Work through the failure list one route group at a time: cars, rentals and contracts and assets, charges and payments, fines, users and overview.
- [ ] **Step 2:** After each group, run `companyIsolation.test.ts` and the group's existing DB tests (`adminCars`, `adminCloseRental`, `adminDocuments`, `adminOverview`, `adminUsers`, `fine*`, `payment*`, `officePayment`, `rentalAccount`, `weeksAfterClose`). Expected: that group's cases turn green; the existing tests are unchanged against the baseline (the 48 known date failures may remain, nothing new).
- [ ] **Step 3:** When the whole Task 3 test is green: `npx tsc --noEmit` is clean, and `grep -rn "organisation.findFirst" app lib` shows only public routes and jobs (Task 5 removes those).
- [ ] **Step 4: Stage.**

### Task 5: Public routes and jobs use `siteOrganisation()`

**Files:**
- Modify:
  - `app/api/rental-contract/route.ts`, `app/api/rental-return/route.ts`, `app/api/rental-return/prefill/route.ts`
  - `app/api/customers/lookup/route.ts`, `app/api/availability-alerts/route.ts`
  - `app/api/fleet/route.ts` (adds `organisationId` to its `where`)
  - `app/api/cars/[slug]/photo/route.ts` (car by slug within the site company)
  - `lib/payments/twint/pass.ts`, `lib/payments/twint/dryRun.ts`
  - `app/api/rental/extend`, `app/api/rental/return-intent`, `app/api/fines/proof` (token routes: verify they resolve through the token's own rental and need nothing more)
  - `scripts/*.ts` and `prisma/seed.ts`: one comment line each, "ZURIAUTO-only tool".
- Test: `tests/db/companyPublic.test.ts`

- [ ] **Step 1: Write the failing tests.** With companies A (= site, slug `zuriauto`) and B:
  - `"the public fleet lists only the site company's cars"`;
  - `"the pickup form refuses a car of another company as unknown"`: post a contract for B's car slug, expect 400 or 404 and no rental created;
  - `"the return form and its prefill do not see another company's rental"`;
  - `"customer lookup does not find another company's renter"`;
  - `"a car photo of another company is not served by slug"`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the new test and the related existing DB tests (`fleetRoute`, `persistPickup`, `persistReturn`, `returnPrefillRoute`, `customerLookupRoute`, `availabilityPass`, `carPhotoAndAlerts`, `payment*`). Expected: green except the known baseline failures. `grep -rn "organisation.findFirst" app lib` returns nothing.
- [ ] **Step 5: Final checks:**
  - `npx tsc --noEmit`, `npx eslint`, `npx vitest run --project unit`;
  - `npx vitest run --project db` > log, compared with the baseline: the same 48 known failures, no new ones;
  - `npx next build --turbopack` (with dummy env as needed).
- [ ] **Step 6: Stage**, and write the HTML report for the user.
