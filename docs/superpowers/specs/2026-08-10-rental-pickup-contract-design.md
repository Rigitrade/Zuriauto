# Digital rental pickup contract (Phase 1)

**Date:** 2026-08-10
**Status:** Approved
**Scope:** Phase 1 only. The return/handover step, the Rentals table and the
admin dashboard are explicitly out of scope and deferred to Phase 2.

## Problem

The office has no digital pickup protocol. Customers sign nothing, no copy of
the ID or driving licence is retained, and the condition of the car at handover
is not recorded — so at return there is no baseline to compare against and a
damage or fuel dispute cannot be settled.

The client asked for a four-part system: a Rentals table with a
`draft → active → completed` workflow, a customer-side pickup contract with
e-signature, an admin-side return step reached by a unique token link, and
secure API routes with automated email.

## Decisions

1. **Phase 1 carries no database, no object storage and no auth.** The pickup
   form runs client-side and the finished PDF is emailed. The status workflow
   and the token-linked return step are inherently stateful and wait for
   Phase 2. Accepted trade-off: no server-side record of a rental, and no way
   to close one out.

   The form, validation, signature canvas, photo capture, GTC gate and PDF
   template all carry over to Phase 2 unchanged. Only the submit handler is
   replaced, so this is a phase boundary rather than a throwaway.

2. **Delivery is email, not WhatsApp.** The existing booking flow hands off via
   a prefilled `wa.me` link, which cannot carry a file attachment. A single
   stateless route handler sends the PDF instead. This also closes the known
   hole in the booking flow, where nothing is received if the customer never
   presses Send.

3. **SMTP through the client's existing mailbox**, via `nodemailer` on the Node
   runtime. Chosen over Resend because it needs no DNS access and sends from a
   real existing address.

   Noted risk, accepted: this is the same class of setup that already failed in
   production here once (commit `1e7c6b2`), and SMTP from a serverless function
   is slower and less reliable than an HTTP mail API. Mitigated by the download
   fallback in decision 8 rather than by changing provider.

4. **One public form; the customer picks the vehicle and enters the KM.**

   Open question for the client: their brief says the mileage is "to be entered
   manually by me each time", which implies the office enters it. A public form
   puts it on the customer. To be confirmed before Phase 2 hardens it.

5. **The pickup form records a condition baseline** — fuel level, pre-existing
   damage notes and condition photos — even though the client's Step 1 field
   list omits them. Their own schema section asks for fuel level and
   pre-existing damages, and without a baseline captured at handover the return
   step has nothing to compare against. If Phase 2 lands months later, every
   rental taken in the meantime would otherwise have no baseline at all.

6. **The GTC gates the signature.** The terms render inline in the form from
   `locales/gtc.ts` in the customer's language. The signature canvas stays
   inactive and no PDF is generated until the acceptance checkbox is ticked.
   The PDF records the version, the language and the acceptance timestamp, and
   appends the full text.

7. **Images are downscaled at selection, not at submit.** Vercel caps a
   serverless request body at roughly 4.5 MB and three raw phone photos exceed
   that comfortably. Each image goes through
   `createImageBitmap(file, { imageOrientation: "from-image" })` → canvas →
   JPEG at quality 0.72, longest edge 1600 px. The orientation flag is load
   bearing: iPhone photos carry EXIF rotation and would otherwise be embedded
   sideways.

   If the assembled PDF still exceeds 3.5 MB, the photos are recompressed once
   at lower quality and the PDF rebuilt. If it is still too large the customer
   is told which photo to retake, rather than the request failing at the
   network layer.

8. **The customer never loses their work.** Download and native Share are
   offered on the success screen and on every failure path. Having spent
   several minutes photographing documents and signing, losing that to an SMTP
   timeout is the worst available outcome. It also means the page stays usable
   before the SMTP credentials exist.

9. **Partial send counts as success.** If the office copy sends and the
   customer copy bounces, the rental can proceed; the customer is told their
   copy did not arrive and is offered the download.

10. **Real causes are logged, not leaked.** Failures are logged server-side in
    full and returned to the browser as a stable error code. This keeps the
    intent of commit `c52e90c` — naming the actual failure rather than a
    generic string — without telling a public page which environment variable
    is unset.

## Library choices

Departures from the client's suggestions, each for a specific reason:

- **`signature_pad` rather than `react-signature-canvas`.** The React wrapper's
  peer dependencies still lag React 19.1, which this project runs.
  `signature_pad` is the same engine with no React peer dependency, wrapped in
  a small component.
- **`pdf-lib` rather than `@react-pdf/renderer`.** Both were offered. `pdf-lib`
  embeds JPEGs directly and carries a fraction of the bundle, which matters on
  a page loaded on mobile data at the rental counter.
- **`nodemailer`** for SMTP, per decision 3.

## Architecture

```
app/rental/pickup/page.tsx            page shell
app/api/rental-contract/route.ts      POST → email, Node runtime
components/rental/RentalPickupWizard.tsx   orchestrator
components/rental/SignaturePad.tsx         touch signature
components/rental/PhotoCapture.tsx         camera capture + downscale
components/rental/GtcAcceptance.tsx        inline GTC + acceptance gate
lib/rental/fleet.ts                   the ten vehicles: model, plate, VIN
lib/rental/labels.ts                  DE/EN strings for this flow
lib/rental/schema.ts                  zod validation
lib/rental/contractPdf.ts             pure: contract data → PDF bytes
lib/rental/imageCompress.ts           pure: File → downscaled JPEG blob
```

Four steps, reusing the existing `StepIndicator` and shadcn form components:

| Step | Captures |
| --- | --- |
| 1 · Vehicle | Vehicle from the fleet (plate and VIN filled in automatically), current KM, fuel level, pre-existing damage notes, condition photos |
| 2 · Your details | Family name, first name, date of birth, street and number, postal code, city, mobile, email |
| 3 · Documents | ID photo, driving licence photo |
| 4 · Terms and signature | Inline GTC → acceptance → signature → submit |

`lib/rental/labels.ts` holds this flow's German and English strings rather than
the i18n catalogue, following the precedent of `locales/gtc.ts` and
`whatsappMessage.ts`: routing them through `t()` would mean adding keys to
`locales/de.ts`, `locales/en.ts` and `types/i18n.ts` for strings nothing else
uses.

`lib/rental/contractPdf.ts` and `lib/rental/imageCompress.ts` are pure — data
in, bytes out, no DOM beyond the canvas they are handed — so they can be
exercised directly rather than only by driving the form.

## PDF contents

Header with `Rigitrade AG` / ZURIAUTO, contract number, date and time; vehicle
block with model, plate, VIN, mileage and fuel level; customer block; condition
notes and photos; ID and driving licence each on a labelled page; the GTC
version, language and acceptance timestamp; the signature image with printed
name, place and date; and the full GTC text as an appendix.

Contract numbers take the form `ZA-20260810-589864-A7F3` — date, plate digits,
random suffix. With nothing stored there is no uniqueness check; this becomes a
real sequence in Phase 2.

## Security

`/api/rental-contract` is a public, unauthenticated endpoint that sends email
with attachments, which makes it a spam relay vector. Phase 1 mitigates rather
than solves: a payload size cap, an origin check, a honeypot field and a
per-IP limiter held in module scope that resets on cold start. Proper rate
limiting arrives with the Phase 2 datastore.

In Phase 1 the PDF is assembled by the customer's browser, so a determined
customer could alter it before it is sent. Acceptable while the office reads
the document before releasing the keys; resolved in Phase 2 by generating it
server-side.

Identity documents travel by email, which is not encrypted end to end. The
client should be told plainly, and it argues for a retention rule on the office
mailbox.

## Known gaps

- **Fleet data.** The client supplied details for one car of ten (Toyota Prius,
  `ZH 589 864`, chassis `JTD KB2 0U8 001 332 49`). `lib/rental/fleet.ts` ships
  that entry alongside nine clearly marked placeholders to be filled in from a
  single file. The six vehicles in `components/car-rental/booking/data.tsx` are
  marketing entries with euro prices and no plates, and are unrelated.
- **SMTP credentials** are not yet configured. Until they are, the form works
  and falls back to download and share.
- **No test framework** exists in the repository. The pure modules are written
  to be testable; adding a runner is deferred.
