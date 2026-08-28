import { NextResponse } from "next/server";
import { APPLY_KEY_HEADER, applyKeyValid } from "@/lib/applyKey";
import { prisma } from "@/lib/db";
import type { AssetKind } from "@/generated/prisma/client";
import { sendContractMails } from "@/lib/rental/mail";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { rateLimited } from "@/lib/rental/rateLimit";
import { readReuseToken } from "@/lib/rental/reuseToken";
import { contractMetaSchema } from "@/lib/rental/schema";
import { getAssetStore } from "@/lib/storage";

/**
 * Records a signed pickup contract and emails it.
 *
 * The write is the point. Assets go to object storage, then one transaction
 * commits the customer, rental, contract and asset rows, and only then is mail
 * sent — so a mail failure leaves a contract that exists and an email to
 * retry, rather than the Phase 1 failure mode where it existed nowhere.
 *
 * The endpoint is fenced with a shared secret, an origin check, a honeypot, a
 * size cap and a per-IP limiter backed by the database, which therefore
 * survives a cold start and is shared across instances.
 */

// SMTP needs a socket and Prisma needs Node APIs, so not the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/** Vercel rejects bodies past ~4.5 MB; refuse just under so the error is ours. */
const MAX_PDF_BYTES = 4.4 * 1024 * 1024;

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

export async function POST(request: Request) {
  // First, so an unauthorised request costs nothing to reject.
  if (!applyKeyValid(request.headers.get(APPLY_KEY_HEADER))) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }

  if (await rateLimited(prisma, clientIp(request), new Date(), { scope: "pickup" })) {
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

  // Verified before anything is uploaded, so a stale token costs nothing. The
  // schema has already refused a token without the attestation.
  let reuseFromContractId: string | undefined;
  if (meta.reuseToken) {
    const contractId = readReuseToken(meta.reuseToken);
    if (!contractId) {
      // Expired, forged, or signed with a since-rotated secret. The wizard
      // sends the operator back to capture fresh photographs rather than
      // guessing which of the three it was.
      return NextResponse.json({ code: "reuse-expired" }, { status: 400 });
    }
    reuseFromContractId = contractId;
  }

  // The images travel alongside the PDF so they can be stored under their own
  // keys. They are already inside the document, but a PDF is not a place to
  // look one up from — Phase 4's return wizard compares against these.
  const uploads: PickupUpload[] = [];
  for (const [field, value] of form.entries()) {
    if (!field.startsWith("asset:") || !(value instanceof File)) continue;
    uploads.push({
      kind: field.slice("asset:".length) as AssetKind,
      body: new Uint8Array(await value.arrayBuffer()),
      contentType: value.type || "application/octet-stream",
    });
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[rental-contract] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());

  let saved;
  try {
    saved = await persistPickup({
      organisationId: organisation.id,
      details: meta.details,
      vehicleSlug: meta.details.vehicleId,
      uploads,
      pdf: { body: pdfBytes },
      store: getAssetStore(),
      reuseFromContractId,
      identityCheckedAt: reuseFromContractId ? new Date() : undefined,
    });
  } catch (error) {
    console.error("[rental-contract] could not record the contract:", error);
    // The wizard falls back to the Phase 1 path on this code: download the PDF
    // and mail it by hand. Nothing is lost that the customer is not holding.
    return NextResponse.json({ code: "not-recorded" }, { status: 503 });
  }

  // Committed. From here, mail is best-effort.
  const outcome = await sendContractMails(
    { ...meta, contractNumber: saved.contractNumber },
    Buffer.from(pdfBytes)
  );

  await prisma.contract.update({
    where: { id: saved.contractId },
    data:
      outcome.delivered === "none"
        ? { mailError: outcome.error?.slice(0, 500) ?? "unknown" }
        : { mailSentAt: new Date(), mailError: outcome.error?.slice(0, 500) },
  });

  return NextResponse.json({
    delivered: outcome.delivered,
    contractNumber: saved.contractNumber,
  });
}
