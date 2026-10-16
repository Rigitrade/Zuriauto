# Rental types and the weekly extension question — design

Status: decisions taken 16.10.2026, not built.

## What was asked (owner, 16.10.2026)

- Two kinds of rental: weekly for work (drivers and other business renters),
  daily for tourism.
- 72 hours before a rental week ends, the renter gets a WhatsApp message:
  "Will you extend your car rental for the next week? YES / NO", in German,
  French and English.
- The point: the office always knows what is rented until when, and when each
  car comes back.

## Decisions (16.10.2026)

1. **Names.** The `RentalType` values stay (`WEEKLY`, `FIXED_TERM`); only the
   words change, on the pickup form, the contract PDF, the office emails and
   the admin:

   | | DE | EN | FR |
   |---|---|---|---|
   | WEEKLY | Geschäftlich – wöchentlich / monatlich | Business – weekly / monthly | Affaires – hebdomadaire / mensuelle |
   | FIXED_TERM | Tourismus – Tagesmiete | Tourism – daily rent | Tourisme – location journalière |

   The names are Eng Ahmed's (16.10.2026, 23:52). "Monthly" is a name, not a
   billing rhythm: a month is entered as four weeks and billed week by week.

2. **Number of weeks comes back, optional, prefilled with 1.** A weekly rental
   has an end again: `endAt = startAt + N weeks`, `totalWeeks = N`. This
   replaces the open-ended weekly rental of 16.10.2026 (`endAt` null) for new
   rentals. The ending reminder, the overdue alert and the online extension
   apply to weekly rentals again.
3. **Daily rentals: email only**, as today (the reminder 24–48 hours before the
   end, with the manage link). No WhatsApp.
4. **Weekly rentals: the WhatsApp question, 72 hours before `endAt`.**
   - **YES** extends by one week through the existing online extension
     (`lib/rental/manage.ts`, the rental's weekly price): `endAt` + 7 days,
     `totalWeeks` + 1, the new week's charge. The renter gets a confirmation.
   - **NO** records the return intent (`recordReturnIntent`). The dashboard
     shows "Rückgabe am <endAt>".
   - **No answer 24 hours later** (48 hours before the end): the office gets
     an alert to call the renter.
   - Asked once per week end (one notification per rental and `endAt`), in
     the language of the renter's contract.
5. **Fallback by email.** A renter without WhatsApp, or a message that fails,
   gets the same question by email with YES / NO links (manage tokens).

## Open questions

- **Rentals signed between 16.10 and this change** have no end (`endAt`
  null). Proposed: give each an end at the close of its current week, so the
  question reaches them too. Needs a read of the live data and the owner's OK.
- **YES while a week is unpaid.** Extend anyway and let Offene Beträge show
  the debt, or ask the office first? Proposed: extend, and say so in the
  office alert.
- **Weekly email reminder.** Keep the 24–48 hour email as well, or send it
  only when WhatsApp failed or got no answer? Proposed: only then.

## WhatsApp: what has to exist first (one-time, Eng Ahmed)

The site today only opens a chat (`lib/whatsapp.ts`, a wa.me link). Sending
a message with buttons needs the WhatsApp Business Platform:

- A Meta Business account for Rigitrade AG, verified. Either Meta's Cloud API
  directly or a provider (Twilio, 360dialog).
- A phone number for the API. Whether the number in use today
  (+41 76 366 66 69, in the WhatsApp Business app) can serve both, or a
  second number is needed, is checked during the setup.
- One message template with two quick-reply buttons (YES / NO), in DE, FR and
  EN, category Utility, approved by Meta.
- A webhook on the site that receives the replies.
- Meta charges per template message; check the current price for Switzerland.
- Data protection: GTC 15.10.2026 clause 17.3 allows messages to the contact
  details in the contract. The privacy policy has to name Meta (WhatsApp) as
  a recipient, data abroad included.

## Later

- A payment code per rental, typed into TWINT
  (`docs/superpowers/specs/2026-10-15-payments-ledger-design.md`, "Later",
  on `feat/twint-payments`).

## Out of scope

- WhatsApp for daily rentals.
- Changing the weekly price on an extension (the office re-quotes by hand).
