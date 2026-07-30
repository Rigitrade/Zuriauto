# Bringing the repo to parity with the deployed site

**Date:** 2026-07-30
**Status:** Approved

## Problem

The repository is an older version of the ZURIAUTO site than what is deployed at
`https://zuriauto.ch`. Deploying `main` as it stands would regress production: it
would drop the real logo, the WhatsApp button, Google Analytics and the `/book/`
page, and would reintroduce a contact section containing placeholder details.

The newer source is not available, so the deployed site is the reference. Every
difference below was measured against live, not assumed.

## Measured differences

| Area | Repo | Live |
|---|---|---|
| Logo | Slate square with the letter `Q` plus `<h1>ZURIAUTO</h1>` text | `<img src="/logo.jpg">`, 400x123 brand lockup, no text |
| Homepage sections | 10 rendered | 5 rendered |
| Vehicles, Pricing, Testimonials, FAQ, Contact | rendered | not rendered |
| `/book/` | 404, route absent | 200, wizard plus header and footer |
| Nav targets | all to `/#booking-wizard` | all to `/book/` |
| WhatsApp button | absent from source | present, `wa.me/41763666669` |
| Google Analytics | absent | `G-ECECCVQKCV` via `next/script` |
| Contact details | placeholders (`info@ihre-domain.ch`, `+41 44 XXX XX XX`) | section removed; real details in footer only |

Shared defect, present in both: `providers/I18nProvider.tsx:52` returns `null`
until hydration, so the prerendered `<body>` is empty and crawlers that do not
execute JavaScript see no content.

Assets that 404 on live as well, and are therefore out of scope: `og-image.jpg`,
`favicon.svg`, `hero-image.webp`, `apple-touch-icon.png`, `icon-144x144.png`.

## Decisions

1. **Sections** — render only what live renders. The five unused section
   components remain on disk so nothing is lost and any can be re-enabled later
   as a deliberate change.
2. **Navigation** — remove the Fahrzeuge, Preise and Kontakt items rather than
   copying live's behaviour of pointing all three at `/book/`. The sections they
   name are no longer rendered, so the labels would mislead. Keep the language
   switcher and the `JETZT BUCHEN` call to action targeting `/book/`. This is an
   intentional divergence from live.
3. **Analytics** — match live exactly: gtag through `next/script` with
   `strategy="afterInteractive"`, no consent gate. Recorded risk: the site
   markets to EU tourists and sets analytics cookies before consent, which is
   the pattern GDPR and revFADP enforcement targets. Accepted knowingly.
4. **Prerender fix** — include the `I18nProvider` change in this pass.
5. **Logo source** — `public/logo.jpg` taken from the live site (9,907 bytes,
   400x123). Pixel-identical to production. Replacing the file later with a
   higher-resolution original requires no code change.

## Commits

Seven commits, each verified with `npx tsc --noEmit` and `npm run build` before
it lands, so no commit in history is broken.

1. `feat: replace placeholder logo with real brand mark`
   `public/logo.jpg` (new), `components/Header.tsx`
2. `feat: add floating WhatsApp contact button`
   `components/WhatsAppButton.tsx` (new), `app/layout.tsx`
3. `feat: add Google Analytics (G-ECECCVQKCV)`
   `app/layout.tsx`
4. `feat: add dedicated /book/ booking page`
   `app/book/page.tsx` (new)
5. `refactor: trim nav to language switcher and booking CTA`
   `components/Header.tsx`
6. `refactor: reduce homepage to live section set`
   `components/car-rental/CarRentalPage.tsx`
7. `fix: render children immediately in I18nProvider`
   `providers/I18nProvider.tsx`

## Implementation notes

**Logo.** Replaces the nested Q-box `div` and `<h1>` inside the header `Link`
with a `next/image` `Image` carrying live's classes
`h-8 w-auto sm:h-10 md:h-12 object-contain`, plus the border and hover treatment
live applies to the link wrapper. Live declares `width={300} height={300}` on a
400x123 image; this repo declares the true dimensions so Next reserves correct
space and avoids layout shift. Rendering is unchanged because of
`object-contain`.

Side effect, beneficial: dropping `<h1>ZURIAUTO</h1>` leaves the hero's `<h1>` as
the only top-level heading. The page currently has two.

**WhatsApp.** A client component mounted in `app/layout.tsx` next to `<Toaster />`
rather than in `MainLayout`, mirroring live, where the button also appears on
`/book/`. Behaviour recovered from live bundle `bd6976f1a6156576.js`: a 1s
`setTimeout` flips `opacity-0 scale-0` to `opacity-100 scale-100`; the click
handler calls
`window.open("https://wa.me/41763666669", "_blank", "noopener,noreferrer")`;
styling is `bg-[#25D366]`, `hover:bg-[#20BA5A]`, `fixed bottom-5 right-5 z-50`,
`rounded-full w-12 h-12`, with an `animate-ping` ring. Written as idiomatic TSX
matching existing component style, not pasted from the minified source.

**Analytics.** Two `next/script` tags in the root layout `<head>`: the gtag
loader for `G-ECECCVQKCV`, then an inline script initialising `dataLayer`,
`gtag('js', new Date())` and `gtag('config', 'G-ECECCVQKCV')`.

**`/book/`.** `app/book/page.tsx` renders
`<MainLayout><CarBookingWizard /></MainLayout>`. `MainLayout` already supplies
Header and Footer, matching live. Marked `"use client"` as `app/page.tsx` is,
because the wizard is stateful.

**Navigation.** `Header.tsx` renders the nav twice: the desktop `<nav>` at lines
62-103 and the mobile overlay at lines 157-203. Both must be trimmed, or mobile
visitors keep the misleading items. After trimming, the desktop `<nav>` element
holds nothing and is removed entirely rather than left empty. The mobile overlay
and its hamburger button stay, because they still carry the language switcher and
the booking call to action. The already-commented-out `#services` and `#benefits`
links in both blocks are deleted rather than left as dead comments.

**Sections.** Only the import list and JSX body of `CarRentalPage.tsx` change.
The five component files are untouched.

**I18nProvider.** Remove `if (!mounted) return null`. The `mounted` state and its
`useEffect` stay, since that effect also restores the stored language and sets
`document.documentElement.lang`. This carries the only real hydration risk in the
set, so it lands last: if hydration misbehaves, the cause is unambiguous. German
is the default language, so a visitor whose stored preference is English gets a
post-hydration re-render, which must be verified.

## Verification

After all seven commits, re-run the puppeteer comparison harness that produced
the difference table above, asserting against live:

- logo `<img>` present, resolving to `logo.jpg`
- WhatsApp button present with the correct `wa.me` target
- `gtag` loaded and `dataLayer` populated
- `/book/` returns 200 and renders the wizard
- rendered section IDs match live's `services`, `benefits`, `booking-wizard`

Two divergences are asserted as expected rather than ignored:

- nav contains no Fahrzeuge, Preise or Kontakt items
- prerendered `<body>` is non-empty, where live's is empty

## Deliverable

A review report at `docs/REVIEW-2026-07-30-live-parity.md`: one entry per commit
with SHA, what changed and why, files touched, the diff, typecheck and build
results, and any deviation from live. Ordered for commit-by-commit reading.

## Explicitly out of scope

Each of these is real and deferred deliberately, not overlooked:

- The hardcoded SMTP credential in `public/email.php:46`, now in git history.
  Rotating that mailbox password is the fix, plus moving it to host environment
  variables.
- The placeholder contact details, which stop rendering as a side effect of
  decision 1 but remain in `ContactSection.tsx`.
- The stale `README.md`, which documents an unrelated starter template and claims
  Arabic and French support that does not exist.
- The assets that 404 on live too, listed above.
- Dead code in `components/car-rental/booking/utils.ts:210`, where `dailyRate` is
  computed then ignored in favour of a hardcoded `48.58`.
