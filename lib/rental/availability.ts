/**
 * The waiting list, for when the whole fleet is out.
 *
 * Ten cars and a good week is all it takes, and the booking page's honest
 * answer then is "nothing today". A customer who reads that and closes the tab
 * is a customer lost to a page that could have taken their address in one
 * field — so the page offers to write to them instead, and this module holds
 * everything about that which does not need a database to test.
 *
 * The send itself is a daily pass, alongside the rental reminders: see
 * `availabilityPass` in scheduler.ts. A car becoming free is not an event this
 * system observes — a rental is closed by somebody pressing a button, and a
 * car leaves the garage by an edit — so the pass asks the only question that
 * is always answerable: is anything available right now, and is anybody still
 * waiting to hear it.
 */

import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { RentalLanguage } from "./labels";

/**
 * What the public form may submit.
 *
 * An address and nothing else. Deliberately not a name, a phone number or a
 * preferred model: every extra field is another thing to store about somebody
 * who is not yet a customer, and the only thing needed to write to them is
 * the address. `language` is what the page already knows, not something the
 * visitor is asked.
 */
export const availabilityAlertSchema = z.object({
  email: z.email("email").max(200),
  language: z.enum(["de", "en"]).optional(),
});

export type AvailabilityAlertInput = z.infer<typeof availabilityAlertSchema>;

/** Lowercased and trimmed, as `normaliseEmail` does for customers — so the
 *  casing somebody typed cannot open a second row for the same person. */
export function normaliseAlertEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The string in the unsubscribe link.
 *
 * 32 bytes of randomness, base64url so it survives being pasted into a mail
 * client that breaks lines. Stored in the clear, unlike ActionToken's hash:
 * this authorises removing one address from a mailing list and nothing else,
 * and a token that could not be resolved after a restore would mean an
 * unsubscribe link that silently fails — which is worse than the exposure it
 * would be protecting against.
 */
export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * How many people one run will write to.
 *
 * A cap, because the daily pass runs inside a serverless function with a
 * sixty-second budget and a list that has quietly grown to a thousand would
 * time out halfway — leaving some sent, some not, and no record of where it
 * stopped. Whoever is left over is still `notifiedAt: null` and goes out
 * tomorrow, which is the correct behaviour for a list this size and a fleet
 * that does not empty often.
 */
export const AVAILABILITY_BATCH = 100;

/**
 * What the visitor is told, in the language the page is in.
 *
 * Kept here rather than in `lib/rental/labels.ts` because the same two strings
 * are needed by the endpoint — which has no React and no label table loaded —
 * when it answers a form posted without JavaScript.
 */
export function availabilityReply(language: RentalLanguage): {
  queued: string;
  invalid: string;
  busy: string;
} {
  if (language === "en") {
    return {
      queued: "Thank you — we will write to you as soon as a car is free.",
      invalid: "Please check the email address.",
      busy: "Too many requests. Please try again in a few minutes.",
    };
  }
  return {
    queued: "Danke — wir melden uns, sobald ein Fahrzeug frei ist.",
    invalid: "Bitte überprüfen Sie die E-Mail-Adresse.",
    busy: "Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.",
  };
}

/**
 * The message itself.
 *
 * Says what is free and links straight at the booking page, because the point
 * of the mail is the thirty seconds after it is opened. It does not name the
 * plate: the car that is free today may be let by lunchtime, and a mail
 * promising ZH 615 132 specifically would be a promise this system cannot
 * keep.
 *
 * The unsubscribe line is in the body rather than only in a header. This goes
 * to somebody who is not a customer and may not remember asking, and a link
 * they can see is the difference between an unsubscribe and a spam report.
 */
export function availabilityMail(ctx: {
  language: RentalLanguage;
  /** How many cars are free as the pass runs. */
  available: number;
  bookUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string } {
  if (ctx.language === "en") {
    return {
      subject: "A car is available at ZURIAUTO",
      text: [
        ctx.available === 1
          ? "A car has just become available."
          : `${ctx.available} cars have just become available.`,
        "",
        "You asked us to let you know. Availability changes through the day,",
        "so it is worth getting in touch soon:",
        "",
        ctx.bookUrl,
        "",
        "If you no longer want these messages, unsubscribe here:",
        ctx.unsubscribeUrl,
      ].join("\n"),
    };
  }

  return {
    subject: "Ein Fahrzeug ist bei ZURIAUTO verfügbar",
    text: [
      ctx.available === 1
        ? "Ein Fahrzeug ist soeben frei geworden."
        : `${ctx.available} Fahrzeuge sind soeben frei geworden.`,
      "",
      "Sie hatten uns gebeten, Sie zu benachrichtigen. Die Verfügbarkeit",
      "ändert sich im Laufe des Tages — melden Sie sich am besten bald:",
      "",
      ctx.bookUrl,
      "",
      "Wenn Sie keine weiteren Nachrichten wünschen, hier abmelden:",
      ctx.unsubscribeUrl,
    ].join("\n"),
  };
}

/** The absolute link that removes one address from the list. */
export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/availability/unsubscribe/?token=${encodeURIComponent(token)}`;
}
