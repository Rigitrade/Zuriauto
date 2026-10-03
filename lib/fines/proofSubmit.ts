/**
 * A renter telling us they paid, with a screenshot.
 *
 * A screenshot that shows the amount and names the fine marks it paid with
 * nobody involved, and the renter is thanked. One that does not is kept and
 * put in front of the office — and the link keeps working, so a clearer
 * screenshot can follow. See lib/fines/proof.ts for what "shows" means.
 */

import { extensionFor } from "@/lib/storage";
import { fineProofKey } from "./keys";
import { recordEvent } from "./events";
import { fineThanksMail } from "./mail";
import { alertOffice, sendFineOnce, type NotifyDeps } from "./notify";
import { verifyProofText, type ProofVerdict } from "./proof";
import { burnFineTokens, resolveFinePaymentToken } from "./token";
import { asRentalLanguage } from "@/lib/rental/labels";

export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

export type ProofResult =
  | { ok: true; verdict: ProofVerdict }
  | { ok: false; code: "link-unusable" };

export async function submitProof(
  deps: NotifyDeps,
  input: { token: string; bytes: Uint8Array; contentType: string; paidOn: string | null },
  readText: (bytes: Uint8Array, contentType: string) => Promise<string>
): Promise<ProofResult> {
  const { client, store, now } = deps;
  const resolved = await resolveFinePaymentToken(client, input.token, now);
  if (!resolved.ok) return { ok: false, code: "link-unusable" };

  const fine = await client.fine.findUniqueOrThrow({
    where: { id: resolved.fineId },
    include: {
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
      rental: { select: { contracts: { where: { kind: "PICKUP" }, select: { gtcLanguage: true }, take: 1 } } },
      documents: { select: { storageKey: true, uploadedAt: true } },
    },
  });

  const key = fineProofKey(fine.id, extensionFor(input.contentType));
  await store.put(key, input.bytes, input.contentType);

  let text = "";
  try {
    text = await readText(input.bytes, input.contentType);
  } catch (error) {
    console.error(`[fines] reading a proof for ${fine.id} failed:`, error);
  }
  const verdict = verifyProofText(text, fine);
  const paidOn = input.paidOn && /^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)
    ? new Date(`${input.paidOn}T00:00:00Z`)
    : null;

  const proof = await client.finePaymentProof.create({
    data: {
      fineId: fine.id,
      storageKey: key,
      contentType: input.contentType,
      bytes: input.bytes.byteLength,
      submittedAt: now,
      paidOn,
      ocrText: text.slice(0, 5000),
      verdict,
    },
  });

  if (verdict === "MATCH") {
    // Conditional: two screenshots verified at once mark it paid once.
    const moved = await client.fine.updateMany({
      where: { id: fine.id, status: { in: ["NOTIFIED", "PROOF_SUBMITTED"] } },
      data: { status: "PAID", paidVia: "PROOF_VERIFIED", paidAt: now, reviewReason: null },
    });
    if (moved.count > 0) {
      await burnFineTokens(client, fine.id, now);
      await recordEvent(client, fine.id, "proof.verified", { proofId: proof.id }, null, now);
      if (fine.customer && fine.car && fine.violationAt) {
        const customer = fine.customer;
        const car = fine.car;
        await sendFineOnce(
          deps,
          { fineId: fine.id, kind: "FINE_PAID", dedupeKey: "paid", to: customer.email },
          async () => ({
            to: customer.email,
            ...fineThanksMail({
              language: asRentalLanguage(fine.rental?.contracts[0]?.gtcLanguage),
              firstName: customer.firstName,
              plate: car.plate,
              carModel: car.model,
              violationAt: fine.violationAt!,
              timeKnown: fine.violationTimeKnown,
              location: fine.location,
              offence: { de: fine.offenceTextDe ?? "", en: fine.offenceTextEn ?? "" },
              amountCents: fine.amountCents ?? 0,
              dueDate: fine.dueDate,
              issuerName: fine.issuerName,
              fineNumber: fine.fineNumber,
              feeCents: 0,
              payUrl: "",
              reminder: false,
            }),
          })
        );
      }
    }
    return { ok: true, verdict };
  }

  await client.fine.updateMany({
    where: { id: fine.id, status: "NOTIFIED" },
    data: { status: "PROOF_SUBMITTED" },
  });
  await recordEvent(client, fine.id, "proof.submitted", { proofId: proof.id, verdict }, null, now);
  await alertOffice(
    deps,
    fine,
    "proof",
    verdict === "UNREADABLE"
      ? "Der Screenshot war nicht lesbar."
      : "Betrag oder Referenz waren auf dem Screenshot nicht zu finden.",
    proof.id
  );
  return { ok: true, verdict };
}
