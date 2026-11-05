/**
 * The emails the scheduler sends.
 *
 * Kept apart from `mail.ts`, which sends the signed contract with its PDF
 * attachment. These are short plain-text messages with a link, and their
 * templates are here rather than in `labels.ts` because nothing on screen shares
 * them — the pickup labels exist in the same table as the PDF labels precisely
 * so a field cannot be renamed on screen without the document following, and
 * that argument does not apply to a reminder nobody sees in the browser.
 *
 * Plain text with a bare URL, matching the contract email: mail clients linkify
 * it, and a text part reaches every client without an HTML fallback to maintain.
 */

import nodemailer from "nodemailer";
import { formatChf } from "./money";
import type { RentalLanguage } from "./labels";

export interface LifecycleMailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  office: string;
}

export function readLifecycleMailConfig(): LifecycleMailConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_OFFICE } =
    process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_OFFICE) return null;

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: MAIL_FROM || SMTP_USER,
    office: MAIL_OFFICE,
  };
}

/**
 * Sends one message, or throws.
 *
 * Throwing is deliberate here, unlike in `mail.ts`: the caller is always
 * `sendOnce`, which needs the failure so it can record it on the notification
 * row for `mailRetryPass` to pick up.
 */
export async function sendMail(
  config: LifecycleMailConfig,
  message: {
    to: string;
    subject: string;
    text: string;
    replyTo?: string;
    /** The fines mails carry the issuer's letter, for its payment slip. */
    attachments?: { filename: string; content: Uint8Array; contentType: string }[];
  }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({
    from: config.from,
    ...message,
    attachments: message.attachments?.map((attachment) => ({
      ...attachment,
      content: Buffer.from(attachment.content),
    })),
  });
}

/** `18.08.2026, 10:00` — how Switzerland writes it. */
export function formatZurich(at: Date): string {
  return at.toLocaleString("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}

/** The return as the office mails print it; a running weekly rental has none. */
function formatReturn(endAt: Date | null): string {
  return endAt ? formatZurich(endAt) : "offen – Wochenmiete bis zur Rückgabe";
}

interface RentalContext {
  firstName: string;
  carModel: string;
  plate: string;
  endAt: Date;
  language: RentalLanguage;
}

// ---------------------------------------------------------------------
// Renter: your rental is ending
// ---------------------------------------------------------------------

export function rentalEndingMail(
  ctx: RentalContext & { manageUrl: string }
): { subject: string; text: string } {
  const when = formatZurich(ctx.endAt);

  if (ctx.language === "en") {
    return {
      subject: `Your rental ends on ${when} – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        `Your rental of the ${ctx.carModel} (${ctx.plate}) is due to end on ${when}.`,
        "",
        "Please let us know what you would like to do — return the car, or keep it for longer:",
        ctx.manageUrl,
        "",
        "The link works once and expires in two weeks. If it has stopped working, reply to this email and we will send a new one.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: `Ihre Miete endet am ${when} – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      `Ihre Miete des ${ctx.carModel} (${ctx.plate}) endet am ${when}.`,
      "",
      "Bitte teilen Sie uns mit, wie Sie weiter vorgehen möchten — Fahrzeug zurückgeben oder Miete verlängern:",
      ctx.manageUrl,
      "",
      "Der Link ist einmalig gültig und läuft in zwei Wochen ab. Falls er nicht mehr funktioniert, antworten Sie einfach auf diese E-Mail.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// Renter: a weekly payment is due
// ---------------------------------------------------------------------

export function chargeDueMail(ctx: {
  firstName: string;
  carModel: string;
  plate: string;
  weekNumber: number;
  amountCents: number;
  paymentUrl: string;
  reference: string;
  language: RentalLanguage;
  isReminder: boolean;
  /** The week's due date; printed so the renter can tell which week is meant. */
  dueDate?: Date;
}): { subject: string; text: string } {
  const amount = `CHF ${formatChf(ctx.amountCents)}`;
  const due = ctx.dueDate ? formatZurichDay(ctx.dueDate) : null;

  if (ctx.language === "en") {
    return {
      subject: ctx.isReminder
        ? `Reminder: week ${ctx.weekNumber} payment – ${ctx.plate}`
        : `Week ${ctx.weekNumber} payment due – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        ctx.isReminder
          ? `We have not yet received the payment for week ${ctx.weekNumber} of your rental of the ${ctx.carModel} (${ctx.plate}).`
          : `The payment for week ${ctx.weekNumber} of your rental of the ${ctx.carModel} (${ctx.plate}) is now due.`,
        "",
        // Near the top on purpose: cash paid at the desk reaches the system
        // only when the office records it, so a renter who paid may still be
        // written to. They must not have to read to the end to learn that.
        PAID_ALREADY_EN,
        "",
        // The amount is stated in words because the static SumUp page cannot
        // be pre-filled — the payer types it in.
        `Amount: ${amount}`,
        ...(due ? [`Due on: ${due}`] : []),
        `Reference: ${ctx.reference}`,
        "",
        "Please enter the amount above on the payment page:",
        ctx.paymentUrl,
        "",
        "Questions? Simply reply to this email.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: ctx.isReminder
      ? `Erinnerung: Zahlung Woche ${ctx.weekNumber} – ${ctx.plate}`
      : `Zahlung Woche ${ctx.weekNumber} fällig – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      ctx.isReminder
        ? `Die Zahlung für Woche ${ctx.weekNumber} Ihrer Miete des ${ctx.carModel} (${ctx.plate}) ist bei uns noch nicht eingegangen.`
        : `Die Zahlung für Woche ${ctx.weekNumber} Ihrer Miete des ${ctx.carModel} (${ctx.plate}) ist jetzt fällig.`,
      "",
      PAID_ALREADY_DE,
      "",
      `Betrag: ${amount}`,
      ...(due ? [`Fällig am: ${due}`] : []),
      `Referenz: ${ctx.reference}`,
      "",
      "Bitte geben Sie den oben genannten Betrag auf der Zahlungsseite ein:",
      ctx.paymentUrl,
      "",
      "Fragen? Antworten Sie einfach auf diese E-Mail.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

/** The line every payment request and reminder carries, in both languages. */
export const PAID_ALREADY_DE =
  "Bereits bezahlt (z. B. bar im Büro oder per TWINT)? Dann betrachten Sie diese Nachricht bitte als gegenstandslos – Sie müssen nichts tun.";
export const PAID_ALREADY_EN =
  "Already paid (e.g. in cash at the office or by TWINT)? Then please ignore this message – there is nothing you need to do.";

/** `05.11.2026`: an instant's Zurich calendar day. */
function formatZurichDay(at: Date): string {
  return at.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------
// Renter: please ignore an earlier payment email
// ---------------------------------------------------------------------

/**
 * Sent only when the office presses "Korrektur senden" on a payment email
 * whose week is paid, settled or waived — never automatically, and never for
 * a week still owed, where "ignore it" would be untrue.
 */
export function chargeCorrectionMail(ctx: {
  firstName: string;
  carModel: string;
  plate: string;
  weekNumber: number;
  amountCents: number;
  /** When the email to be ignored went out. */
  sentAt: Date;
  language: RentalLanguage;
}): { subject: string; text: string } {
  const amount = `CHF ${formatChf(ctx.amountCents)}`;
  const sent = formatZurichDay(ctx.sentAt);

  if (ctx.language === "en") {
    return {
      subject: `Please ignore: week ${ctx.weekNumber} payment – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        `On ${sent} we sent you a payment request for week ${ctx.weekNumber} (${amount}) of your rental of the ${ctx.carModel} (${ctx.plate}).`,
        "",
        "This week is settled on our side. Please ignore that message – there is nothing you need to do.",
        "",
        "We apologise for the inconvenience.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: `Bitte ignorieren: Zahlung Woche ${ctx.weekNumber} – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      `Am ${sent} haben wir Ihnen eine Zahlungsaufforderung für Woche ${ctx.weekNumber} (${amount}) Ihrer Miete des ${ctx.carModel} (${ctx.plate}) gesendet.`,
      "",
      "Diese Woche ist bei uns erledigt. Bitte betrachten Sie die Nachricht als gegenstandslos – Sie müssen nichts tun.",
      "",
      "Entschuldigen Sie die Unannehmlichkeiten.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// Renter: extension confirmed
// ---------------------------------------------------------------------

export function extensionConfirmedMail(ctx: {
  firstName: string;
  carModel: string;
  plate: string;
  weeksAdded: number;
  newEndAt: Date;
  amountCents: number;
  paymentUrl: string;
  language: RentalLanguage;
}): { subject: string; text: string } {
  const when = formatZurich(ctx.newEndAt);
  const amount = `CHF ${formatChf(ctx.amountCents)}`;

  if (ctx.language === "en") {
    return {
      subject: `Rental extended to ${when} – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        `Your rental of the ${ctx.carModel} (${ctx.plate}) has been extended by ${ctx.weeksAdded} week(s).`,
        `The new return date is ${when}.`,
        "",
        `Additional amount: ${amount}`,
        "",
        "You can pay here:",
        ctx.paymentUrl,
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: `Miete verlängert bis ${when} – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      `Ihre Miete des ${ctx.carModel} (${ctx.plate}) wurde um ${ctx.weeksAdded} Woche(n) verlängert.`,
      `Neues Rückgabedatum: ${when}.`,
      "",
      `Zusätzlicher Betrag: ${amount}`,
      "",
      "Hier können Sie bezahlen:",
      ctx.paymentUrl,
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// Office alerts. German only — the office reads German.
// ---------------------------------------------------------------------

export function officeAlertMail(ctx: {
  kind: "overdue" | "chargeOverdue" | "chargeOfficeOnly" | "returnIntent" | "extension";
  renterName: string;
  renterEmail: string;
  renterPhone: string;
  carModel: string;
  plate: string;
  endAt: Date | null;
  detail?: string;
}): { subject: string; text: string } {
  const subjects = {
    overdue: `Überfällig: ${ctx.plate} – ${ctx.renterName}`,
    chargeOverdue: `Zahlung offen: ${ctx.plate} – ${ctx.renterName}`,
    chargeOfficeOnly: `Zahlung offen (nicht an Mieter gesendet): ${ctx.plate} – ${ctx.renterName}`,
    returnIntent: `Rückgabe angekündigt: ${ctx.plate} – ${ctx.renterName}`,
    extension: `Miete verlängert: ${ctx.plate} – ${ctx.renterName}`,
  } as const;

  const headlines = {
    overdue: `Das Fahrzeug ${ctx.plate} ist seit ${formatReturn(ctx.endAt)} überfällig.`,
    chargeOverdue: `Eine Zahlung für ${ctx.plate} ist trotz Erinnerung offen.`,
    chargeOfficeOnly: `Eine Woche für ${ctx.plate} ist offen. Der Mieter wurde bewusst NICHT automatisch angeschrieben — bitte selbst klären.`,
    returnIntent: `Der Mieter hat die Rückgabe von ${ctx.plate} angekündigt.`,
    extension: `Der Mieter hat die Miete von ${ctx.plate} verlängert.`,
  } as const;

  return {
    subject: subjects[ctx.kind],
    text: [
      headlines[ctx.kind],
      "",
      `Mieter:    ${ctx.renterName}`,
      `E-Mail:    ${ctx.renterEmail}`,
      `Telefon:   ${ctx.renterPhone}`,
      `Fahrzeug:  ${ctx.carModel} (${ctx.plate})`,
      `Rückgabe:  ${formatReturn(ctx.endAt)}`,
      ...(ctx.detail ? ["", ctx.detail] : []),
    ].join("\n"),
  };
}

/**
 * The safety stop on renter payment emails tripped.
 *
 * Far more payment emails than a normal day were about to go out, which is
 * what the 05.11.2026 backlog looked like. None was sent; the office checks
 * the list on the payments page and releases it there, or settles what was
 * paid in cash first.
 */
export function paymentMailHoldMail(ctx: {
  cap: number;
  rows: { renterName: string; plate: string; weekNumber: number; amountCents: number; dueDate: Date; reminder: boolean; officeOnly?: boolean }[];
  pageUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `Zahlungs-E-Mails angehalten: ${ctx.rows.length} statt höchstens ${ctx.cap} – bitte prüfen`,
    text: [
      `Heute wären ${ctx.rows.length} Zahlungs-E-Mails an Mieter gegangen (normal: höchstens ${ctx.cap}). Zur Sicherheit wurde KEINE gesendet.`,
      "",
      "Bitte prüfen: Bar bezahlte Wochen erfassen oder erlassen, dann auf der Zahlungsseite «Jetzt senden» drücken.",
      ctx.pageUrl,
      "",
      ...ctx.rows.map(
        (r) =>
          `- ${r.renterName} · ${r.plate} · Woche ${r.weekNumber} · CHF ${formatChf(r.amountCents)} · fällig ${formatZurichDay(r.dueDate)}${r.reminder ? " · Erinnerung" : ""}${r.officeOnly ? " · nur ans Büro" : ""}`
      ),
    ].join("\n"),
  };
}

/**
 * `14.07.2026` — a plain calendar day.
 *
 * Reads the UTC parts deliberately. `mfkDate` is a DATE column, which Prisma
 * hands back as midnight UTC; running that through a Zurich formatter would
 * print the *previous* day west of the meridian and an unwanted "02:00"
 * besides. A date column has no time to render, so none is rendered.
 */
export function formatDay(at: Date): string {
  const d = String(at.getUTCDate()).padStart(2, "0");
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${at.getUTCFullYear()}`;
}

/**
 * The annual technical inspection is due.
 *
 * Written to the office, never to a renter: the MFK is the owner's obligation,
 * and a customer has nothing to do with it.
 *
 * Says what the system already did, not only what is due. The office is being
 * told a car came off the road, and a mail that left them to discover that
 * from the fleet screen would read as the tool having done something behind
 * their back.
 */
export function mfkDueMail(ctx: {
  carModel: string;
  plate: string;
  mfkDate: Date;
  expired: boolean;
  /** Set when the car is out, so the office can call and arrange its return. */
  rental: {
    renterName: string;
    renterEmail: string;
    renterPhone: string;
    endAt: Date | null;
  } | null;
  /** True when this run took the car off the road. */
  blocked: boolean;
}): { subject: string; text: string } {
  const when = formatDay(ctx.mfkDate);

  const headline = ctx.expired
    ? `Die MFK für ${ctx.plate} ist seit ${when} fällig.`
    : `Die MFK für ${ctx.plate} ist am ${when} fällig.`;

  const outcome = ctx.rental
    ? [
        "Das Fahrzeug ist vermietet. Bitte Rückholung mit dem Mieter vereinbaren:",
        "",
        `Mieter:    ${ctx.rental.renterName}`,
        `Telefon:   ${ctx.rental.renterPhone}`,
        `E-Mail:    ${ctx.rental.renterEmail}`,
        `Rückgabe:  ${formatReturn(ctx.rental.endAt)}`,
      ]
    : ctx.blocked
      ? [
          "Das Fahrzeug stand frei und wurde auf «Werkstatt / MFK» gesetzt.",
          "Es ist damit nicht mehr buchbar.",
          "",
          "Nach der Prüfung bitte das neue MFK-Datum erfassen und das",
          "Fahrzeug wieder auf «Verfügbar» setzen.",
        ]
      : ["Das Fahrzeug ist bereits ausser Betrieb."];

  return {
    subject: `MFK ${ctx.expired ? "überfällig" : "fällig"}: ${ctx.plate} – ${when}`,
    text: [
      headline,
      "",
      `Fahrzeug:  ${ctx.carModel} (${ctx.plate})`,
      `MFK:       ${when}`,
      "",
      ...outcome,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// The two-week MFK notice (owner, 05.11.2026).
//
// Unlike mfkDueMail, this one also goes to the renter: a renter driving the
// car for Bolt has to know a fortnight ahead that it will be away for a day.
// ---------------------------------------------------------------------

/** "in 14 Tagen" / "heute" / "seit 3 Tagen". */
function inDays(days: number, language: RentalLanguage): string {
  if (language === "en") {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
  }
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return days > 0 ? `in ${days} Tagen` : `seit ${-days} Tagen`;
}

export function mfkNoticeOfficeMail(ctx: {
  carModel: string;
  plate: string;
  mfkDate: Date;
  daysLeft: number;
  rental: {
    renterName: string;
    renterEmail: string;
    renterPhone: string;
    endAt: Date | null;
    /** False when the renter has no address on file, so was not written to. */
    renterMailed: boolean;
  } | null;
}): { subject: string; text: string } {
  const when = formatDay(ctx.mfkDate);

  const outcome = ctx.rental
    ? [
        "Das Fahrzeug ist vermietet.",
        ctx.rental.renterMailed
          ? "Der Mieter wurde per E-Mail informiert."
          : "Der Mieter hat keine E-Mail-Adresse erfasst – bitte telefonisch informieren.",
        "",
        `Mieter:    ${ctx.rental.renterName}`,
        `Telefon:   ${ctx.rental.renterPhone}`,
        `E-Mail:    ${ctx.rental.renterEmail}`,
        `Rückgabe:  ${formatReturn(ctx.rental.endAt)}`,
      ]
    : ["Das Fahrzeug ist zurzeit nicht vermietet."];

  return {
    subject: `MFK ${inDays(ctx.daysLeft, "de")}: ${ctx.plate} – ${when}`,
    text: [
      `Die MFK für ${ctx.plate} ist am ${when} fällig (${inDays(ctx.daysLeft, "de")}).`,
      "",
      `Fahrzeug:  ${ctx.carModel} (${ctx.plate})`,
      `MFK:       ${when}`,
      "",
      ...outcome,
      "",
      "Bitte Prüftermin vereinbaren. Zwei Tage vor dem Datum wird ein freies",
      "Fahrzeug automatisch auf «Werkstatt / MFK» gesetzt.",
    ].join("\n"),
  };
}

export function mfkNoticeRenterMail(ctx: {
  firstName: string;
  carModel: string;
  plate: string;
  mfkDate: Date;
  daysLeft: number;
  language: RentalLanguage;
}): { subject: string; text: string } {
  const when = formatDay(ctx.mfkDate);

  if (ctx.language === "en") {
    return {
      subject: `Vehicle inspection (MFK) on ${when} – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        `The ${ctx.carModel} (${ctx.plate}) you are renting is due for its official vehicle inspection (MFK) on ${when} (${inDays(ctx.daysLeft, "en")}).`,
        "",
        "The car has to be brought in for the inspection. We will contact you to agree on a time; you can also reply to this email.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: `Fahrzeugprüfung (MFK) am ${when} – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      `Für den ${ctx.carModel} (${ctx.plate}), den Sie mieten, ist am ${when} die amtliche Fahrzeugprüfung (MFK) fällig (${inDays(ctx.daysLeft, "de")}).`,
      "",
      "Das Fahrzeug muss dafür zur Prüfung gebracht werden. Wir melden uns, um einen Termin abzusprechen – Sie können auch einfach auf diese E-Mail antworten.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// The oil service, every 10'000 km (owner, 05.11.2026).
// ---------------------------------------------------------------------

/** `105'600` — the Swiss grouping, with a plain apostrophe (see formatKm). */
function km(value: number): string {
  return value.toLocaleString("de-CH").replace(/’/g, "'");
}

export interface ServiceMailFigures {
  dueKm: number;
  estimatedKmNow: number;
  estimatedDueOn: Date;
  /** A real reading, not a projection, has passed the due figure. */
  overdue: boolean;
}

export function serviceDueOfficeMail(
  ctx: ServiceMailFigures & {
    carModel: string;
    plate: string;
    lastReadingKm: number;
    lastReadingAt: Date;
    kmPerDay: number;
    /** "history" when the pace was measured from this car's readings. */
    rateSource: "history" | "default";
    rental: {
      renterName: string;
      renterEmail: string;
      renterPhone: string;
      renterMailed: boolean;
    } | null;
  }
): { subject: string; text: string } {
  const headline = ctx.overdue
    ? `Der Ölservice für ${ctx.plate} ist überfällig: fällig bei ${km(ctx.dueKm)} km, abgelesen ${km(ctx.lastReadingKm)} km.`
    : `Der Ölservice für ${ctx.plate} ist bald fällig: bei ${km(ctx.dueKm)} km, voraussichtlich um den ${formatDay(ctx.estimatedDueOn)}.`;

  const pace =
    ctx.rateSource === "history"
      ? `${km(Math.round(ctx.kmPerDay))} km/Tag (aus den Ablesungen dieses Fahrzeugs)`
      : `${km(Math.round(ctx.kmPerDay))} km/Tag (Annahme: 10'000 km in 45–60 Tagen)`;

  const outcome = ctx.rental
    ? [
        ctx.rental.renterMailed
          ? "Der Mieter wurde per E-Mail informiert."
          : "Der Mieter hat keine E-Mail-Adresse erfasst – bitte telefonisch informieren.",
        "",
        `Mieter:    ${ctx.rental.renterName}`,
        `Telefon:   ${ctx.rental.renterPhone}`,
        `E-Mail:    ${ctx.rental.renterEmail}`,
      ]
    : ["Das Fahrzeug ist zurzeit nicht vermietet."];

  return {
    subject: ctx.overdue
      ? `Service überfällig: ${ctx.plate} – ${km(ctx.dueKm)} km`
      : `Service fällig: ${ctx.plate} – bei ${km(ctx.dueKm)} km`,
    text: [
      headline,
      "",
      `Fahrzeug:        ${ctx.carModel} (${ctx.plate})`,
      `Service fällig:  ${km(ctx.dueKm)} km`,
      `Letzte Ablesung: ${km(ctx.lastReadingKm)} km am ${formatZurich(ctx.lastReadingAt)}`,
      `Heute geschätzt: ${km(ctx.estimatedKmNow)} km`,
      `Tempo:           ${pace}`,
      "",
      ...outcome,
      "",
      "Nach dem Service bitte den Kilometerstand unter «Service» erfassen.",
      "Der nächste Service wird dann automatisch auf +10'000 km gesetzt.",
    ].join("\n"),
  };
}

export function serviceDueRenterMail(
  ctx: ServiceMailFigures & {
    firstName: string;
    carModel: string;
    plate: string;
    language: RentalLanguage;
  }
): { subject: string; text: string } {
  const around = formatDay(ctx.estimatedDueOn);

  if (ctx.language === "en") {
    return {
      subject: ctx.overdue
        ? `Oil service overdue – ${ctx.plate}`
        : `Oil service due at ${km(ctx.dueKm)} km – ${ctx.plate}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        ctx.overdue
          ? `The ${ctx.carModel} (${ctx.plate}) you are renting has passed ${km(ctx.dueKm)} km, when its oil service was due.`
          : `The ${ctx.carModel} (${ctx.plate}) you are renting is due for its oil service at ${km(ctx.dueKm)} km.`,
        ...(ctx.overdue
          ? []
          : [
              `By our estimate the car is at about ${km(ctx.estimatedKmNow)} km, so that is around ${around}.`,
            ]),
        "",
        "Please contact us to arrange the service — simply reply to this email.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject: ctx.overdue
      ? `Ölservice überfällig – ${ctx.plate}`
      : `Ölservice fällig bei ${km(ctx.dueKm)} km – ${ctx.plate}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      ctx.overdue
        ? `Der ${ctx.carModel} (${ctx.plate}), den Sie mieten, hat ${km(ctx.dueKm)} km überschritten – der Ölservice ist fällig.`
        : `Für den ${ctx.carModel} (${ctx.plate}), den Sie mieten, ist bei ${km(ctx.dueKm)} km der Ölservice fällig.`,
      ...(ctx.overdue
        ? []
        : [
            `Nach unserer Schätzung steht das Fahrzeug bei etwa ${km(ctx.estimatedKmNow)} km – das ist ungefähr am ${around}.`,
          ]),
      "",
      "Bitte melden Sie sich, um den Service zu vereinbaren – antworten Sie einfach auf diese E-Mail.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}
