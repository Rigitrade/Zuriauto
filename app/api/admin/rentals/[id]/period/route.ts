import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import {
  mayEditPeriod,
  rentalPeriodSchema,
  zurichInstant,
} from "@/lib/admin/rentalPeriod";

/**
 * Corrects the dates on a rental reconstructed from paper.
 *
 * The thirteen pre-backend PDFs state no term — the build that produced them
 * had no such section — so the import wrote `endAt = startAt` rather than
 * guess, and nine cars appear in the fleet history as having gone out and come
 * back in the same instant. The office knows roughly when most of them came
 * back; until this route there was nowhere to put that.
 *
 * **Imported rentals only, and the check is the reason this route is narrow
 * rather than a general "edit a rental" endpoint.** A contract signed at the
 * desk prints its own start and agreed return. If the dashboard could move
 * those dates, the signed document would stop being the record and become one
 * of two records that might disagree — and the one on screen is the one people
 * believe. `mayEditPeriod` refuses any rental carrying a single contract
 * somebody actually signed, including an imported pickup that a real return
 * has since closed.
 *
 * Staff as well as owners. Writing down when a car came back is the ordinary
 * work of the desk, not a privileged act, and making it wait for an owner
 * would mean it never gets done.
 *
 * Every change writes a `RentalEvent`. These are dates on a rental whose
 * paperwork does not support them, so in a year the only answer to "where did
 * this come from" is the audit row: who typed it, when, and what it replaced.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = rentalPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const rental = await prisma.rental.findUnique({
    where: { id },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      contracts: { select: { createdBy: true } },
    },
  });

  if (!rental) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  if (!mayEditPeriod(rental.contracts)) {
    // 409 rather than 403: the caller is allowed to be here, this particular
    // rental is not the kind that can be edited. A 403 would send the office
    // looking for a permission that does not exist.
    return NextResponse.json({ code: "signed-period" }, { status: 409 });
  }

  // Non-null after the schema, which parses both with the same function.
  const startAt = zurichInstant(parsed.data.startAt) as Date;
  const endAt = zurichInstant(parsed.data.endAt) as Date;

  if (
    startAt.getTime() === rental.startAt.getTime() &&
    endAt.getTime() === rental.endAt.getTime()
  ) {
    // Nothing changed. Returning early keeps the audit log meaningful: a row
    // per correction, not a row per time somebody opened the form and saved it
    // unaltered.
    return NextResponse.json({ ok: true, changed: false });
  }

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { startAt, endAt } });
    await tx.rentalEvent.create({
      data: {
        rentalId: rental.id,
        type: "period.corrected",
        payload: {
          by: user.username,
          at: new Date().toISOString(),
          from: {
            startAt: rental.startAt.toISOString(),
            endAt: rental.endAt.toISOString(),
          },
          to: { startAt: startAt.toISOString(), endAt: endAt.toISOString() },
        },
      },
    });
  });

  return NextResponse.json({ ok: true, changed: true });
}
