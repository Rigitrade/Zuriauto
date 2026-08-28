import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { buildCustomerEmail } from "@/lib/rental/customerEmail";
import { labelsFor } from "@/lib/rental/labels";
import {
  persistReturn,
  type PersistReturnResult,
  type ReturnUpload,
} from "@/lib/rental/persistReturn";
import {
  returnDetailsSchema,
  returnMetaSchema,
} from "@/lib/rental/returnSchema";
import { getAssetStore } from "@/lib/storage";

/**
 * Records a vehicle return and emails the signed report.
 *
 * A sibling of `app/api/rental-contract/route.ts`, and public where that one is
 * fenced: the renter fills this in, so there is no credential to demand. It
 * keeps the size cap, the origin check, the honeypot and the per-IP limiter.
 * The limiter state is deliberately this route's own — sharing a budget with
 * the pickup route would let a burst of one starve the other.
 *
 * From Phase 4 it also writes. The recording is **best effort by design**: a
 * return that cannot be matched to a rental, or that arrives while the database
 * is unavailable, is still emailed exactly as it was in Phase 1. The signed
 * document reaching the office is the thing that must not be lost; the row is
 * an improvement on it, not a precondition for it.
 *
 * See docs/superpowers/specs/2026-08-28-return-persistence-design.md.
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

/**
 * Writes the return, or explains in one line why it could not be written.
 *
 * Never throws. Every branch that returns null has already been decided as
 * "email it anyway" — see decision 3 in the design spec — so a caller that had
 * to handle an exception here would only be re-deciding it.
 */
async function recordReturn(
  form: FormData,
  meta: { returnNumber: string; vehicleId: string },
  pdfBytes: Uint8Array
): Promise<PersistReturnResult | null> {
  const raw = form.get("details");
  if (typeof raw !== "string") return null;

  const parsed = returnDetailsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    // The browser validated these before building the PDF, so a failure here
    // is either a crafted request or a rule that reads the clock — `paidOn`
    // and `dueDate` compare against today, and a submission at midnight can
    // land on the far side of it. Neither is a reason to lose the document.
    console.warn(
      "[rental-return] details did not validate server-side:",
      parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
    );
    return null;
  }

  const uploads: ReturnUpload[] = [];
  for (const [field, value] of form.entries()) {
    if (field !== "asset:SIGNATURE" || !(value instanceof File)) continue;
    uploads.push({
      kind: "SIGNATURE",
      body: new Uint8Array(await value.arrayBuffer()),
      contentType: value.type || "image/png",
    });
  }

  try {
    const organisation = await prisma.organisation.findFirst({
      select: { id: true },
    });
    if (!organisation) {
      console.error("[rental-return] no organisation row — run pnpm db:seed");
      return null;
    }

    return await persistReturn({
      organisationId: organisation.id,
      details: parsed.data,
      vehicleSlug: meta.vehicleId,
      returnNumber: meta.returnNumber,
      uploads,
      pdf: { body: pdfBytes },
      store: getAssetStore(),
    });
  } catch (error) {
    console.error("[rental-return] could not record the return:", error);
    return null;
  }
}

/**
 * Records whether the report actually left, on the row it belongs to.
 *
 * The office copy is the one that matters, so that is what this reflects — a
 * customer copy that fails is reported to the browser and does not make the
 * return's own record say the mail never went.
 */
async function stampMail(
  recorded: PersistReturnResult | null,
  error: unknown
): Promise<void> {
  if (!recorded?.recorded) return;
  try {
    await prisma.contract.update({
      where: { id: recorded.contractId },
      data: error
        ? { mailError: String(error).slice(0, 500) }
        : { mailSentAt: new Date() },
    });
  } catch (updateError) {
    // The return is recorded and the mail has been dealt with; failing to note
    // which is not worth turning into a 500 for the renter.
    console.error("[rental-return] could not stamp the mail outcome:", updateError);
  }
}

/** The lines that tell the office what, if anything, they still have to do. */
function officeNotes(recorded: PersistReturnResult | null): string[] {
  if (recorded === null) {
    return [
      "NOT RECORDED — this return was emailed but not written to the database.",
      "Close the rental by hand in /admin.",
    ];
  }

  if (!recorded.recorded) {
    return recorded.reason === "already-returned"
      ? ["NOT RECORDED — a return is already on file for this rental."]
      : [
          "NOT RECORDED — no open rental was found for this car.",
          "It may predate the database, or have been closed already.",
        ];
  }

  const notes = ["RECORDED — confirm it in /admin to free the car."];
  if (recorded.distanceKm !== null) {
    notes.push(`Distance driven: ${recorded.distanceKm} km.`);
  }
  if (recorded.mileageBelowPickup) {
    notes.push(
      "CHECK: the reading is BELOW the pickup mileage, so one of the two is a typo."
    );
  }
  if (!recorded.emailMatchesCustomer) {
    notes.push(
      "CHECK: the submitted email does not match the customer on file."
    );
  }
  return notes;
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
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const attachment = {
    filename: `${meta.returnNumber}.pdf`,
    content: Buffer.from(pdfBytes),
    contentType: "application/pdf",
  };

  // --- Record, before the mail goes ------------------------------------
  // Ahead of the send so a mail failure leaves the return standing, inverting
  // the Phase 1 failure mode where a failed send meant it existed nowhere.
  // Every failure below is swallowed on purpose: none of them is a reason to
  // withhold the document from the office.
  const recorded = await recordReturn(form, meta, pdfBytes);

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
    "",
    // Written in English regardless of the renter's language: this half of the
    // mail is for the office, and it is the half that says what to do next.
    ...officeNotes(recorded),
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
    await stampMail(recorded, error);
    return NextResponse.json({ code: "send-failed" }, { status: 502 });
  }
  await stampMail(recorded, null);

  try {
    // Payment links stay in the return confirmation too: an open balance
    // noted on the report can be settled straight from this email.
    const customerEmail = buildCustomerEmail({
      language: meta.language,
      customerName: meta.customerName,
      referenceLabel: L.ret.pdf.returnNumber,
      referenceNumber: meta.returnNumber,
      hello: L.ret.email.customerHello,
      body: L.ret.email.customerBody,
    });

    await transport.sendMail({
      from: config.from,
      to: meta.customerEmail,
      subject: `${L.ret.email.customerSubject} – ${meta.returnNumber}`,
      text: customerEmail.text,
      html: customerEmail.html,
      attachments: [attachment],
    });
  } catch (error) {
    console.error("[rental-return] customer copy failed:", error);
    return NextResponse.json({ delivered: "office" });
  }

  return NextResponse.json({ delivered: "both" });
}
