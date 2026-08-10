import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { labelsFor } from "@/lib/rental/labels";
import { contractMetaSchema } from "@/lib/rental/schema";

/**
 * Emails a signed pickup contract to the office and to the customer.
 *
 * Stateless by design: nothing is written down in Phase 1. The endpoint is
 * public and unauthenticated, which makes it a spam-relay target, so it is
 * fenced with a size cap, an origin check, a honeypot and a per-IP limiter.
 * Those are mitigations rather than a solution — real rate limiting arrives
 * with the Phase 2 datastore.
 */

// SMTP needs a socket, so this cannot run on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/** Vercel rejects bodies past ~4.5 MB; refuse just under so the error is ours. */
const MAX_PDF_BYTES = 4.4 * 1024 * 1024;

const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/**
 * Held in module scope, so it resets on every cold start and is not shared
 * between concurrent instances. Good enough to blunt a naive script; it is
 * explicitly not a real rate limiter.
 */
const recentByIp = new Map<string, number[]>();

/** Keeps the no-archive warning to once per cold start rather than per send. */
let warnedAboutArchive = false;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recentByIp.get(ip) ?? []).filter(
    (at) => now - at < RATE_LIMIT.windowMs
  );
  hits.push(now);
  recentByIp.set(ip, hits);

  // Keep the map from growing without bound across a warm instance's life.
  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (times.every((at) => now - at >= RATE_LIMIT.windowMs)) {
        recentByIp.delete(key);
      }
    }
  }

  return hits.length > RATE_LIMIT.max;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Rejects cross-site posts. Absent Origin (some native clients) is allowed. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** Comma-separated list is allowed, so several people can be notified. */
  office: string;
  /**
   * Blind copy kept as the archive. Phase 1 writes nothing to disk, so this
   * mailbox is the only durable record of a signed contract — if it is unset,
   * a deleted office mail is gone for good.
   */
  archive?: string;
}

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
      "[rental-contract] MAIL_ARCHIVE is not set. Nothing is stored server-side " +
        "in Phase 1, so a contract deleted from the office mailbox is unrecoverable."
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }

  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  // Honeypot: the field is invisible, so anything in it is a bot. Answer 200
  // so the sender learns nothing from the response.
  if (String(form.get("company") ?? "").trim() !== "") {
    return NextResponse.json({ delivered: "both" });
  }

  const file = form.get("pdf");
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ code: "too-large" }, { status: 413 });
  }

  let meta;
  try {
    meta = contractMetaSchema.parse(JSON.parse(String(form.get("meta") ?? "")));
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const config = readMailConfig();
  if (!config) {
    // The browser falls back to download and share on this code.
    return NextResponse.json({ code: "mail-not-configured" }, { status: 503 });
  }

  const L = labelsFor(meta.language);
  const attachment = {
    filename: `${meta.contractNumber}.pdf`,
    content: Buffer.from(await file.arrayBuffer()),
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

  // The office copy is the one that matters: if it fails, the request failed.
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
    return NextResponse.json({ code: "send-failed" }, { status: 502 });
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: meta.customerEmail,
      subject: `${L.email.customerSubject} – ${meta.contractNumber}`,
      text: L.email.customerBody,
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-contract] customer copy failed:", error);
    return NextResponse.json({ delivered: "office" });
  }

  return NextResponse.json({ delivered: "both" });
}
