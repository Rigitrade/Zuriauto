/**
 * Sending the signed contract.
 *
 * Extracted from the route handler in Phase 2, when the order of operations
 * changed: records commit first, mail goes out afterwards. That makes a send
 * failure a fact to record rather than an error that unwinds a handover, so
 * nothing in here throws.
 */

import nodemailer from "nodemailer";
import { PAYMENT_URL } from "@/lib/payment";
import { labelsFor } from "./labels";
import type { ContractMeta } from "./schema";

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** Comma-separated list is allowed, so several people can be notified. */
  office: string;
  /**
   * Blind copy kept as the archive. It runs in parallel with the database
   * through Phase 2 and should not be switched off until the database has
   * demonstrably replaced it.
   */
  archive?: string;
}

/** Keeps the no-archive warning to once per cold start rather than per send. */
let warnedAboutArchive = false;

function readMailConfig(): MailConfig | null {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_OFFICE,
    MAIL_ARCHIVE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_OFFICE) {
    // Named in the server log, never in the response: telling a public
    // endpoint's caller which secret is missing is its own mistake.
    console.error(
      "[rental-contract] SMTP is not configured. Missing:",
      [
        !SMTP_HOST && "SMTP_HOST",
        !SMTP_USER && "SMTP_USER",
        !SMTP_PASS && "SMTP_PASS",
        !MAIL_OFFICE && "MAIL_OFFICE",
      ]
        .filter(Boolean)
        .join(", ")
    );
    return null;
  }

  if (!MAIL_ARCHIVE && !warnedAboutArchive) {
    warnedAboutArchive = true;
    console.warn(
      "[rental-contract] MAIL_ARCHIVE is not set. It runs alongside the " +
        "database through Phase 2 as the proven durable record."
    );
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: MAIL_FROM || SMTP_USER,
    office: MAIL_OFFICE,
    archive: MAIL_ARCHIVE || undefined,
  };
}

export interface MailOutcome {
  delivered: "both" | "office" | "none";
  error?: string;
}

/**
 * Sends the office copy and the customer copy.
 *
 * Never throws. The records are already committed when this runs, so the
 * caller's job is to write the outcome onto the contract, not to undo
 * anything.
 */
export async function sendContractMails(
  meta: ContractMeta,
  pdf: Buffer
): Promise<MailOutcome> {
  const config = readMailConfig();
  if (!config) return { delivered: "none", error: "mail-not-configured" };

  const L = labelsFor(meta.language);
  const attachment = {
    filename: `${meta.contractNumber}.pdf`,
    content: pdf,
    contentType: "application/pdf",
  };

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const officeSummary = [
    `${L.pdf.contractNumber}: ${meta.contractNumber}`,
    `${L.pdf.customerSection}: ${meta.customerName}`,
    `${L.pdf.email}: ${meta.customerEmail}`,
    `${L.pdf.model}: ${meta.vehicleLabel}`,
    `${L.pdf.plate}: ${meta.plate}`,
    `${L.pdf.mileage}: ${meta.mileageKm} ${L.pdf.km}`,
  ].join("\n");

  try {
    await transport.sendMail({
      from: config.from,
      to: config.office,
      // Blind, so the customer's copy never exposes the archive address.
      bcc: config.archive,
      replyTo: meta.customerEmail,
      subject: `${L.email.officeSubject} – ${meta.plate} – ${meta.customerName}`,
      text: officeSummary,
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-contract] office mail failed:", error);
    return { delivered: "none", error: String(error) };
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: meta.customerEmail,
      subject: `${L.email.customerSubject} – ${meta.contractNumber}`,
      // Plain text with a bare URL: mail clients linkify it, and a text part
      // reaches every client without an HTML fallback to maintain.
      text: [
        L.email.customerGreeting,
        "",
        `${L.email.customerPayment}`,
        PAYMENT_URL,
        "",
        L.email.customerSignature,
      ].join("\n"),
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-contract] customer copy failed:", error);
    return { delivered: "office", error: String(error) };
  }

  return { delivered: "both" };
}
