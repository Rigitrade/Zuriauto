import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestIsAdmin } from "@/lib/admin/session";

/**
 * Everything the fleet page shows, in one call.
 *
 * One endpoint rather than four because the page is small and always wants all
 * of it: three round trips to paint one screen is latency the office feels on a
 * phone at the desk.
 *
 * Unlike `/api/fleet/`, this returns cars in *every* status — managing the ones
 * that are off the road is the point of the page.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminOverview {
  cars: {
    id: string;
    slug: string;
    model: string;
    plate: string;
    vin: string | null;
    status: string;
    /** Set when the car is out, so the row can link to the rental. */
    activeRentalId: string | null;
  }[];
  rentals: {
    id: string;
    carPlate: string;
    carModel: string;
    customerName: string;
    startAt: string;
    endAt: string;
    contractNumber: string | null;
  }[];
  counts: {
    available: number;
    retired: number;
    rented: number;
    activeRentals: number;
    contracts: number;
    mailFailed: number;
  };
  latestContractAt: string | null;
}

export async function GET(request: Request) {
  if (!requestIsAdmin(request)) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const organisation = await prisma.organisation.findFirst({
    select: { id: true },
  });
  if (!organisation) {
    console.error("[admin] no organisation row — run pnpm db:seed");
    return NextResponse.json({ code: "not-configured" }, { status: 503 });
  }

  const cars = await prisma.car.findMany({
    where: { organisationId: organisation.id },
    orderBy: [{ status: "asc" }, { plate: "asc" }],
    select: {
      id: true,
      slug: true,
      model: true,
      plate: true,
      vin: true,
      status: true,
      rentals: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const rentals = await prisma.rental.findMany({
    where: {
      organisationId: organisation.id,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    orderBy: { endAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
      contracts: {
        where: { kind: "PICKUP" },
        orderBy: { signedAt: "desc" },
        take: 1,
        select: { contractNumber: true },
      },
    },
  });

  const [contracts, mailFailed, latest] = await Promise.all([
    prisma.contract.count({ where: { organisationId: organisation.id } }),
    // A contract that exists but whose email never left. Worth surfacing:
    // until now the only way to notice was reading the column by hand.
    prisma.contract.count({
      where: { organisationId: organisation.id, mailSentAt: null },
    }),
    prisma.contract.findFirst({
      where: { organisationId: organisation.id },
      orderBy: { signedAt: "desc" },
      select: { signedAt: true },
    }),
  ]);

  const payload: AdminOverview = {
    cars: cars.map((car) => ({
      id: car.id,
      slug: car.slug,
      model: car.model,
      plate: car.plate,
      vin: car.vin,
      status: car.status,
      activeRentalId: car.rentals[0]?.id ?? null,
    })),
    rentals: rentals.map((rental) => ({
      id: rental.id,
      carPlate: rental.car.plate,
      carModel: rental.car.model,
      customerName: `${rental.customer.firstName} ${rental.customer.lastName}`,
      startAt: rental.startAt.toISOString(),
      endAt: rental.endAt.toISOString(),
      contractNumber: rental.contracts[0]?.contractNumber ?? null,
    })),
    counts: {
      available: cars.filter((car) => car.status === "available").length,
      retired: cars.filter((car) => car.status === "retired").length,
      rented: cars.filter((car) => car.status === "rented").length,
      activeRentals: rentals.length,
      contracts,
      mailFailed,
    },
    latestContractAt: latest?.signedAt.toISOString() ?? null,
  };

  return NextResponse.json(payload);
}
