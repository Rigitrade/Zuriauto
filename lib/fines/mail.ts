/**
 * The emails a fine sends.
 *
 * Renters in their contract language (German, else English); the office in
 * German, always. Plain text, like every lifecycle mail: these are read on
 * phones, forwarded, and printed for the accountant.
 *
 * The letter itself is attached by the caller. These say what it is about,
 * that it is paid to the issuer and not to us, and how to tell us it was.
 */

import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";
import { formatChf } from "@/lib/rental/money";
import { formatDay } from "@/lib/rental/lifecycleMail";
import type { RentalLanguage } from "@/lib/rental/labels";

export interface FineMailContext {
  language: RentalLanguage;
  firstName: string;
  plate: string;
  carModel: string;
  violationAt: Date;
  timeKnown: boolean;
  location: string | null;
  offence: { de: string; en: string };
  amountCents: number;
  /** A DATE column — midnight UTC — or null when the letter gave none. */
  dueDate: Date | null;
  issuerName: string | null;
  fineNumber: string | null;
  feeCents: number;
  payUrl: string;
  /** A Mahnung: the deadline is close or past. */
  reminder: boolean;
  /** Our own nudge before the deadline — not a Mahnung, and never called one. */
  dueSoon?: boolean;
}

/** `02.07.2026, 10:00` — the four-digit year letters print, Zurich time. */
export function formatFineMoment(at: Date, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${get("day")}.${get("month")}.${get("year")}`;
  return withTime ? `${day}, ${get("hour")}:${get("minute")}` : day;
}

function chf(cents: number): string {
  return `CHF ${formatChf(cents)}`;
}

export function fineNoticeMail(ctx: FineMailContext): { subject: string; text: string } {
  const day = formatFineMoment(ctx.violationAt, false);
  const when = formatFineMoment(ctx.violationAt, ctx.timeKnown);
  const due = ctx.dueDate ? formatDay(ctx.dueDate) : null;
  const reference = ctx.fineNumber ?? "";

  if (ctx.language === "en") {
    return {
      subject:
        ctx.dueSoon && due
          ? `Reminder: fine for ${ctx.plate} – due ${due}`
          : `${ctx.reminder ? "Reminder: " : ""}Traffic fine for ${ctx.plate} of ${day}`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        ctx.dueSoon
          ? `The fine below is still open. Please pay it${due ? ` by ${due}` : ""}.`
          : ctx.reminder
          ? `The fine below has not been paid yet, and the issuer has sent a reminder. Please pay it now${due ? `, by ${due} at the latest` : ""}.`
          : `We have received a fine for the ${ctx.carModel} (${ctx.plate}), which you were renting at the time.`,
        "",
        `When:      ${when}`,
        ...(ctx.location ? [`Where:     ${ctx.location}`] : []),
        `Offence:   ${ctx.offence.en}`,
        `Amount:    ${chf(ctx.amountCents)}`,
        ...(due ? [`Pay by:    ${due}`] : []),
        ...(ctx.issuerName ? [`Issued by: ${ctx.issuerName}`] : []),
        ...(reference ? [`Number:    ${reference}`] : []),
        "",
        "Please pay the amount directly to the issuer, using the payment slip in the attached letter (scan the QR code with your banking app). ZURIAUTO does not collect it.",
        "",
        "Once you have paid, please confirm it here with a screenshot of the payment:",
        ctx.payUrl,
        ...(ctx.feeCents > 0
          ? [
              "",
              `Under our terms (section 4.2 and the fee table) we charge a handling fee of ${chf(ctx.feeCents)}. Please pay it by card or TWINT, quoting fine ${reference}:`,
              `Card:  ${PAYMENT_URL}`,
              `TWINT: ${TWINT_URL}`,
            ]
          : []),
        "",
        "An unpaid fine comes back as a reminder with further costs.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }

  return {
    subject:
      ctx.dueSoon && due
        ? `Erinnerung: Busse für ${ctx.plate} – zahlbar bis ${due}`
        : `${ctx.reminder ? "Mahnung: " : ""}Busse für ${ctx.plate} vom ${day}`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      ctx.dueSoon
        ? `Die folgende Busse ist noch offen. Bitte bezahlen Sie sie${due ? ` bis ${due}` : ""}.`
        : ctx.reminder
        ? `Die folgende Busse ist noch nicht bezahlt, und wir haben eine Mahnung erhalten. Bitte bezahlen Sie sie jetzt${due ? `, spätestens bis ${due}` : ""}.`
        : `Wir haben eine Busse für den ${ctx.carModel} (${ctx.plate}) erhalten, den Sie zu diesem Zeitpunkt gemietet hatten.`,
      "",
      `Wann:        ${when}`,
      ...(ctx.location ? [`Wo:          ${ctx.location}`] : []),
      `Übertretung: ${ctx.offence.de}`,
      `Betrag:      ${chf(ctx.amountCents)}`,
      ...(due ? [`Zahlbar bis: ${due}`] : []),
      ...(ctx.issuerName ? [`Absender:    ${ctx.issuerName}`] : []),
      ...(reference ? [`Nummer:      ${reference}`] : []),
      "",
      "Bitte bezahlen Sie den Betrag direkt an den Absender, mit dem Einzahlungsschein im beigefügten Schreiben (QR-Code mit Ihrer Banking-App scannen). ZURIAUTO zieht ihn nicht ein.",
      "",
      "Sobald Sie bezahlt haben, bestätigen Sie es bitte hier mit einem Screenshot der Zahlung:",
      ctx.payUrl,
      ...(ctx.feeCents > 0
        ? [
            "",
            `Gemäss unseren AGB (Ziffer 4.2 und Gebührentabelle) verrechnen wir eine Bearbeitungsgebühr von ${chf(ctx.feeCents)}. Bitte bezahlen Sie diese per Karte oder TWINT mit dem Vermerk «Busse ${reference}»:`,
            `Karte: ${PAYMENT_URL}`,
            `TWINT: ${TWINT_URL}`,
          ]
        : []),
      "",
      "Eine unbezahlte Busse kommt als Mahnung mit weiteren Kosten zurück.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

export function fineReopenedMail(ctx: FineMailContext): { subject: string; text: string } {
  const day = formatFineMoment(ctx.violationAt, false);
  if (ctx.language === "en") {
    return {
      subject: `The fine for ${ctx.plate} of ${day} is still unpaid`,
      text: [
        `Hello ${ctx.firstName}`,
        "",
        `The issuer has sent a reminder for the fine of ${day} (${ctx.plate}): according to them, it has not been paid. The reminder is attached.`,
        "",
        "If you did pay, please send us the confirmation from your bank here — a screenshot is enough:",
        ctx.payUrl,
        "",
        "If not, please pay it now with the slip in the attached reminder.",
        "",
        "Kind regards",
        "ZURIAUTO",
      ].join("\n"),
    };
  }
  return {
    subject: `Die Busse für ${ctx.plate} vom ${day} ist noch offen`,
    text: [
      `Guten Tag ${ctx.firstName}`,
      "",
      `Der Absender hat uns für die Busse vom ${day} (${ctx.plate}) eine Mahnung geschickt: Die Zahlung ist dort nicht eingegangen. Die Mahnung liegt bei.`,
      "",
      "Falls Sie bezahlt haben, senden Sie uns bitte hier die Bestätigung Ihrer Bank — ein Screenshot genügt:",
      ctx.payUrl,
      "",
      "Falls nicht, bezahlen Sie die Busse bitte jetzt mit dem Einzahlungsschein der beigelegten Mahnung.",
      "",
      "Freundliche Grüsse",
      "ZURIAUTO",
    ].join("\n"),
  };
}

export function fineThanksMail(ctx: FineMailContext): { subject: string; text: string } {
  const day = formatFineMoment(ctx.violationAt, false);
  if (ctx.language === "en") {
    return {
      subject: `Payment confirmed: fine for ${ctx.plate} of ${day}`,
      text: [`Hello ${ctx.firstName}`, "", "Thank you — we have recorded your payment of the fine.", "", "Kind regards", "ZURIAUTO"].join("\n"),
    };
  }
  return {
    subject: `Zahlung bestätigt: Busse für ${ctx.plate} vom ${day}`,
    text: [`Guten Tag ${ctx.firstName}`, "", "Vielen Dank — wir haben Ihre Zahlung der Busse vermerkt.", "", "Freundliche Grüsse", "ZURIAUTO"].join("\n"),
  };
}

export type OfficeFineAlertKind = "reopened" | "closedReminder" | "mailFailed" | "proof" | "overdue";

export function officeFineAlertMail(ctx: {
  kind: OfficeFineAlertKind;
  plate: string;
  fineNumber: string | null;
  renterName: string | null;
  detail?: string;
  fineUrl: string;
}): { subject: string; text: string } {
  const headline = {
    reopened: "Mahnung für eine Busse, die als bezahlt galt",
    closedReminder: "Mahnung für eine abgeschlossene Busse",
    mailFailed: "Busse konnte dem Mieter nicht zugestellt werden",
    proof: "Zahlungsnachweis zu prüfen",
    overdue: "Busse überfällig, keine Zahlungsbestätigung",
  }[ctx.kind];
  return {
    subject: `${headline}: ${ctx.plate}`,
    text: [
      `${headline}.`,
      "",
      `Fahrzeug:  ${ctx.plate}`,
      ...(ctx.fineNumber ? [`Nummer:    ${ctx.fineNumber}`] : []),
      ...(ctx.renterName ? [`Mieter:    ${ctx.renterName}`] : []),
      ...(ctx.detail ? ["", ctx.detail] : []),
      "",
      ctx.fineUrl,
    ].join("\n"),
  };
}

export function officeFineDigestMail(
  items: { plate: string; reason: string; fineUrl: string }[],
  listUrl: string
): { subject: string; text: string } {
  return {
    subject: items.length === 1 ? "1 Busse zu prüfen" : `${items.length} Bussen zu prüfen`,
    text: [
      "Diese Bussen konnten nicht automatisch zugestellt werden:",
      "",
      ...items.map((item) => `- ${item.plate}: ${item.reason}\n  ${item.fineUrl}`),
      "",
      listUrl,
    ].join("\n"),
  };
}
