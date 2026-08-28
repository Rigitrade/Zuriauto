# Phase 4 — the return, recorded

**Date:** 2026-08-28
**Status:** accepted
**Supersedes:** the Phase 4 sketch in `2026-08-16-rental-platform-roadmap.md`

## Problem

The return wizard has been complete since Phase 1 and records nothing. It
builds a signed PDF in the browser, emails it to the office and to the renter,
and stops. The rental it describes stays `ACTIVE`, and the car it describes
stays `rented` — so a car that came back last week is still missing from the
picker until somebody notices.

The fleet admin page closed half of that gap: an office user can mark a rental
finished and free its car in one click. What it cannot do is know that a return
*happened*. The click is an override, and its own source says so. The office is
still the only record that a car came back at 14:00 with three quarters of a
tank and a scratch on the rear bumper.

Phase 2 anticipated this. `ContractKind.RETURN_ADDENDUM` exists in the first
migration, and the schema comment beside it says why mileage, fuel level and
damage notes live on `Contract` rather than on `Rental`: so the return is a
*comparison against* the pickup baseline rather than an overwrite of it. This
phase fills that row in.

## What this is not

It is not a fence around the return form. The form is opened by the renter,
often on their own phone, and there is no credential they reliably hold —
`APPLY_SECRET` is an office key that must never be mailed to a customer, and a
manage-link `ActionToken` only exists for rentals that reached the Phase 3
reminder. Requiring either would mean a returning customer with no email to
hand cannot complete a return, which is worse than the problem being solved.

## Decisions

### 1. The rental is found by the car, not supplied by the client

The form asks for a vehicle, a name and an email. The vehicle is the only field
that maps to a row we can trust, and the mapping is unambiguous: `persistPickup`
refuses a second handover of a car already `rented`, so a car has at most one
rental that is neither `COMPLETED` nor `CANCELLED`.

The submitted email is *not* used to select the rental. Matching on it would
refuse the return precisely when a renter typed their address differently than
they did at pickup, which is a normal thing to have done. It is compared
afterwards and recorded as a flag for the office, which is all the signal it can
honestly carry.

### 2. The return records itself; the office frees the car

The rental moves `ACTIVE` (or `EXTENSION_REQUESTED`) → `RETURN_SUBMITTED`.
**The car stays `rented`.**

This is the decision that shapes everything else. An unfenced form that set a
car back to `available` would let anyone who can read a numberplate put a car
somebody is currently driving back into the picker — the exact state
`app/api/admin/rentals/[id]/close/route.ts` already names as the one worth
avoiding, since a customer could then sign a contract for it.

So the office keeps the last step, and the step gets much smaller: instead of
reconstructing a return from an email and running an override, they confirm a
return that is already recorded, with its document attached and its condition
data in the row. The existing close endpoint needs no change — it already
accepts any rental that is not `COMPLETED` or `CANCELLED`.

`RETURN_SUBMITTED` was reserved for exactly this in Phase 3; the return-intent
endpoint's comment says so.

### 3. A return that cannot be recorded is still emailed

Three cases produce no matching rental: a car that predates Phase 2, a rental
closed by hand, and a plate the database does not know. A fourth is the database
or the bucket being unavailable.

In all four the route falls back to what it does today — build the mail, send
it, answer 200 — and reports `recorded: false`. The signed document reaching the
office is the thing that must not be lost; the row is an improvement on it, not
a precondition for it. This mirrors the pickup route, where a storage failure
answers 503 and the wizard falls back to download-and-email.

### 4. The document's number is the stored number

The return number is generated in the browser, printed on the PDF, and shown to
the renter before anything is posted. Allocating a sequenced `ZR-` number
server-side would put a different number in the database than on the paper the
customer is holding.

So the client's number is stored as `Contract.contractNumber`. It is not a
sequence and does not pretend to be. On the unique-constraint collision that the
random suffix makes very unlikely but not impossible, the row is written with a
`-2` discriminator and the divergence is recorded in the rental event, because
silently dropping the return would be worse than a number that needs one
sentence of explanation.

Giving returns a real sequence means the client asking the server for a number
before it builds the PDF — a second round trip on a form that is often on mobile
data. Deferred, not rejected.

### 5. Condition goes on the contract; everything else goes on the event

`Contract` has columns for `mileageKm`, `fuelLevel` and `damageNotes`, which is
three of the fifteen things the form collects. The rest — cleanliness, traffic
tickets, payment method, amounts, the deposit answer — go into the
`RentalEvent.payload` JSON as `return.recorded`.

Splitting on "does the pickup baseline compare against it" rather than adding
eleven columns keeps the comparison the schema was designed for cheap, and keeps
a form that will change shape again out of the migration path.

### 6. The mileage comparison happens server-side

The form's own `mileagePickupKm` field is optional and typed by the customer.
Now that the rental is resolved, the pickup contract's mileage is available
without asking anyone, so the distance driven is computed and recorded on the
event.

A return reading *below* the pickup baseline is flagged, not refused. It is
certainly a typo, but the document is already signed and in the renter's hands;
refusing the record would lose the return to save a field. The flag reaches the
office in the mail summary.

The figure is deliberately not sent back to the browser to fill the form's
optional field. That would let anyone who can select a plate read its current
mileage from an unfenced endpoint.

### 7. One return per rental

A second submission for a rental that already has a `RETURN_ADDENDUM` is
refused at the recording step and still emailed. The rental status update is a
conditional `updateMany` whose `WHERE` repeats the precondition, following the
Phase 3 pattern: the check can pass twice, the write can only land once.

## Order of operations

Unchanged from `persistPickup`, for the reasons written there.

1. Resolve the rental. No match → email only.
2. Upload the signature images and the PDF to the bucket. Failure aborts before
   any row is written and leaves sweepable orphans under one prefix.
3. One transaction: create the `Contract`, its `Asset` rows and the
   `RentalEvent`; conditionally move the rental to `RETURN_SUBMITTED`.
4. Send the mail. Stamp `mailSentAt` or `mailError` on the row afterwards.

A mail failure leaves the return recorded, which inverts the Phase 1 failure
mode where a failed send meant the return existed nowhere.

## What the office sees

`/api/admin/overview` gains a `returnsAwaiting` count and marks each rental with
`returnSubmittedAt` and its `returnContractNumber`. The fleet page sorts those
rentals first and labels them, so "what came back that I have not confirmed" is
the first thing on the screen rather than something to work out from dates.

## Open questions

1. Should confirming a return in `/admin` also record who confirmed it? Today
   `createdBy` is `"office"` everywhere and Phase 5 brings named accounts; this
   is the same gap, not a new one.
2. Should a `RETURN_SUBMITTED` rental stop the Phase 3 overdue pass from
   emailing the renter? Arguably yes — the car is back. Left alone for now
   because the car is not *confirmed* back, and a false "you are overdue" is
   less bad than silence about a car nobody has looked at.
