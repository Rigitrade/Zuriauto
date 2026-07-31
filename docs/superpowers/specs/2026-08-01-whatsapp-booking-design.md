# Booking via WhatsApp instead of email

**Date:** 2026-08-01
**Status:** Approved

## Problem

The booking form mailed the customer and the office. That path had already been
rebuilt once for Vercel, which has no PHP runtime, and it still fails in
production because `SMTP_USER` and `SMTP_PASS` are unset — a submission reports
"The booking email could not be sent" and the office receives nothing.

The office would rather receive bookings on WhatsApp, formatted with the choices
made in the form.

## Decisions

1. **wa.me click-to-chat, not the Cloud API.** On submit, WhatsApp opens with the
   whole booking prefilled as a message to `41763666669` and the customer presses
   Send. Free, no Meta Business account, no template approval, no per-message
   cost, and free-form layout. The Cloud API was rejected for this pass: it needs
   a Meta Business account, a dedicated number not already used in the WhatsApp
   app, an access token, and Meta-approved templates that constrain the layout.
   Accepted trade-off: **if the customer never presses Send, nothing is
   received.**
2. **Email removed entirely.** `app/_actions/booking.ts`, `app/_actions/email.ts`
   and the `nodemailer` dependencies go. No SMTP variables to configure. Accepted
   trade-off: no server-side record of a booking, and the customer gets no
   confirmation document beyond the message in their own WhatsApp history.
3. **Message labels follow the page language** (German or English). The customer
   presses Send, so the message must be intelligible to them. Consequence: the
   office receives whichever language the visitor was using.

## Architecture

**`lib/whatsapp.ts` (new).** `WHATSAPP_NUMBER` and a `waLink(text)` helper that
percent-encodes the body. The number is currently hardcoded inside
`components/WhatsAppButton.tsx`; both that button and the booking flow will read
it from here so the two cannot drift apart.

**`components/car-rental/booking/whatsappMessage.ts` (new).**
`buildBookingMessage(formData, selectedPackage, days, totalPrice, lang)` returns
the message text. A pure function — text in, text out, no DOM and no side
effects — so it can be exercised directly rather than only through the UI.

German and English labels live in this module rather than the i18n catalogue.
The message is a self-contained document, and routing it through `t()` would mean
adding keys to `locales/de.ts`, `locales/en.ts` and `types/i18n.ts` for strings
nothing else uses. This mirrors how `locales/gtc.ts` is kept separate.

**`components/car-rental/booking/CarBookingWizard.tsx` (modified).**
`handleSubmit` currently drives an async `toast.promise` with loading, success
and error branches. Opening WhatsApp is synchronous and cannot fail, so that
collapses to: build the message, open the link in a new tab, reset the form, and
show one toast telling the customer to press Send. Step validation is untouched —
submission is still blocked until the terms are accepted and the fields pass.

## Message content

Every field the form collects, grouped booking-facts first and customer second.
`companyName` appears only when `bookingType` is `company`. Dates are reformatted
from the stored `YYYY-MM-DD` to `DD.MM.YYYY`. Labels use WhatsApp's `*bold*`
syntax.

```
*NEUE BUCHUNG – ZURIAUTO*

*Paket:* Touristenmiete – CHF 69 / Tag
*Abholort:* Unser Büro
*Abholung:* 01.08.2026 um 09:00
*Rückgabeort:* Unser Büro
*Rückgabe:* 05.08.2026 um 09:00
*Mietdauer:* 5 Tag(e)
*Gesamt:* CHF 345.00

*Kunde:* Test Person (Privatperson)
*E-Mail:* test@example.com
*Telefon:* +41791234567
*Geburtsdatum:* 01.01.1990
*Adresse:* Teststrasse 1, 8000 Zürich, Switzerland
*Führerschein:* X123, seit 01.01.2010
*Ausgestellt in:* Zürich, Switzerland
```

## Verification

- The builder is exercised directly against the real `FormData` shape: every
  collected field present, dates reformatted, the company line present only for
  company bookings and absent otherwise, and both languages produced.
- The encoded URL length is asserted to stay well below browser limits, since the
  entire booking travels in a query string.
- The page is then driven in a browser with `window.open` stubbed, asserting the
  URL actually opened is a `wa.me` link to the right number carrying the booking.
- Existing suites must keep passing: live parity, GTC page, PDF flags and
  favicon.

## Deliberately not done

- **Restoring `output: "export"`.** With no server code left the site could be a
  fully static build again, but that reintroduces the `out/`-folder bug where a
  second consecutive `npm run build` fails, and the present configuration works
  on Vercel. Left as a visible option rather than a silent change.
- **`tls: { rejectUnauthorized: false }`** disappears along with the mailer, so
  the weak TLS setting inherited from the PHP configuration is resolved by
  deletion rather than needing a separate fix.
