# Live Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring this repository to parity with the deployed site at `https://zuriauto.ch`, so `main` can be deployed without regressing production.

**Architecture:** Seven focused commits against an existing Next.js 15 App Router site. Four are additive (logo asset plus header image, WhatsApp button, Google Analytics, `/book/` route), two are subtractive (nav trim, homepage section reduction), one is a one-line provider fix that restores server-rendered content. An eighth task verifies the result against live and writes the review report.

**Tech Stack:** Next.js 15.5.2 (App Router, Turbopack), React 19.1.0, TypeScript 5, Tailwind CSS 4, shadcn/ui on Radix, i18next, static export.

## Global Constraints

- `next.config.ts` sets `output: "export"` — static export only. No server components with runtime data, no API routes, no middleware.
- `next.config.ts` sets `trailingSlash: true` — the new route is `/book/`, and internal links must be written `/book/`.
- `next.config.ts` sets `images.unoptimized: true` — `next/image` works but performs no optimisation. Intrinsic `width`/`height` are still required.
- Every commit must leave `npx tsc --noEmit` clean and `npm run build` succeeding. Never commit a broken tree.
- `npm run dev` and `npm run build` need outbound access to `fonts.gstatic.com`, because `app/layout.tsx:7-15` loads Geist through `next/font/google`. If fonts cannot be fetched the root layout throws and every route returns HTTP 500.
- Supported languages are German (`de`, default) and English (`en`) only. Translation keys live in `locales/de.ts` and `locales/en.ts`.
- There is no test runner. `package.json:10` is a stub that always exits 1. Do not run `npm test`. Verification is typecheck, build, and the assertion scripts given in each task.
- Existing ESLint warnings about unused variables are pre-existing and do not fail the build. Do not introduce new ones.
- Every commit message ends with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- The verification harness lives outside the repository, in the session scratchpad, because putting it in the repo would require adding `puppeteer-core` to `package.json`, which the spec does not authorise.

Scratchpad path used throughout:
`C:\Users\Hossam\AppData\Local\Temp\claude\D--Personal-Zuriauto-site\a39fcdd9-70ed-4f6f-a92a-01278cfe9d73\scratchpad`

---

## File Structure

**Created:**
- `public/logo.jpg` — brand lockup, 400x123, 9,907 bytes. Retrieved from live, already staged in the scratchpad as `logo-from-live.jpg`.
- `components/WhatsAppButton.tsx` — floating WhatsApp contact button. Client component, single responsibility, no props.
- `app/book/page.tsx` — the `/book/` route. Composes existing pieces only.
- `docs/REVIEW-2026-07-30-live-parity.md` — the review report deliverable.

**Modified:**
- `components/Header.tsx` — logo mark (Task 1) and navigation (Task 5). Two tasks touch this file; Task 5 must be applied after Task 1.
- `app/layout.tsx` — mounts the WhatsApp button (Task 2) and adds the analytics scripts (Task 3).
- `components/car-rental/CarRentalPage.tsx` — the rendered section list (Task 6).
- `providers/I18nProvider.tsx` — the prerender fix (Task 7).

**Deliberately untouched:** `components/car-rental/VehiclesSection.tsx`, `PricingSection.tsx`, `TestimonialsSection.tsx`, `FAQSection.tsx`, `ContactSection.tsx`. They stop being rendered in Task 6 but remain on disk by decision.

---

### Task 1: Real logo in the header

**Files:**
- Create: `public/logo.jpg`
- Modify: `components/Header.tsx` (add import at line 6 area; replace lines 48-59)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `public/logo.jpg` at URL path `/logo.jpg`. Task 8 asserts an `<img>` resolving to this file.

- [ ] **Step 1: Copy the logo asset into the repo**

```bash
cp "C:/Users/Hossam/AppData/Local/Temp/claude/D--Personal-Zuriauto-site/a39fcdd9-70ed-4f6f-a92a-01278cfe9d73/scratchpad/logo-from-live.jpg" "D:/Personal/Zuriauto-site/public/logo.jpg"
```

- [ ] **Step 2: Confirm the asset is correct**

Run:
```bash
node -e "const s=require('fs').statSync('D:/Personal/Zuriauto-site/public/logo.jpg');console.log('bytes',s.size)"
```
Expected: `bytes 9907`

- [ ] **Step 3: Add the `next/image` import to Header.tsx**

`components/Header.tsx` currently imports (lines 1-8):

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
```

Add `Image` immediately above the `Link` import so it reads:

```tsx
import Image from "next/image";
import Link from "next/link";
```

- [ ] **Step 4: Replace the placeholder logo block**

Replace lines 48-59 of `components/Header.tsx`, which currently are:

```tsx
            <Link href="/" className="flex-shrink-0">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-none bg-slate-800">
                  <span className="text-xs sm:text-sm font-bold text-white tracking-wider">
                    Q
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-light tracking-widest uppercase">
                  ZURIAUTO
                </h1>
              </div>
            </Link>
```

with:

```tsx
            <Link
              href="/"
              className="flex-shrink-0 border border-black hover:border-slate-800 hover:shadow-lg shadow-sm transition-all duration-200 ease-in-out"
            >
              <Image
                src="/logo.jpg"
                alt="Zuriauto Logo"
                width={400}
                height={123}
                priority
                className="h-8 w-auto sm:h-10 md:h-12 object-contain"
              />
            </Link>
```

Notes for the implementer: the `width`/`height` are the image's true intrinsic
dimensions. Live declares `300x300`, which is wrong metadata; `object-contain`
means both render identically, but correct values let Next reserve the right
space and avoid layout shift. `priority` is added because the logo is above the
fold; live omits it. Both are intentional, documented deviations.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: `✓ Exporting`, routes `/`, `/GTC`, `/privacy` listed, exit 0.

- [ ] **Step 7: Commit**

```bash
git add public/logo.jpg components/Header.tsx
git commit -m "feat: replace placeholder logo with real brand mark

Swaps the placeholder Q square and ZURIAUTO wordmark for the real
brand lockup used in production. Declares true intrinsic dimensions
(400x123) rather than live's incorrect 300x300, and marks the image
priority since it is above the fold.

Also removes a second h1 from the homepage: the hero h1 is now the
only top-level heading.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Floating WhatsApp contact button

**Files:**
- Create: `components/WhatsAppButton.tsx`
- Modify: `app/layout.tsx` (add import; add element after `<Toaster />` at line 384)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export default function WhatsAppButton(): JSX.Element` — takes no
  props. Task 8 asserts a `button` with `aria-label="Contact us on WhatsApp"`.

- [ ] **Step 1: Create the component**

Create `components/WhatsAppButton.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const WHATSAPP_URL = "https://wa.me/41763666669";

export default function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      onClick={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
      aria-label="Contact us on WhatsApp"
      className={`cursor-pointer group fixed bottom-5 right-5 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 w-12 h-12 flex items-center justify-center ${
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
      }`}
    >
      <svg
        className="w-7 h-7 transition-transform duration-300"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-30" />
    </button>
  );
}
```

The number `41763666669` matches the footer's `+41 76 366 66 69`. Behaviour and
styling were recovered from live bundle `bd6976f1a6156576.js`.

- [ ] **Step 2: Import it in the root layout**

In `app/layout.tsx`, alongside the existing imports at lines 1-5, add:

```tsx
import WhatsAppButton from "@/components/WhatsAppButton";
```

- [ ] **Step 3: Mount it**

`app/layout.tsx` lines 380-385 currently read:

```tsx
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <Toaster />
      </body>
```

Change to:

```tsx
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <Toaster />
        <WhatsAppButton />
      </body>
```

Mounting in the root layout rather than `MainLayout` is deliberate: it puts the
button on every route including `/book/`, matching live.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/WhatsAppButton.tsx app/layout.tsx
git commit -m "feat: add floating WhatsApp contact button

Adds the WhatsApp button production has but this repo lacked. Opens
wa.me/41763666669, the number already in the footer. Fades and scales
in one second after mount, with a pulsing ring.

Mounted in the root layout so it appears on every route, matching
production.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Google Analytics

**Files:**
- Modify: `app/layout.tsx` (add import; add two `<Script>` elements inside `<head>` after the JSON-LD block at lines 342-345)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a global `window.dataLayer` array and `gtag` function once the
  scripts execute. Task 8 asserts both.

- [ ] **Step 1: Import next/script**

In `app/layout.tsx`, add to the imports at lines 1-5:

```tsx
import Script from "next/script";
```

- [ ] **Step 2: Add the analytics scripts**

In `app/layout.tsx`, immediately after the existing JSON-LD `<script>` that ends
at line 345, and before the `{/* Additional Meta Tags - Updated */}` comment,
insert:

```tsx
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-ECECCVQKCV"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ECECCVQKCV');
          `}
        </Script>
```

This reproduces live exactly, including the absence of a consent gate. The
compliance risk is recorded in the spec and was accepted.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add Google Analytics (G-ECECCVQKCV)

Adds the GA4 property production already runs, via next/script with
afterInteractive strategy. Matches production exactly, including no
consent gate.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Dedicated /book/ page

**Files:**
- Create: `app/book/page.tsx`

**Interfaces:**
- Consumes: `MainLayout` from `@/components/MainLayout` (named export, takes
  `children`), and `CarBookingWizard` from
  `@/components/car-rental/booking/CarBookingWizard` (default export, no props).
- Produces: the route `/book/`. Task 5 links to it; Task 8 asserts HTTP 200.

- [ ] **Step 1: Create the page**

Create `app/book/page.tsx`:

```tsx
"use client";

import { MainLayout } from "@/components/MainLayout";
import CarBookingWizard from "@/components/car-rental/booking/CarBookingWizard";

export default function BookPage() {
  return (
    <MainLayout>
      <CarBookingWizard />
    </MainLayout>
  );
}
```

`MainLayout` already renders `Header` and `Footer` (see
`components/MainLayout.tsx:4-12`), which matches what live's `/book/` shows.
`"use client"` mirrors `app/page.tsx:1` and is required because the wizard holds
state.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Build and confirm the route is emitted**

Run: `npm run build`
Expected: exit 0, and the route table now includes a `/book` entry alongside `/`,
`/GTC` and `/privacy`.

- [ ] **Step 4: Confirm the exported file exists**

Run:
```bash
node -e "console.log(require('fs').existsSync('D:/Personal/Zuriauto-site/out/book/index.html'))"
```
Expected: `true`

- [ ] **Step 5: Commit**

```bash
git add app/book/page.tsx
git commit -m "feat: add dedicated /book/ booking page

Production has a standalone /book/ page holding the booking wizard;
this repo returned 404 for it. Composes the existing MainLayout and
CarBookingWizard, adding no new UI.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Trim the navigation

**Files:**
- Modify: `components/Header.tsx` (remove desktop `<nav>` at lines 62-103; retarget desktop CTA at line 113; remove mobile link group at lines 157-203; retarget mobile CTA at line 212)

Line numbers refer to the file as it stands after Task 1, which changed lines
48-59 without altering the total line count in a way that shifts these blocks by
more than a few lines. Locate blocks by their content, not by line number alone.

**Interfaces:**
- Consumes: the `/book/` route from Task 4. Do not apply this task before Task 4,
  or the header will link to a route that does not exist.
- Produces: a header containing only the logo, the language switcher, and the
  booking call to action. Task 8 asserts no nav item with text matching
  Fahrzeuge, Preise or Kontakt.

- [ ] **Step 1: Remove the desktop nav element**

Delete the entire `<nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">` element and everything inside it, including the two already-commented-out `#services` and `#benefits` blocks. It currently contains three `<Link href="/#booking-wizard">` wrappers around Buttons labelled `t("navigation:vehicles")`, `t("navigation:pricing")` and `t("navigation:contact")`.

The element is removed entirely rather than left empty, because an empty `<nav>` still applies `space-x` and `flex` styling and conveys a landmark with no content.

- [ ] **Step 2: Retarget the desktop booking button**

Find the desktop CTA:

```tsx
              <Link href="/#booking-wizard" className="hidden lg:block">
```

Change to:

```tsx
              <Link href="/book/" className="hidden lg:block">
```

- [ ] **Step 3: Remove the mobile nav link group**

Inside the mobile overlay, delete the `<div className="space-y-2">` block containing the three `<Link href="/#booking-wizard">` Buttons labelled `t("navigation:vehicles")`, `t("navigation:pricing")` and `t("navigation:contact")`, including the two commented-out `#services` and `#benefits` blocks.

Keep the language switcher `<div className="flex justify-center py-4 border-t border-slate-200">` and the booking button block that follow it. Keep the hamburger button, since it still opens the switcher and the CTA.

- [ ] **Step 4: Retarget the mobile booking button**

Find, inside the mobile overlay:

```tsx
                  <Link href="/#booking-wizard" className="block">
```

Change to:

```tsx
                  <Link href="/book/" className="block">
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 6: Build and check for new lint warnings**

Run: `npm run build`
Expected: exit 0. `Menu`, `X`, `Button`, `Link` and `LanguageSwitcher` must all still be used, so no new unused-import warnings should appear for `components/Header.tsx`. If one does, remove the now-unused import.

- [ ] **Step 7: Commit**

```bash
git add components/Header.tsx
git commit -m "refactor: trim nav to language switcher and booking CTA

The Fahrzeuge, Preise and Kontakt items all pointed at the booking
wizard, and the sections they name are no longer rendered, so the
labels misled. Removes them from both the desktop nav and the mobile
overlay, and retargets both booking CTAs at the new /book/ page.

Deliberate divergence from production, which keeps all three labels
pointing at /book/.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Reduce the homepage to the live section set

**Files:**
- Modify: `components/car-rental/CarRentalPage.tsx` (replace whole file, 27 lines)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a homepage rendering section IDs `services`, `benefits` and
  `booking-wizard` only. Task 8 asserts exactly this set.

- [ ] **Step 1: Replace the file contents**

`components/car-rental/CarRentalPage.tsx` becomes, in full:

```tsx
"use client";

import BenefitsSection from "./BenefitsSection";
import CarBookingWizard from "./booking/CarBookingWizard";
import HeroSection from "./HeroSection";
import ServicesSection from "./ServicesSection";

export default function CarRentalPage() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <BenefitsSection />
      <CarBookingWizard />
    </>
  );
}
```

The five removed imports were `ContactSection`, `FAQSection`, `PricingSection`,
`TestimonialsSection` and `VehiclesSection`. Their files stay on disk untouched,
by decision, so any can be re-enabled later by re-adding an import and an
element.

- [ ] **Step 2: Confirm the five component files still exist**

Run:
```bash
node -e "const f=require('fs');['ContactSection','FAQSection','PricingSection','TestimonialsSection','VehiclesSection'].forEach(n=>console.log(n,f.existsSync('D:/Personal/Zuriauto-site/components/car-rental/'+n+'.tsx')))"
```
Expected: all five print `true`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0. The `/` route's First Load JS should drop noticeably, since the carousel and five sections are no longer in the homepage graph.

- [ ] **Step 5: Commit**

```bash
git add components/car-rental/CarRentalPage.tsx
git commit -m "refactor: reduce homepage to live section set

Production renders hero, services, benefits and the booking wizard.
This repo also rendered vehicles, pricing, testimonials, FAQ and
contact, the last of which carried placeholder address, email and
phone values.

The five section components stay on disk unrendered so any can be
re-enabled as a deliberate change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Render children immediately in I18nProvider

**Files:**
- Modify: `providers/I18nProvider.tsx` (replace whole file, 54 lines)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a non-empty prerendered `<body>` in `out/index.html`. Task 8 asserts
  this, and asserts it as an intended divergence from live.

- [ ] **Step 1: Replace the file contents**

`providers/I18nProvider.tsx` becomes, in full:

```tsx
"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Restore the visitor's stored language choice after hydration.
    const initializeClientLanguage = async () => {
      const storedLang = localStorage.getItem("preferred-language");

      if (
        storedLang &&
        ["de", "en"].includes(storedLang) &&
        storedLang !== i18n.language
      ) {
        await i18n.changeLanguage(storedLang);
      }

      document.documentElement.dir = "ltr";
      document.documentElement.lang = i18n.language;
    };

    const updateDirection = () => {
      if (typeof document !== "undefined") {
        document.documentElement.dir = "ltr";
        document.documentElement.lang = i18n.language;
      }
    };

    initializeClientLanguage();

    i18n.on("languageChanged", updateDirection);

    return () => {
      i18n.off("languageChanged", updateDirection);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
```

What changed: `if (!mounted) return null;` is gone, and with it the now-pointless
`mounted` state and the `useState` import. Keeping `mounted` while no longer
reading it would introduce a new unused-variable warning. The effect itself is
unchanged, because it still restores the stored language and maintains
`document.documentElement.lang`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Verify the prerendered body is no longer empty**

Run:
```bash
node -e "const h=require('fs').readFileSync('D:/Personal/Zuriauto-site/out/index.html','utf8');const b=h.match(/<body[\s\S]*<\/body>/)[0];const t=b.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();console.log('prerendered body chars:',t.length);console.log(t.slice(0,160))"
```
Expected: a character count in the low thousands, not `0`, and recognisable
German copy such as `ZÜRICH AUTO VERMIETUNG`. Before this task the same command
printed `0`.

- [ ] **Step 5: Verify hydration in a real browser**

Run:
```bash
cd "C:/Users/Hossam/AppData/Local/Temp/claude/D--Personal-Zuriauto-site/a39fcdd9-70ed-4f6f-a92a-01278cfe9d73/scratchpad" && node verify.js
```

`verify.js` already exists in the scratchpad from the investigation and reports
`pageerrors`. Requires `npm run dev` running on port 3000 in another shell.

Expected: `pageerrors: (none)`. A React hydration mismatch would surface here.
Investigate before committing if any appear — this is the one change in the set
with real hydration risk.

- [ ] **Step 6: Commit**

```bash
git add providers/I18nProvider.tsx
git commit -m "fix: render children immediately in I18nProvider

The provider returned null until a useEffect had run, so the
prerendered body was empty and crawlers that do not execute
JavaScript saw no content at all - despite the extensive SEO
metadata and JSON-LD in the root layout.

Renders children immediately instead. The effect still restores the
stored language and maintains document.documentElement.lang, so a
visitor whose preference is English re-renders after hydration.

Production has this same defect; this is an intended divergence.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verify parity and write the review report

**Files:**
- Create: `C:\...\scratchpad\verify-parity.js` (outside the repo)
- Create: `docs/REVIEW-2026-07-30-live-parity.md`

**Interfaces:**
- Consumes: every preceding task. Requires `npm run dev` serving port 3000.
- Produces: the review report deliverable.

- [ ] **Step 1: Write the parity assertion harness**

Create `verify-parity.js` in the scratchpad:

```js
const puppeteer = require("puppeteer-core");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? "PASS  " : "FAIL  ") + name + "  " + detail);
}

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: "shell",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));

  await p.goto("http://localhost:3000/", {
    waitUntil: "networkidle2",
    timeout: 120000,
  });
  await sleep(4000);

  const d = await p.evaluate(() => ({
    logo: (() => {
      const i = Array.from(document.images).find((x) =>
        (x.currentSrc || x.src).includes("logo")
      );
      return i ? { src: (i.currentSrc || i.src).split("/").pop(), ok: i.naturalWidth > 0 } : null;
    })(),
    wa: (() => {
      const el = document.querySelector('[aria-label="Contact us on WhatsApp"]');
      return el ? { tag: el.tagName } : null;
    })(),
    gtag: typeof window.gtag === "function",
    dataLayer: Array.isArray(window.dataLayer) ? window.dataLayer.length : -1,
    sectionIds: Array.from(document.querySelectorAll("section[id]")).map((s) => s.id),
    navTexts: Array.from(document.querySelectorAll("header a, header button"))
      .map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
    h1count: document.querySelectorAll("h1").length,
  }));

  check("logo image renders", !!(d.logo && d.logo.ok), JSON.stringify(d.logo));
  check("whatsapp button present", !!d.wa, JSON.stringify(d.wa));
  check("gtag defined", d.gtag === true, "gtag=" + d.gtag);
  check("dataLayer populated", d.dataLayer > 0, "len=" + d.dataLayer);

  const want = ["services", "benefits", "booking-wizard"];
  const got = d.sectionIds.filter((i) => want.includes(i));
  const removed = ["vehicles", "pricing", "testimonials", "faq", "contact"];
  check(
    "live section set present",
    want.every((w) => d.sectionIds.includes(w)),
    JSON.stringify(got)
  );
  check(
    "removed sections absent",
    !d.sectionIds.some((i) => removed.includes(i)),
    JSON.stringify(d.sectionIds)
  );

  const banned = /^(Fahrzeuge|Preise|Kontakt|Vehicles|Pricing|Contact)$/i;
  check(
    "nav trimmed (intended divergence)",
    !d.navTexts.some((t) => banned.test(t)),
    JSON.stringify(d.navTexts)
  );
  check("single h1", d.h1count === 1, "h1 count=" + d.h1count);
  check("no page errors", errs.length === 0, errs.join(" | ") || "(none)");

  const bookResp = await p.goto("http://localhost:3000/book/", {
    waitUntil: "networkidle2",
    timeout: 120000,
  });
  await sleep(3500);
  const bookOk = await p.evaluate(() =>
    /AUTO BUCHEN|BOOK A CAR/i.test(document.body.innerText)
  );
  check("/book/ returns 200", bookResp.status() === 200, "status=" + bookResp.status());
  check("/book/ renders wizard", bookOk, "wizard heading found=" + bookOk);

  await b.close();
  const failed = results.filter((r) => !r.pass);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
  if (failed.length) process.exit(1);
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
```

The harness asserts twelve conditions and exits non-zero if any fail, so it is a
gate rather than a report. Two of the twelve assert the *intended* divergences
from live — the trimmed nav and the single `h1` — so a future change that
silently reverted them would fail here.

- [ ] **Step 2: Start the dev server**

In a separate shell:
```bash
cd D:/Personal/Zuriauto-site && npm run dev
```
Wait for `Ready`. If every route returns 500, the cause is the Google Fonts
fetch described in Global Constraints: stop the server, free port 3000, restart.

- [ ] **Step 3: Run the harness**

```bash
cd "C:/Users/Hossam/AppData/Local/Temp/claude/D--Personal-Zuriauto-site/a39fcdd9-70ed-4f6f-a92a-01278cfe9d73/scratchpad" && node verify-parity.js
```
Expected: `12/12 checks passed`, exit 0. Any FAIL line names the broken
assertion; fix the responsible task before continuing.

- [ ] **Step 4: Collect the commit metadata for the report**

```bash
cd D:/Personal/Zuriauto-site && git log --format="%h %s" -8
git log --stat --format="%n=== %h %s" -7 > /tmp/parity-diffstat.txt
```

- [ ] **Step 5: Write the review report**

Create `docs/REVIEW-2026-07-30-live-parity.md` with one section per commit, in
commit order. Each section must contain: the short SHA, the commit subject, what
changed and why in two or three sentences, the exact files touched with line
counts from the diffstat, the typecheck and build result, and any deviation from
live. End the document with the harness output verbatim, and a short list of what
remains out of scope, copied from the spec's final section.

- [ ] **Step 6: Commit the report**

```bash
git add docs/REVIEW-2026-07-30-live-parity.md
git commit -m "docs: add live-parity review report

Per-commit record of the seven parity changes with verification
evidence, for review.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Report to the user**

Summarise inline: the seven commits with SHAs, the harness result, the two
intended divergences from live, and the outstanding SMTP credential rotation.
Do not push. The user has not asked for a push of this work.

---

## Self-Review

**Spec coverage.** Each spec item maps to a task: sections decision to Task 6;
nav decision to Task 5; analytics decision to Task 3; prerender fix to Task 7;
logo source to Task 1; WhatsApp to Task 2; `/book/` to Task 4; verification and
the review report to Task 8. The five out-of-scope items are restated in Task 8
Step 5 so they appear in the deliverable rather than being silently dropped.

**Placeholder scan.** No TBDs, no "handle edge cases", no "similar to Task N".
Every code step carries the literal content to write. One defect was found during
this review and fixed inline: Task 8 Step 1's harness contained an invalid
`await sleep: 0;` line, now removed.

**Untestable-by-unit-test note.** With no test runner in the project, six of the
seven changes are verified by typecheck plus build plus the Task 8 harness rather
than by unit tests. Task 1 Step 2, Task 4 Step 4, Task 6 Step 2 and Task 7 Step 4
add targeted `node -e` assertions where a build alone would not prove the
outcome — asset byte size, route emission, files still present, and prerendered
body length respectively.

**Type consistency.** `WhatsAppButton` is a default export in Task 2 and imported
as a default in Task 2 Step 2. `MainLayout` is a named export in
`components/MainLayout.tsx:4` and imported as named in Task 4. `CarBookingWizard`
is a default export and imported as default in Tasks 4 and 6. `I18nProvider`
stays a named export in Task 7, matching its import at `app/layout.tsx:1`.
Section ID strings `services`, `benefits`, `booking-wizard` are consistent
between Task 6 and Task 8.

**Ordering constraint.** Task 5 must follow Task 4, or the header links to a
route that does not exist. Task 1 must precede Task 5, since both edit
`components/Header.tsx`. Task 7 is last by design, being the only change with
hydration risk.
