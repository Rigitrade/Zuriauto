# Review report: live parity changes

**Date:** 2026-07-30
**Branch:** `feat/live-parity`
**Base:** `66d989a` (initial commit on `main`)
**Commits to review:** 8
**Status:** all verified, nothing pushed

Read this top to bottom in commit order. Each entry states what changed, why,
and how it was verified. Deviations from the deployed site are called out
explicitly rather than left implicit.

---

## 1. `9140936` — feat: replace placeholder logo with real brand mark

**Files:** `components/Header.tsx` (+13/-11), `public/logo.jpg` (new, 9,907 bytes)

The header showed a placeholder: a slate square containing the letter `Q` beside
`<h1>ZURIAUTO</h1>` as text. Production uses the real brand lockup. Replaced with
a `next/image` `Image` carrying the same classes production uses
(`h-8 w-auto sm:h-10 md:h-12 object-contain`) and the border and hover treatment
production applies to the link wrapper.

The asset was retrieved from the live site and verified at 9,907 bytes, 400x123.

**Two intentional deviations from live:**

- Live declares `width={300} height={300}` on a 400x123 image. This declares the
  true dimensions, so Next reserves correct space and avoids layout shift.
  `object-contain` means rendering is identical either way.
- `priority` is set because the logo is above the fold. Live omits it.

**Verified:** typecheck clean, build exit 0. Asset byte size and dimensions
asserted. Rendered height confirmed at 48px against an intrinsic 123px, proving
the CSS sizing applies.

**Correction to the commit message.** It claims the hero `h1` is "now the only
top-level heading." That is wrong. Removing the logo `h1` took the page from
three `h1` elements to two, not one. The second is the booking wizard's
`AUTO BUCHEN` (`components/car-rental/booking/CarBookingWizard.tsx:204`). It was
left alone deliberately: the wizard is the whole content of `/book/`, where an
`h1` is correct, and changing it was not in the approved spec. The verification
harness asserts exactly two `h1` elements with those identities, so the real
state is pinned rather than aspirational.

---

## 2. `068f9b5` — feat: add floating WhatsApp contact button

**Files:** `components/WhatsAppButton.tsx` (new, 36 lines), `app/layout.tsx` (+2)

Production has a floating WhatsApp button; this repo had no such component at
all. Behaviour and styling were recovered from the live bundle
`bd6976f1a6156576.js` and rewritten as idiomatic TSX rather than pasted from
minified source.

Opens `https://wa.me/41763666669` — the same number as the footer's
`+41 76 366 66 69`. A 1s `setTimeout` flips `opacity-0 scale-0` to
`opacity-100 scale-100` so it animates in rather than appearing in first paint.
Includes the `animate-ping` pulse ring.

Mounted in the root layout beside `<Toaster />`, not in `MainLayout`, so it
appears on every route including `/book/` — matching production.

**Verified:** typecheck clean, build exit 0, button present on both `/` and
`/book/`, correct `aria-label`.

---

## 3. `9130b3a` — feat: add Google Analytics (G-ECECCVQKCV)

**Files:** `app/layout.tsx` (+15)

Adds the GA4 property production already runs, via two `next/script` tags with
`strategy="afterInteractive"`: the gtag loader, then inline `dataLayer` and
`gtag('config', ...)` initialisation.

**Matches production exactly, including the absence of a consent gate.** This was
an explicit decision, not an oversight. Recorded risk, restated here so it is not
lost: the site markets to EU tourists and sets analytics cookies before consent,
which is the pattern GDPR and revFADP enforcement targets. Accepted knowingly.

**Verified:** typecheck clean, build exit 0, gtag loader and inline config both
present in the exported HTML, `window.gtag` defined and `dataLayer` populated at
runtime.

---

## 4. `bf3470c` — feat: add dedicated /book/ booking page

**Files:** `app/book/page.tsx` (new, 12 lines)

Production has a standalone `/book/` page; this repo returned 404. Composes the
existing `MainLayout` and `CarBookingWizard` and adds no new UI. `MainLayout`
already supplies Header and Footer, matching what live's `/book/` shows.

**Verified:** typecheck clean, build exit 0, `/book` appears in the route table,
`out/book/index.html` emitted, route returns 200 and renders the wizard at
`SCHRITT 1 VON 3`.

---

## 5. `6b9d8fb` — refactor: trim nav to language switcher and booking CTA

**Files:** `components/Header.tsx` (+3/-96)

The Fahrzeuge, Preise and Kontakt items all pointed at the booking wizard, and
after commit 6 the sections they name are no longer rendered, so the labels would
mislead. Removed from both the desktop nav and the mobile overlay. Both booking
CTAs retargeted at `/book/`.

The desktop `<nav>` element was removed entirely rather than left empty, since an
empty `<nav>` still applies flex and spacing styles and announces a landmark with
no content. The mobile overlay and its hamburger stay — they still carry the
language switcher and the CTA. The already-commented-out `#services` and
`#benefits` blocks were deleted rather than left as dead comments.

**One unplanned change:** the mobile language switcher's `border-t` was dropped,
because with the nav links gone it had nothing above it to separate from.

**Deliberate divergence from production,** which keeps all three labels pointing
at `/book/`. This was chosen over faithful replication.

**Verified:** typecheck clean, build exit 0, no new lint warnings for
`Header.tsx`, no remaining `navigation:` or `#booking-wizard` references in the
file, and the harness asserts no nav item matching those labels.

---

## 6. `df84c57` — refactor: reduce homepage to live section set

**Files:** `components/car-rental/CarRentalPage.tsx` (-10)

Production renders hero, services, benefits and the booking wizard. This repo
also rendered vehicles, pricing, testimonials, FAQ and contact — the last of
which carried the placeholder address, `info@ihre-domain.ch` and
`+41 44 XXX XX XX`.

Only the import list and JSX body changed. **All five component files remain on
disk untouched**, as decided, so any can be re-enabled by re-adding an import and
an element. Verified explicitly that all five still exist. Nothing else in the
codebase imported them, so nothing else broke.

**Verified:** typecheck clean, build exit 0. Homepage First Load JS dropped from
128 kB to 117 kB. Harness asserts `services`, `benefits` and `booking-wizard`
present and all five removed IDs absent.

---

## 7. `11318c6` — fix: render children immediately in I18nProvider

**Files:** `providers/I18nProvider.tsx` (+4/-14)

The provider returned `null` until a `useEffect` had run, so the prerendered
`<body>` was completely empty. Crawlers that do not execute JavaScript saw no
content at all, despite the extensive keyword metadata and JSON-LD in the root
layout.

Now renders children immediately. The `mounted` state and `useState` import were
removed with the guard, since keeping an unread state variable would add a lint
warning. The effect is otherwise unchanged: it still restores the stored language
and maintains `document.documentElement.lang`.

**Production has this same defect. This is an intended divergence** — the repo is
now better than live in this respect.

**Verified:** typecheck clean, build exit 0. Prerendered body went from **0 to
2,057 characters** of real German copy. Hydration was checked in a real browser
in both states — a fresh visitor (`lang=de`) and a visitor with
`preferred-language=en` stored, which is the risky path since it re-renders after
hydration. **No hydration errors or mismatch warnings in either case.**

---

## 8. `540340e` — fix: stop Tailwind scanning docs/ for utility classes

**Files:** `app/globals.css` (+9)

This commit was not in the plan. It exists because the design spec and
implementation plan committed to `docs/` **broke the CSS build**, and that had to
be fixed before any of the above could be called working.

Tailwind v4 auto-detects source files and scans everything not gitignored,
markdown included. Content in `docs/` caused the scanner to emit **no CSS
whatsoever** — the entire 108 KB utility layer vanished and every page rendered
unstyled — while `npm run build` still **exited 0** and `tsc --noEmit` stayed
clean. A silent failure with no error message anywhere.

The trigger was isolated to the plan document specifically; the spec alone builds
fine. Adding a source exclusion for `docs/` restores the full stylesheet and
guards against future prose doing the same. Output is byte-identical to a build
with `docs/` absent (108,739 bytes both ways), so nothing else changed.

**How this was found, and what it says about the earlier verification.** Commits
1 through 7 each passed typecheck and build, and the DOM-level assertions all
passed too — because the DOM was genuinely correct. Only a screenshot revealed
the page was unstyled. The first bisect run pointed at commit 1, then at commit 2,
then contradicted itself; those runs were unreliable because the cache deletion
used `-ErrorAction SilentlyContinue` and silently left a stale `.next` in place.
Once cache clearing was made reliable, the real variable turned out to be the
presence of `docs/`, which every "working" tree happened to lack because it was
checked out at a commit predating those files.

**The harness now asserts computed style, not just DOM presence**, so this class
of failure cannot pass again.

---

## Verification summary

Harness: 15 assertions, exits non-zero on any failure. Run against both the dev
server and the static production export in `out/`.

```
PASS  tailwind css applied              header position=sticky (rules=482)
PASS  logo sized by css (not intrinsic) rendered height=48px (intrinsic is 123)
PASS  logo image renders                {"file":"logo.jpg","ok":true}
PASS  whatsapp button present           {"tag":"BUTTON"}
PASS  gtag defined                      gtag=true
PASS  dataLayer populated               len=4
PASS  live section set present          ["services","benefits","booking-wizard"]
PASS  removed sections absent           ["services","benefits","booking-wizard"]
PASS  nav trimmed [intended divergence] ["EN","JETZT BUCHEN","JETZT BUCHEN"]
PASS  header CTA targets /book/         ["/","/book/"]
PASS  h1 count is 2 (hero + wizard)     ["ZÜRICH AUTO VERMIETUNGTAXI UBER TOURISTE","AUTO BUCHEN"]
PASS  no page errors                    (none)
PASS  /book/ returns 200                status=200
PASS  /book/ renders wizard             step=SCHRITT 1 VON 3
PASS  /book/ has whatsapp too           present=true

15/15 checks passed
```

Two of those assertions pin the *intended* divergences (trimmed nav, and the
`h1` count), so a future change that silently reverted them would fail rather
than pass quietly.

Also confirmed visually, not just programmatically: both `/` and `/book/` were
screenshotted and inspected. The homepage matches live's layout — real logo,
trimmed nav, hero, WhatsApp button bottom right.

The harness lives in the session scratchpad, not the repo, because adding it
would mean adding `puppeteer-core` to `package.json`, which the spec did not
authorise.

## Divergences from production, consolidated

| # | Divergence | Reason |
|---|---|---|
| 1 | Nav has no Fahrzeuge / Preise / Kontakt | Labels would misdescribe a page whose sections are gone |
| 2 | Prerendered body is non-empty | Live has an empty body; this is a fix, not a regression |
| 3 | Logo declares true 400x123 and uses `priority` | Live declares an incorrect 300x300 |
| 4 | Mobile language switcher has no top border | Nothing left above it to separate from |

## Out of scope

Deferred deliberately, not overlooked:

- **The SMTP credential in `public/email.php:46`** is in git history as of the
  initial commit. Rotating that mailbox password is the fix, then moving the new
  one to host environment variables. This is the one item with a security
  consequence and is worth doing regardless of anything else here.
- The placeholder contact details, which stop rendering as a side effect of
  commit 6 but remain in `ContactSection.tsx`.
- `README.md`, which documents an unrelated starter template and claims Arabic
  and French support that does not exist.
- `og-image.jpg`, `favicon.svg`, `hero-image.webp`, `apple-touch-icon.png`,
  `icon-144x144.png` — all 404 on live too, so they are absent everywhere rather
  than lost here. `og-image.jpg` affects social link previews.
- Dead code at `components/car-rental/booking/utils.ts:210`, where `dailyRate` is
  computed then ignored in favour of a hardcoded `48.58`.

## Build health note

`npm run dev` and `npm run build` require outbound access to
`fonts.gstatic.com`, because `app/layout.tsx` loads Geist through
`next/font/google`. When that fetch fails the root layout throws and **every**
route returns HTTP 500 — which happened twice during this work and is easy to
misdiagnose. Self-hosting the two Geist fonts would remove the dependency. Not
done here: it is a change to the source beyond the approved scope.
