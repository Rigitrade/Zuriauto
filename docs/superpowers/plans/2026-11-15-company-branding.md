# Company Settings and Branding (multi-company phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every document, email and screen a renter or an authority sees carries the company that rents the car (its name, legal entity, address, office), with "powered by ZURIAUTO" for partner companies, and ZURIAUTO's own output stays byte-for-byte what it is today.

**Architecture:** One `CompanyIdentity` value per company, read from new nullable columns on `Organisation` (ZURIAUTO's filled by a data migration, and by code defaults when null). Server code loads it from the organisationId it already holds; the browser-built PDFs get the public part from `/api/fleet`. Mail keeps one shared SMTP account; only the display name, office address, reply-to and archive change per company.

**Tech Stack:** Next.js 15 App Router, Prisma 7, Postgres, pdf-lib, nodemailer, zod, Vitest (`unit`, `db`).

**Spec:** `E:\Personal\Ahmed Katamish\Zuriauto-Multi-Company-Design.html`, sections 3 (phase B) and 5 (decisions of 15.11.2026). Phase A is commit `d00176b` on `feat/multi-company`; this branch `feat/company-branding` starts from it.

## Global Constraints

- No commit, push, merge or deploy without the user's explicit OK. Work stays uncommitted on `feat/company-branding`.
- ZURIAUTO's output does not change: every renter email, office email, police letter and PDF built for ZURIAUTO is identical to today's (golden tests from Task 1 are never re-recorded).
- Branding for partners (Ahmed, 15.11.2026): the partner's name, plus "powered by ZURIAUTO".
- Email sender (deferred by Ahmed, 15.11.2026): build the shared sender — the shared `MAIL_FROM` address with the company's brand as display name, replies to the company's office.
- Payments and the data-processing agreement are deferred; GTC per company is phase C. The GTC text stays Rigitrade AG's.
- No real partner company exists before phase C (daily cross-company passes).
- Owner-only settings; another company's settings are unreachable (phase A wall).

## Review Focus

1. A company with only `name` set (no settings yet) — every document and mail still renders, using `name` as brand and legal name, with no "undefined"/"null" and no ZURIAUTO identity leaking.
2. ZURIAUTO with its columns null (an empty or pre-migration database) — still byte-identical output via code defaults.
3. `/api/fleet` failing in the browser — the wizards fall back to ZURIAUTO identity (they already fall back to ZURIAUTO's compiled fleet), never to a blank lessor.
4. Settings input with HTML/newlines (brand `A<b>`, office email list with spaces) — escaped in HTML mail, rejected or normalised by the zod schema.
5. A partner company without payment links — no SumUp/TWINT buttons or lines anywhere (never ZURIAUTO's links).

---

### Task 1: Golden output of today's ZURIAUTO

**Files:**
- Create: `lib/company/golden.test.ts` (the `unit` project includes `lib/**/*.test.ts`)

**Interfaces:**
- Produces: snapshot file `lib/company/__snapshots__/golden.test.ts.snap`, recorded on the code as it is at the start of this task and never re-recorded (`-u` is forbidden for this file).

- [ ] **Step 1:** Write snapshot tests calling today's functions with fixed inputs: `buildCustomerEmail` (de, en), every renter mail in `lib/rental/lifecycleMail.ts` (de, en), `fineNoticeMail`, `fineReopenedMail`, `fineThanksMail`, `renterNamedMail` (de, en), `driverNominationMail`, `availabilityMail`, and the text drawn into `buildContractPdf`/`buildReturnPdf` (reuse the extraction approach of `lib/rental/contractPdf.test.ts`; fixed `issuedAt`), plus `labelsFor("de"|"en")` result/email strings.
- [ ] **Step 2:** Run `pnpm vitest run --project unit lib/company/golden.test.ts`. Expected: PASS, snapshots written.

### Task 2: Company identity

**Files:**
- Modify: `prisma/schema.prisma` (`Organisation`)
- Create: `prisma/migrations/20261115140000_company_identity/migration.sql`
- Create: `lib/company/identity.ts`, `lib/company/identity.test.ts`, `tests/db/companyIdentity.test.ts`

**Interfaces:**
- Produces:
  - Columns on `Organisation`, all nullable: `brandName, legalName, street, postalCode, city, uid, phone, officeEmail, signerName, website, signingPlace, paymentUrl, twintUrl`.
  - `interface CompanyIdentity { brandName; legalName; street|null; postalCode|null; city|null; uid|null; phone|null; officeEmail|null; signerName|null; website|null; signingPlace; paymentUrl|null; twintUrl|null; poweredBy: boolean }`
  - `ZURIAUTO_IDENTITY: CompanyIdentity` — ZURIAUTO / Rigitrade AG / Schaffhauserstrasse 550 / 8052 / Zürich / CHE-199.884.159 / +41 58 513 99 96 / officeEmail null (= `MAIL_OFFICE`) / Katamesh, Ahmed / zuriauto.ch / Zurich / today's `PAYMENT_URL`, `TWINT_URL` / poweredBy false.
  - `identityOf(org: Organisation, isSite: boolean): CompanyIdentity` — site company: each null column falls back to `ZURIAUTO_IDENTITY`; other company: brand and legal fall back to `org.name`, signingPlace to `city ?? ""`, everything else stays null (never a ZURIAUTO value), `poweredBy: true`.
  - `loadCompanyIdentity(client, organisationId): Promise<CompanyIdentity>` (site = `findSiteOrganisationWith(client)`).
  - `type PublicCompany = Pick<CompanyIdentity, "brandName"|"legalName"|"signingPlace"|"paymentUrl"|"twintUrl"|"poweredBy">`, `publicCompany(id)`.
  - `signOff(id, lang): string[]` → `["Kind regards","ZURIAUTO"]`; partner adds `"powered by ZURIAUTO"`.
- [ ] Tests first: `identityOf` for site with nulls equals `ZURIAUTO_IDENTITY`; partner with only `name` uses `name`, `poweredBy` true, no field equals a ZURIAUTO value; `signOff` lines. DB test: migration fills the `zuriauto` row; `loadCompanyIdentity` for A/B fixture companies.
- [ ] Migration: add columns; `UPDATE "Organisation" SET … WHERE "slug"='zuriauto'` (no-op on an empty DB). Generate with `prisma migrate diff`, filter dotenv lines.

### Task 3: Mail envelope per company

**Files:**
- Create: `lib/company/mailEnvelope.ts` (+ test)
- Modify: `lib/rental/mail.ts`, `lib/rental/lifecycleMail.ts` (`readLifecycleMailConfig`), `app/api/rental-return/route.ts:97-131`

**Interfaces:**
- Produces: `envelopeFor(id: CompanyIdentity, env = process.env): { from: string; office: string; archive?: string } | null` — ZURIAUTO: exactly today's (`MAIL_FROM || SMTP_USER`, `MAIL_OFFICE`, `MAIL_ARCHIVE`). Partner: `from` = `"<brandName>" <address part of MAIL_FROM>`, `office` = `officeEmail` (null → envelope null: nothing sent, logged), no archive.
- [ ] Tests first for both cases and for a brand with quotes. Then the three config readers take the identity; callers that hold an organisationId pass `await loadCompanyIdentity(...)`. `recordReturn`/`PersistReturnResult` returns `organisationId`; when no rental was recorded, use the site company.

### Task 4: PDFs, wizards, fleet API, labels

**Files:**
- Modify: `lib/rental/contractPdf.ts`, `lib/rental/returnPdf.ts`, `app/api/fleet/route.ts`, `components/rental/RentalPickupWizard.tsx`, `components/rental/RentalReturnWizard.tsx`, `lib/rental/labels.ts`

**Interfaces:**
- Consumes: `PublicCompany`, `publicCompany`, `ZURIAUTO_IDENTITY`.
- Produces: `ContractPdfInput.company: PublicCompany`, `ReturnPdfInput.company: PublicCompany`; `/api/fleet` response `{ vehicles, company }`; label strings that named ZURIAUTO use the token `{company}`, filled by `withCompany(text: string, company: PublicCompany): string` in `labels.ts`.
- [ ] Tests first: partner company → PDF text has partner brand heading, "Vermieter: <legalName>", "powered by ZURIAUTO" line, signing place; no "Rigitrade" outside the GTC appendix. Fleet API returns `company` for the site company. Golden (Task 1) unchanged.
- [ ] Wizards: keep `company` from the fleet response (fallback `publicCompany(ZURIAUTO_IDENTITY)`), pass it to the PDF builders, result screen, default place, payment buttons (hidden when the URL is null). `setProducer` stays `zuriauto.ch` (the platform). GTC appendix unchanged (phase C).

### Task 5: Contract and return confirmation emails

**Files:** `lib/rental/customerEmail.ts`, `lib/rental/mail.ts`, `app/api/rental-contract/route.ts`, `app/api/admin/contracts/[id]/resend/route.ts`, `app/api/rental-return/route.ts`
- Produces: `CustomerEmailInput.company: CompanyIdentity`; `sendContractMails(meta, pdf, company)`.
- [ ] Tests first: partner HTML has escaped brand wordmark, footer `<Brand> · <legalName> · powered by ZURIAUTO`, no payment buttons when URLs null, subject with partner brand; ZURIAUTO golden unchanged.

### Task 6: Lifecycle, payment and manage mails

**Files:** `lib/rental/lifecycleMail.ts`, `lib/rental/scheduler.ts` (renter sends only), `lib/payments/mails.ts`, `lib/rental/manageActions.ts`
- [ ] Renter mail builders take `company` and end with `signOff(company, lang)`; callers load the identity from the row's organisationId (cache per pass run in a `Map`). Payment lines use the company's links or are left out. Office-only cross-company passes stay as they are (phase C).
- [ ] Tests first: one partner case per builder; golden unchanged.

### Task 7: Fine mails and the police letter

**Files:** `lib/fines/mail.ts`, `lib/fines/notify.ts`, `lib/fines/nominate.ts`, `lib/fines/proofSubmit.ts`, `lib/fines/actions.ts`, `lib/fines/nomination.ts`
- Produces: `driverNominationMail({... , company})` signature block from identity (signer, brand line = website with first letter upper-cased, "Eine Marke der <legalName>" only when brand ≠ legal, phone, street, postal code + city; null lines left out). `emailsOnLetter(text, ownDomains: string[])`; own domains = the company's website/office-email domains plus `zuriauto.ch`, `rigitrade.ch`.
- [ ] Tests first: partner letter has partner signer/address and no ZURIAUTO line; renter fine mails say "<Brand> does not collect it"; golden unchanged.

### Task 8: Settings page and admin brand

**Files:**
- Create: `app/api/admin/company/route.ts` (GET, PATCH; owner-only, own company), `lib/admin/company.ts` (zod `companySettingsSchema`), `app/admin/company/page.tsx`, `components/admin/sections/CompanySection.tsx`
- Modify: `components/admin/shell/Rail.tsx` (owner-only nav item), `components/admin/types.ts` (`Me.companyName`), `app/api/admin/overview/route.ts`, `components/admin/shell/AdminShell.tsx` (brand from `me`), `tests/db/companyIsolation.test.ts` (cases for the new route)
- [ ] Tests first: staff → 403; B's GET shows none of A's values; B's PATCH changes only B; schema rejects bad email/URL, trims, max lengths; slug is not editable.
- [ ] UI follows `AccountsSection` patterns; de/en labels.

### Task 9: Verify, review, report

- [ ] tsc, lint, unit, db (expect the 48 known failures only), `next build`.
- [ ] Final whole-branch review (opus) per executing-plans; fix Critical/Important with RED→GREEN.
- [ ] Report `E:\Personal\Ahmed Katamish\Zuriauto-Multi-Company-PhaseB-Report.html`; ledger; memory.

## Rulings made while planning (carry to the report)

- Logo stays a text wordmark of the brand name (there is no image logo today in PDFs or mail); image logo upload is later.
- GTC text and appendix stay Rigitrade AG's until phase C (Ahmed is updating the GTC).
- Mail archive BCC only for ZURIAUTO; partners' records are in the database, which ZURIAUTO sees read-only (phase D).
- Office-only cross-company passes (fine digest, mail retry, overdue alerts), WhatsApp button, contract number prefix, `SITE_URL` links: phase C.
- Payment links per company; none set → no payment buttons (never ZURIAUTO's links on a partner's mail).
