import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { parseWindow } from "@/lib/admin/carHistory";

/**
 * Who had this car, and when.
 *
 * The endpoint behind the Vehicle history screen, and the answer to the one
 * question a traffic fine ever asks. `/api/admin/cars/[id]/route.ts` already
 * refuses to delete a car with rentals for exactly this reason — "who was
 * driving ZH 589 864 on the 12th" — and until now nothing could actually ask
 * it.
 *
 * Deliberately unlike `/api/admin/overview/`, which returns only rentals that
 * are neither COMPLETED nor CANCELLED. A fine arrives weeks after the car came
 * back, so every period this endpoint is asked about is one the overview hides
 * by design. Here they are all reported, each carrying its status, and the
 * screen labels it — a CANCELLED rental means the car never left the yard, and
 * an unlabelled row would hand somebody a fine for a car they never collected.
 *
 * Audited into CarHistoryLookup on the same reasoning as CustomerLookup: the
 * response carries a past renter's mobile and email, and a tool that can
 * produce that should be able to say who asked.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CarHistoryPeriod {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  customerName: string;
  /** As the renter gave it, not the E.164 key — this is a number to dial. */
  customerPhone: string;
  customerEmail: string;
  /** The pickup contract: the proof that this person signed for this car on
   *  this date. Null on a rental recorded without one. */
  contractNumber: string | null;
}

export interface CarHistory {
  car: { id: string; slug: string; model: string; plate: string; status: string };
  /** Echoed back so the screen can say which window it is reporting rather
   *  than leaving an empty result ambiguous. */
  window: { from: string; to: string } | null;
  periods: CarHistoryPeriod[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const parsed = parseWindow(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { code: parsed.reason === "reversed" ? "window-reversed" : "invalid" },
      { status: 400 }
    );
  }
  const window = parsed.window;

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, slug: true, model: true, plate: true, status: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const rentals = await prisma.rental.findMany({
    where: {
      carId: car.id,
      // Overlap, not containment. A rental running from June to August covers
      // a fortnight in July even though neither of its ends falls inside it,
      // and containment would report the car as having been with nobody.
      ...(window
        ? { startAt: { lte: window.to }, endAt: { gte: window.from } }
        : {}),
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      customer: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
      contracts: {
        where: { kind: "PICKUP" },
        orderBy: { signedAt: "asc" },
        take: 1,
        select: { contractNumber: true },
      },
    },
  });

  // Written before the response, and whether or not anything matched: a run of
  // searches that find nobody is exactly the shape of somebody trawling the
  // fleet, and only recording the hits would leave that invisible.
  await prisma.carHistoryLookup.create({
    data: {
      carId: car.id,
      userId: user.id,
      username: user.username,
      windowFrom: window?.from ?? null,
      windowTo: window?.to ?? null,
      matches: rentals.length,
    },
  });

  const payload: CarHistory = {
    car,
    window: window
      ? { from: window.from.toISOString(), to: window.to.toISOString() }
      : null,
    periods: rentals.map((rental) => ({
      id: rental.id,
      status: rental.status,
      startAt: rental.startAt.toISOString(),
      endAt: rental.endAt.toISOString(),
      customerName: `${rental.customer.firstName} ${rental.customer.lastName}`,
      customerPhone: rental.customer.phone,
      customerEmail: rental.customer.email,
      contractNumber: rental.contracts[0]?.contractNumber ?? null,
    })),
  };

  return NextResponse.json(payload);
}
