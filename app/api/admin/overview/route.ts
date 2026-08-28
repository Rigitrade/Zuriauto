import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";

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
  /** The same shape the sign-in response carries, so a reload can repaint the
   *  header without a second endpoint: the office already fetches this once
   *  on every load. */
  me: {
    id: string;
    username: string;
    displayName: string;
    role: "owner" | "staff";
  };
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
    /** Set once the renter has submitted a return the office has not confirmed. */
    returnSubmittedAt: string | null;
    returnContractNumber: string | null;
  }[];
  counts: {
    available: number;
    retired: number;
    rented: number;
    activeRentals: number;
    /** Returns recorded by the renter and not yet confirmed by the office. */
    returnsAwaiting: number;
    contracts: number;
    mailFailed: number;
  };
  /**
   * The contracts behind `counts.mailFailed`, so the Overview band can render
   * a row somebody can act on rather than a number they have to go looking
   * for. Capped — see UNSENT_LIMIT — because this is a prompt, not a report.
   *
   * Deliberately narrow: a number, a name and a date. No PDF key, no asset
   * ids, nothing that would make this payload worth intercepting.
   */
  unsentContracts: {
    id: string;
    contractNumber: string;
    customerName: string;
    signedAt: string;
  }[];
  latestContractAt: string | null;
}

/** Enough to act on this morning. The count beside it reports the true total,
 *  so a backlog of forty is still honest on screen. */
const UNSENT_LIMIT = 20;

export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
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
    // Returns awaiting confirmation first: "what came back that I have not
    // dealt with" is the question the office opens this page to answer.
    // RentalStatus is declared ACTIVE, EXTENSION_REQUESTED, RETURN_SUBMITTED,
    // so descending puts a submitted return at the top.
    orderBy: [{ status: "desc" }, { endAt: "asc" }],
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
      // Both kinds, so the return addendum can be reported beside the pickup
      // number rather than in a second query per row.
      contracts: {
        orderBy: { signedAt: "desc" },
        select: { kind: true, contractNumber: true, signedAt: true },
      },
    },
  });

  const [contracts, mailFailed, unsent, latest] = await Promise.all([
    prisma.contract.count({ where: { organisationId: organisation.id } }),
    // A contract that exists but whose email never left. Worth surfacing:
    // until now the only way to notice was reading the column by hand.
    prisma.contract.count({
      where: { organisationId: organisation.id, mailSentAt: null },
    }),
    // The same rows, newest first, for the Overview band.
    prisma.contract.findMany({
      where: { organisationId: organisation.id, mailSentAt: null },
      orderBy: { signedAt: "desc" },
      take: UNSENT_LIMIT,
      select: {
        id: true,
        contractNumber: true,
        signedAt: true,
        rental: {
          select: { customer: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.contract.findFirst({
      where: { organisationId: organisation.id },
      orderBy: { signedAt: "desc" },
      select: { signedAt: true },
    }),
  ]);

  const payload: AdminOverview = {
    me: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
    cars: cars.map((car) => ({
      id: car.id,
      slug: car.slug,
      model: car.model,
      plate: car.plate,
      vin: car.vin,
      status: car.status,
      activeRentalId: car.rentals[0]?.id ?? null,
    })),
    rentals: rentals.map((rental) => {
      const pickup = rental.contracts.find((c) => c.kind === "PICKUP");
      const addendum = rental.contracts.find(
        (c) => c.kind === "RETURN_ADDENDUM"
      );
      return {
        id: rental.id,
        carPlate: rental.car.plate,
        carModel: rental.car.model,
        customerName: `${rental.customer.firstName} ${rental.customer.lastName}`,
        startAt: rental.startAt.toISOString(),
        endAt: rental.endAt.toISOString(),
        contractNumber: pickup?.contractNumber ?? null,
        returnSubmittedAt: addendum?.signedAt.toISOString() ?? null,
        returnContractNumber: addendum?.contractNumber ?? null,
      };
    }),
    counts: {
      available: cars.filter((car) => car.status === "available").length,
      retired: cars.filter((car) => car.status === "retired").length,
      rented: cars.filter((car) => car.status === "rented").length,
      activeRentals: rentals.length,
      returnsAwaiting: rentals.filter(
        (rental) => rental.status === "RETURN_SUBMITTED"
      ).length,
      contracts,
      mailFailed,
    },
    unsentContracts: unsent.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      // Assembled here rather than sent as two fields: every consumer wants
      // the whole name, and the parts have no separate use on this screen.
      customerName: [
        contract.rental?.customer?.firstName,
        contract.rental?.customer?.lastName,
      ]
        .filter(Boolean)
        .join(" "),
      signedAt: contract.signedAt.toISOString(),
    })),
    latestContractAt: latest?.signedAt.toISOString() ?? null,
  };

  return NextResponse.json(payload);
}
