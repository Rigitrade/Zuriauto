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
    /** The annual technical inspection, `YYYY-MM-DD`, or null when none is
     *  recorded. A date string rather than an instant: it is a calendar day,
     *  and sending it as an ISO timestamp invites a timezone shift on a value
     *  that decides when a car comes off the road. */
    mfkDate: string | null;

    /**
     * The service book. Every figure nullable, because the office learns them
     * one at a time and a car nobody has recorded must read as blank rather
     * than as zero — a zero would be a reading, and the service warning would
     * act on it.
     */
    currentMileageKm: number | null;
    /** When the odometer was read, as an instant. Unlike the dates above this
     *  genuinely is one: it is a moment somebody looked, not a calendar day. */
    mileageReadAt: string | null;
    serviceDoneKm: number | null;
    serviceDoneOn: string | null;
    serviceDueKm: number | null;

    /** Where the car's photograph is, when it has one. Carries a version
     *  query, so it can be cached hard and still change on replacement. */
    photoUrl: string | null;

    /**
     * Every repair recorded against this car, newest first.
     *
     * Carried with the car rather than fetched per row: the fleet screen shows
     * ten cars, and ten extra requests to fill in two lines each is latency
     * the office feels on a phone at the desk.
     */
    repairs: {
      id: string;
      status: string;
      details: string;
      plannedFor: string | null;
      doneOn: string | null;
      mileageKm: number | null;
      costCents: number | null;
      createdBy: string;
      createdAt: string;
    }[];

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
    /**
     * Everything the renter wrote on the return protocol, so the office can
     * read it before pressing the button that frees the car.
     *
     * Null until a return is submitted. Every field inside is nullable in
     * turn: an older addendum, written before these columns existed, has a
     * signature and a mileage and nothing else, and must render as gaps
     * rather than as confident falsehoods.
     */
    returnReport: {
      mileageKm: number;
      distanceKm: number | null;
      fuelLevel: string;
      damageNotes: string;
      cleanliness: string | null;
      papersInside: boolean | null;
      keyReturned: boolean | null;
      tickets: boolean | null;
      ticketsNote: string;
      fullyPaid: boolean | null;
      paymentMethods: string[];
      paidAmountCents: number | null;
      paidOn: string | null;
      hasDuePayment: boolean | null;
      dueAmountCents: number | null;
      dueDate: string | null;
      dueMethod: string | null;
      depositBack: boolean | null;
    } | null;
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
    /**
     * People who asked to be told when a car frees up and have not been
     * written to yet.
     *
     * On the fleet screen because it is demand the office can act on: five
     * people waiting is the argument for getting a car out of the garage
     * today rather than on Friday. Zero on almost every day, and the panel
     * says nothing then.
     */
    waitingForCar: number;
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
      mfkDate: true,
      currentMileageKm: true,
      mileageReadAt: true,
      serviceDoneKm: true,
      serviceDoneOn: true,
      serviceDueKm: true,
      photoUpdatedAt: true,
      repairs: {
        // Planned before done, then newest first. What still has to happen is
        // what the office opens this screen to see; the history is underneath
        // it rather than mixed through it. RepairStatus is declared
        // `planned, done`, so ascending puts the outstanding work on top.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          status: true,
          details: true,
          plannedFor: true,
          doneOn: true,
          mileageKm: true,
          costCents: true,
          createdBy: true,
          createdAt: true,
        },
      },
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
        select: {
          kind: true,
          contractNumber: true,
          signedAt: true,
          // Pickup mileage is what makes the return's figure mean anything:
          // 121,450 km is a number, "1,450 km driven" is the fact.
          mileageKm: true,
          fuelLevel: true,
          damageNotes: true,
          cleanliness: true,
          papersInside: true,
          keyReturned: true,
          tickets: true,
          ticketsNote: true,
          fullyPaid: true,
          paymentMethods: true,
          paidAmountCents: true,
          paidOn: true,
          hasDuePayment: true,
          dueAmountCents: true,
          dueDate: true,
          dueMethod: true,
          depositBack: true,
        },
      },
    },
  });

  const [contracts, mailFailed, unsent, latest, waitingForCar] = await Promise.all([
    prisma.contract.count({ where: { organisationId: organisation.id } }),
    // A contract that exists but whose email never left. Worth surfacing:
    // until now the only way to notice was reading the column by hand.
    //
    // `pdfKey` must be present, and that condition is load-bearing rather
    // than tidy. This band exists to be acted on — every row carries a "send
    // again" button — and the resend handler refuses outright when there is
    // no stored document, because there is nothing to attach. A row that can
    // only ever produce an error is not an alert, it is furniture.
    //
    // It became visible the day the pre-backend contracts were imported. Those
    // twelve have no `pdfKey` (the PDFs sit on a desktop, never uploaded) and
    // no `mailSentAt` (the import does not send), so they filled the band
    // permanently — and a thirteenth, genuinely undelivered contract would
    // have been lost among them. That is the failure mode worth avoiding: an
    // alert list nobody can empty is one nobody reads.
    //
    // Their mail is not actually missing. The build the office used between
    // 17.08 and 13.09 produced a PDF and mailed it; it simply wrote no row.
    // The stamp is absent, not the email — see docs/LEGACY-IMPORT.md. Which
    // is why this filters rather than back-dating `mailSentAt` to invent a
    // send this system never performed.
    prisma.contract.count({
      where: {
        organisationId: organisation.id,
        mailSentAt: null,
        pdfKey: { not: null },
      },
    }),
    // The same rows, newest first, for the Overview band.
    prisma.contract.findMany({
      where: {
        organisationId: organisation.id,
        mailSentAt: null,
        pdfKey: { not: null },
      },
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
    prisma.availabilityAlert.count({
      where: {
        organisationId: organisation.id,
        notifiedAt: null,
        cancelledAt: null,
      },
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
      // Sliced from the ISO string, never formatted through a local Date: a
      // DATE column is midnight UTC, and reading its local parts west of the
      // meridian would report the previous day.
      mfkDate: car.mfkDate ? car.mfkDate.toISOString().slice(0, 10) : null,
      currentMileageKm: car.currentMileageKm,
      // An instant, so it travels as one — the note above is about the DATE
      // columns, which must not.
      mileageReadAt: car.mileageReadAt?.toISOString() ?? null,
      serviceDoneKm: car.serviceDoneKm,
      serviceDoneOn: car.serviceDoneOn
        ? car.serviceDoneOn.toISOString().slice(0, 10)
        : null,
      serviceDueKm: car.serviceDueKm,
      photoUrl: car.photoUpdatedAt
        ? `/api/cars/${encodeURIComponent(car.slug)}/photo/?v=${car.photoUpdatedAt.getTime()}`
        : null,
      repairs: car.repairs.map((repair) => ({
        id: repair.id,
        status: repair.status,
        details: repair.details,
        plannedFor: repair.plannedFor
          ? repair.plannedFor.toISOString().slice(0, 10)
          : null,
        doneOn: repair.doneOn ? repair.doneOn.toISOString().slice(0, 10) : null,
        mileageKm: repair.mileageKm,
        costCents: repair.costCents,
        createdBy: repair.createdBy,
        createdAt: repair.createdAt.toISOString(),
      })),
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
        returnReport: addendum
          ? {
              mileageKm: addendum.mileageKm,
              distanceKm:
                pickup === undefined
                  ? null
                  : addendum.mileageKm - pickup.mileageKm,
              fuelLevel: addendum.fuelLevel,
              damageNotes: addendum.damageNotes,
              cleanliness: addendum.cleanliness,
              papersInside: addendum.papersInside,
              keyReturned: addendum.keyReturned,
              tickets: addendum.tickets,
              ticketsNote: addendum.ticketsNote,
              fullyPaid: addendum.fullyPaid,
              paymentMethods: addendum.paymentMethods,
              paidAmountCents: addendum.paidAmountCents,
              paidOn: addendum.paidOn?.toISOString() ?? null,
              hasDuePayment: addendum.hasDuePayment,
              dueAmountCents: addendum.dueAmountCents,
              dueDate: addendum.dueDate?.toISOString() ?? null,
              dueMethod: addendum.dueMethod,
              depositBack: addendum.depositBack,
            }
          : null,
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
      waitingForCar,
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
