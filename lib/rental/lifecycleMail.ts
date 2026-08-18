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
  message: { to: string; subject: string; text: string; replyTo?: string }
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

  await transport.sendMail({ from: config.from, ...message });
}

/** `18.08.2026, 10:00` — how Switzerland writes it. */
export function formatZurich(at: Date): string {
  return at.toLocaleString("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
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
}): { subject: string; text: string } {
  const amount = `CHF ${formatChf(ctx.amountCents)}`;

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
        // The amount is stated in words because the static SumUp page cannot
        // be pre-filled — the payer types it in.
        `Amount: ${amount}`,
        `Reference: ${ctx.reference}`,
        "",
        "Please enter the amount above on the payment page:",
        ctx.paymentUrl,
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
      `Betrag: ${amount}`,
      `Referenz: ${ctx.reference}`,
      "",
      "Bitte geben Sie den oben genannten Betrag auf der Zahlungsseite ein:",
      ctx.paymentUrl,
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
  kind: "overdue" | "chargeOverdue" | "returnIntent" | "extension";
  renterName: string;
  renterEmail: string;
  renterPhone: string;
  carModel: string;
  plate: string;
  endAt: Date;
  detail?: string;
}): { subject: string; text: string } {
  const subjects = {
    overdue: `Überfällig: ${ctx.plate} – ${ctx.renterName}`,
    chargeOverdue: `Zahlung offen: ${ctx.plate} – ${ctx.renterName}`,
    returnIntent: `Rückgabe angekündigt: ${ctx.plate} – ${ctx.renterName}`,
    extension: `Miete verlängert: ${ctx.plate} – ${ctx.renterName}`,
  } as const;

  const headlines = {
    overdue: `Das Fahrzeug ${ctx.plate} ist seit ${formatZurich(ctx.endAt)} überfällig.`,
    chargeOverdue: `Eine Zahlung für ${ctx.plate} ist trotz Erinnerung offen.`,
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
      `Rückgabe:  ${formatZurich(ctx.endAt)}`,
      ...(ctx.detail ? ["", ctx.detail] : []),
    ].join("\n"),
  };
}
