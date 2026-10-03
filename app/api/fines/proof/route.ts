import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readProofText } from "@/lib/fines/proofOcr";
import { MAX_PROOF_BYTES, PROOF_TYPES, submitProof } from "@/lib/fines/proofSubmit";
import { notifyDeps } from "@/lib/fines/run";
import { rateLimited } from "@/lib/rental/rateLimit";

/**
 * A renter's payment screenshot, from the link in their fine email.
 *
 * Public, like every renter page: the token is the credential. It keeps the
 * public-upload fence the contract form has — origin check, honeypot, the
 * database rate limiter in its own scope, size and type checks — because a
 * file upload on an open URL is the shape every abuse takes.
 *
 * Every way a link can be dead answers the same 410, so the endpoint cannot
 * be used to learn which tokens exist.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The screenshot is read with OCR before answering.
export const maxDuration = 60;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host") ||
      new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "bad-origin" }, { status: 403 });
  }
  if (await rateLimited(prisma, clientIp(request), new Date(), { scope: "fine-proof", max: 10 })) {
    return NextResponse.json({ code: "rate-limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  // Honeypot: invisible to people, so anything in it is a bot. A 200 tells
  // the bot nothing.
  if (String(form.get("company") ?? "").trim() !== "") {
    return NextResponse.json({ verdict: "MISMATCH" });
  }

  const token = String(form.get("token") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  if (!PROOF_TYPES.includes(file.type)) {
    return NextResponse.json({ code: "unsupported-type" }, { status: 415 });
  }
  if (file.size > MAX_PROOF_BYTES) {
    return NextResponse.json({ code: "too-large", maxBytes: MAX_PROOF_BYTES }, { status: 413 });
  }

  const paidOn = String(form.get("paidOn") ?? "") || null;
  const result = await submitProof(
    notifyDeps(new Date()),
    { token, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type, paidOn },
    readProofText
  );
  if (!result.ok) {
    return NextResponse.json({ code: result.code }, { status: 410 });
  }
  return NextResponse.json({ verdict: result.verdict });
}
