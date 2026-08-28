import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { sendContractMails } from "@/lib/rental/mail";
import { getAssetStore } from "@/lib/storage";
import { asRentalLanguage } from "@/lib/rental/labels";

/**
 * Sends a contract whose email never left.
 *
 * The Overview band surfaces these; this is the button on the row. Until it
 * existed, a contract with `mailSentAt: null` was a number on a dashboard and
 * a job somebody had to do by hand outside the system.
 *
 * Available to staff as well as owners. Re-sending a document the customer
 * already agreed to is not a privileged act — it is the same send the pickup
 * flow already attempted on their behalf, and making the office fetch an owner
 * for it would mean the failed mail simply waits longer.
 *
 * The rule this handler exists to keep: **`mailSentAt` is stamped only after a
 * send that actually happened.** Stamping optimistically would remove the
 * contract from the office's list of things to chase while the customer still
 * has nothing — which is a worse state than the one being fixed, because
 * nothing surfaces it a second time.
 */

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      contractNumber: true,
      mileageKm: true,
      gtcLanguage: true,
      mailSentAt: true,
      pdfKey: true,
      rental: {
        select: {
          car: { select: { model: true, plate: true } },
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // Not an error the office caused, and not silent either: without this, a
  // double click mails the customer their contract twice.
  if (contract.mailSentAt) {
    return NextResponse.json({ code: "already-sent" }, { status: 409 });
  }

  const customer = contract.rental?.customer;
  const car = contract.rental?.car;
  if (!customer?.email || !car) {
    // A contract whose rental, customer or car has gone is not something a
    // retry can fix, and it is worth distinguishing from "not found".
    return NextResponse.json({ code: "incomplete" }, { status: 409 });
  }

  if (!contract.pdfKey) {
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  const stored = await getAssetStore().get(contract.pdfKey);
  if (!stored) {
    // The row outlived its object. Reported rather than thrown: there is
    // nothing the office can do about it here, but they should see which
    // contract it was.
    console.error(
      `[admin] contract ${contract.contractNumber} has no object at ${contract.pdfKey}`
    );
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  const outcome = await sendContractMails(
    {
      contractNumber: contract.contractNumber,
      customerName: [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" "),
      customerEmail: customer.email,
      vehicleLabel: car.model,
      plate: car.plate,
      mileageKm: contract.mileageKm,
      language: asRentalLanguage(contract.gtcLanguage),
    },
    Buffer.from(stored.body)
  );

  if (outcome.delivered === "none") {
    // Includes the unconfigured case, which is a 503 rather than a 500: the
    // request was fine and will work once somebody sets SMTP.
    const misconfigured = outcome.error === "mail-not-configured";
    return NextResponse.json(
      { code: misconfigured ? "mail-not-configured" : "mail-failed" },
      { status: misconfigured ? 503 : 502 }
    );
  }

  // Only now. `delivered: "office"` counts: the office copy is the one that
  // matters for the record, and the row should stop being chased once it
  // exists somewhere. `mailError` keeps the customer-copy failure visible.
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      mailSentAt: new Date(),
      mailError: outcome.delivered === "office" ? (outcome.error ?? null) : null,
    },
  });

  return NextResponse.json({ ok: true, delivered: outcome.delivered });
}
