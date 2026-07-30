# Publishing the new GTC (DE / EN / FR)

**Date:** 2026-07-31
**Status:** design approved; one open question blocking full consistency
**Source documents:** supplied by Ahmed Katamesh, 29 July 2026

- `AGB_GTC_Zuriauto_07.2026_DE.pdf` — 4 pages, 7,388 characters
- `GTC_Zuriauto_30.07.2026_EN.pdf` — 6 pages, 8,429 characters
- `GTC_Zuriauto_30.07.2026_FR.pdf` — 7 pages, 9,413 characters

All three are dated 30 July 2026 and signed "/ AK".

## Requirement

Ahmed's instruction: the new conditions "are a part of the contract and should be
always visible on our website." Three language versions were supplied and all
three are to be published.

## What is on the site today

`/GTC/` renders styled HTML text, not a PDF: a heading reading
"ALLGEMEINE GESCHÄFTSBEDINGUNGEN & MIETVERTRAG / ZURIAUTO (DIGIHOME SWISS AG)",
then a white card containing 13 numbered sections. Roughly 3,800px tall,
switching between German and English with the site language toggle.

Content comes from the `terms:` namespace in `locales/de.ts` and `locales/en.ts`.
That namespace is consumed **only** by `components/GTC.tsx`, so replacing it is
contained and affects nothing else.

The new terms are substantively different from the current text, not a reworded
version. They add GPS tracking and remote vehicle immobilisation, a contractual
penalties table, and an administrative fees table. None of these appear in the
text currently published.

## Decisions

1. **Replace, do not supplement.** The old inline Digihome Swiss AG text is
   removed from the page. Publishing two sets of terms from two different legal
   entities simultaneously would let a customer argue the superseded ones
   applied. The old text remains recoverable from git history.
2. **Styled text, no PDF links.** The new terms render as HTML in the existing
   card layout, preserving today's mobile experience and search indexing. A PDF
   embed would be a visible downgrade from what the site already has.
3. **French lives on the GTC page only.** The page gets its own three-way
   selector (Deutsch / English / Français) governing the terms text. Site chrome
   stays German/English. Adding French as a full site language was rejected: the
   FR PDF covers only the GTC, so every other string — navigation, the three-step
   booking wizard, footer, privacy policy — would have to be invented.
4. **Selector defaults to the site language.** German or English to match the
   main toggle; French reachable only by explicit selection.

## Architecture

**`locales/gtc.ts` (new).** The terms as typed data keyed by
`"de" | "en" | "fr"`. Deliberately outside the i18n system, because French is not
a registered locale, the text is bulky (7–9k characters per language), and
`de.ts` and `en.ts` are already ~690 lines each.

Each language holds a `sections` array of `{ id, title, blocks }`. A block is a
paragraph, a list, or a table, so the two tables are structured data rather than
markup embedded in strings.

**`components/GTC.tsx` (rewritten).** Renders that data in the current card
layout with the same typography and spacing, plus the language selector above the
card. Tables render as real `<table>` elements inside an `overflow-x-auto`
wrapper so they scroll on mobile instead of breaking the layout.

**`locales/de.ts`, `locales/en.ts`.** The `terms:` namespace is deleted.

## Content fidelity

The data module is generated from programmatically extracted PDF text, never
re-keyed by hand. After generation, the module's prose is diffed back against the
extraction to prove nothing was altered, dropped, or reordered. The page heading
takes the entity name and the 30 July 2026 date from the documents themselves.

## Verification

Typecheck and build must pass. Then, per language: all sections present, both
tables present, the selector changes the rendered content, the prerendered body is
non-empty, and no console errors. A screenshot of each of the three languages is
captured and inspected — not just asserted against the DOM. That last point
matters: during the preceding parity work, DOM assertions passed while the entire
site rendered unstyled, and only a screenshot caught it.

## Open question — the entity conflict

**This is unresolved and needs Ahmed.**

The new GTC names a different legal entity than the website does.

| Source | Entity named |
|---|---|
| All three new PDFs, clause 1 | **Rigitrade AG** ("the Lessor") |
| `locales/*.ts` → `legalNotice:ownedBy` | **DIGIHOME SWISS AG** |
| `legalNotice:tradingRegister` | Zurich CHE-199.884.159 (Digihome) |
| Privacy policy | Digihome Swiss AG, as data controller |
| Footer | DIGIHOME SWISS AG |
| GitHub repository | `Rigitrade/zuriauto` |

`components/LegalNotice.tsx` renders at the bottom of the GTC page
(`GTC.tsx:204`). Once the new terms are published, that single page will state
Rigitrade AG at the top and Digihome Swiss AG at the bottom, leaving a customer
unable to identify their counterparty — in a document that forms part of the
contract.

Three explanations are possible and cannot be distinguished from the repository
alone: the business moved from Digihome to Rigitrade; both entities are real with
distinct roles that the site should spell out; or the PDFs contain an error.

Resolving it means rewriting the stated owner, the commercial register number,
and the data controller in the privacy policy. Those are legal declarations, so
they are **out of scope for this change** and left untouched. `LegalNotice` is
also shared with the privacy page, so an edit there has reach beyond the GTC.

Question for Ahmed: should the entire site change to Rigitrade AG — Impressum,
register number and privacy policy included — or do both companies hold distinct
roles that should be stated explicitly?

## Out of scope

- The Digihome/Rigitrade change in `LegalNotice`, the privacy policy and the
  footer, pending the answer above.
- The SMTP credential in `public/email.php:46`, still in git history. Rotating
  that mailbox password remains outstanding from the previous change set.
