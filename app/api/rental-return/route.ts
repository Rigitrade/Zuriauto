import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";
import { labelsFor } from "@/lib/rental/labels";
import { returnMetaSchema } from "@/lib/rental/returnSchema";

/**
 * Emails a signed vehicle return report to the office and to the customer.
 *
 * A sibling of `app/api/rental-contract/route.ts` with the same posture:
 * stateless, public, and fenced with a size cap, an origin check, a honeypot
 * and a per-IP limiter. The limiter state is deliberately this route's own —
 * sharing a budget with the pickup route would let a burst of one starve the
 * other.
 */

// SMTP needs a socket, so this cannot run on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/** Vercel rejects bodies past ~4.5 MB; refuse just under so the error is ours. */
const MAX_PDF_BYTES = 4.4 * 1024 * 1024;

const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/** Module scope: resets on cold start, unshared across instances. See the
 * pickup route for why that is accepted in Phase 1. */
const recentByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recentByIp.get(ip) ?? []).filter(
    (at) => now - at < RATE_LIMIT.windowMs
  );
  hits.push(now);
  recentByIp.set(ip, hits);

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
  office: string;
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
    console.error(
      "[rental-return] SMTP is not configured. Missing:",
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
    meta = returnMetaSchema.parse(JSON.parse(String(form.get("meta") ?? "")));
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
    filename: `${meta.returnNumber}.pdf`,
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
    `${L.ret.pdf.returnNumber}: ${meta.returnNumber}`,
    `${L.pdf.customerSection}: ${meta.customerName}`,
    `${L.pdf.email}: ${meta.customerEmail}`,
    `${L.pdf.model}: ${meta.vehicleLabel}`,
    `${L.pdf.plate}: ${meta.plate}`,
    `${L.ret.pdf.mileage}: ${meta.mileageKm} ${L.pdf.km}`,
  ].join("\n");

  // The office copy is the one that matters: if it fails, the request failed.
  try {
    await transport.sendMail({
      from: config.from,
      to: config.office,
      bcc: config.archive,
      replyTo: meta.customerEmail,
      subject: `${L.ret.email.officeSubject} – ${meta.plate} – ${meta.customerName}`,
      text: officeSummary,
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-return] office mail failed:", error);
    return NextResponse.json({ code: "send-failed" }, { status: 502 });
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: meta.customerEmail,
      subject: `${L.ret.email.customerSubject} – ${meta.returnNumber}`,
      // Payment links stay in the return confirmation too: an open balance
      // noted on the report can be settled straight from this email.
      text: [
        `${L.ret.email.customerHello} ${meta.customerName}`,
        "",
        L.ret.email.customerBody,
        "",
        `${L.email.customerPayment}`,
        PAYMENT_URL,
        "",
        `${L.email.customerPaymentTwint}`,
        TWINT_URL,
        "",
        L.email.customerSignature,
      ].join("\n"),
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-return] customer copy failed:", error);
    return NextResponse.json({ delivered: "office" });
  }

  return NextResponse.json({ delivered: "both" });
}
