import type { PrismaClient } from "@/generated/prisma/client";
import { mfkStanding } from "@/lib/admin/mfk";
import { serviceStanding } from "@/lib/admin/service";
import { BY_OFFICE_ORDER } from "@/lib/admin/carOrder";
import { loadCompanyIdentity } from "@/lib/company/load";
import { openBalances } from "@/lib/payments/account";
import { findSiteOrganisationWith } from "@/lib/organisationCore";

/**
 * The "Partner" page (16.11.2026): every company side by side, for
 * ZURIAUTO's owner, read-only. Each figure is computed the way the company's
 * own console computes it, so the two never disagree: money owed is the
 * Zahlungen page's list (`openBalances`), MFK and service the fleet's
 * standings, fines the Bussen page's statuses.
 */

/** Rentals still under way: out, extended, or back but not yet checked. */
const RUNNING = ["ACTIVE", "EXTENSION_REQUESTED", "RETURN_SUBMITTED"] as const;
/** Fines still to be dealt with by somebody. */
const OPEN_FINE = ["NEEDS_REVIEW", "NOTIFIED", "PROOF_SUBMITTED"] as const;

export interface CompanyOverview {
  id: string;
  name: string;
  slug: string | null;
  isSite: boolean;
  disabled: boolean;
  cars: { total: number; available: number; rented: number; maintenance: number; retired: number };
  activeRentals: number;
  /** Returns sent in by renters, waiting for the office to check. */
  returnsToCheck: number;
  /** Due and unpaid, plus deposits missing, as on the Zahlungen page. */
  owedCents: number;
  owingRentals: number;
  fines: { open: number; overdue: number };
  /** Cars on the road only: a retired car's inspection is nobody's task. */
  mfk: { due: number; expired: number };
  service: { due: number; overdue: number };
}

export interface FleetCar {
  id: string;
  companyId: string;
  companyName: string;
  model: string;
  plate: string;
  colour: string | null;
  status: string;
  renterName: string | null;
  /** The running rental's agreed end, or null for an open-ended one. */
  rentalEndAt: string | null;
  /** `YYYY-MM-DD`, a calendar day. */
  mfkDate: string | null;
  currentMileageKm: number | null;
  serviceDueKm: number | null;
  serviceDoneKm: number | null;
}

export interface PartnerOverview {
  companies: CompanyOverview[];
  cars: FleetCar[];
}

export async function partnerOverview(client: PrismaClient, now: Date): Promise<PartnerOverview> {
  const site = await findSiteOrganisationWith(client);
  const organisations = await client.organisation.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, disabledAt: true },
  });
  // ZURIAUTO first, then the partners in the order they joined.
  organisations.sort((x, y) => Number(y.id === site?.id) - Number(x.id === site?.id));

  const cars = await client.car.findMany({
    // The office's order, exactly as each company's own fleet page shows it.
    orderBy: BY_OFFICE_ORDER,
    select: {
      id: true,
      organisationId: true,
      model: true,
      plate: true,
      colour: true,
      status: true,
      mfkDate: true,
      currentMileageKm: true,
      serviceDueKm: true,
      serviceDoneKm: true,
      rentals: {
        where: { status: { in: [...RUNNING] } },
        orderBy: { startAt: "desc" },
        take: 1,
        select: { endAt: true, customer: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  const names = new Map<string, string>();
  // All companies at once: each is a handful of independent reads, and done
  // one after another they would add up with every partner that joins.
  const companies: CompanyOverview[] = await Promise.all(organisations.map(async (org) => {
    const identity = await loadCompanyIdentity(client, org.id);
    names.set(org.id, identity.brandName);
    const own = cars.filter((car) => car.organisationId === org.id);
    const onTheRoad = own.filter((car) => car.status !== "retired");
    const mfk = onTheRoad.map((car) => mfkStanding(car.mfkDate?.toISOString().slice(0, 10), now));
    const service = onTheRoad.map((car) => serviceStanding(car));
    const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(now)}T00:00:00Z`);

    const [activeRentals, returnsToCheck, openFines, overdueFines, owed] = await Promise.all([
      client.rental.count({ where: { organisationId: org.id, status: { in: [...RUNNING] } } }),
      client.rental.count({ where: { organisationId: org.id, status: "RETURN_SUBMITTED" } }),
      client.fine.count({ where: { organisationId: org.id, status: { in: [...OPEN_FINE] } } }),
      client.fine.count({ where: { organisationId: org.id, status: "NOTIFIED", dueDate: { lt: today } } }),
      openBalances(client, org.id, now),
    ]);

    return {
      id: org.id,
      name: identity.brandName,
      slug: org.slug,
      isSite: org.id === site?.id,
      disabled: org.disabledAt !== null,
      cars: {
        total: own.length,
        available: own.filter((car) => car.status === "available").length,
        rented: own.filter((car) => car.status === "rented").length,
        maintenance: own.filter((car) => car.status === "maintenance").length,
        retired: own.filter((car) => car.status === "retired").length,
      },
      activeRentals,
      returnsToCheck,
      owedCents: owed.reduce((sum, row) => sum + row.owedCents + row.depositMissingCents, 0),
      owingRentals: owed.filter((row) => row.owedCents + row.depositMissingCents > 0).length,
      fines: { open: openFines, overdue: overdueFines },
      mfk: { due: mfk.filter((s) => s === "due").length, expired: mfk.filter((s) => s === "expired").length },
      service: {
        due: service.filter((s) => s === "due").length,
        overdue: service.filter((s) => s === "overdue").length,
      },
    };
  }));

  // Company by company, in the companies' order, each in its office's order.
  const position = new Map(organisations.map((org, index) => [org.id, index]));
  const fleet = cars
    .map((car, index) => ({ car, index }))
    .sort((x, y) => (position.get(x.car.organisationId) ?? 0) - (position.get(y.car.organisationId) ?? 0) || x.index - y.index)
    .map(({ car }) => {
      const rental = car.rentals[0];
      return {
        id: car.id,
        companyId: car.organisationId,
        companyName: names.get(car.organisationId) ?? "",
        model: car.model,
        plate: car.plate,
        colour: car.colour,
        status: car.status,
        renterName: rental ? `${rental.customer.firstName} ${rental.customer.lastName}`.trim() : null,
        rentalEndAt: rental?.endAt?.toISOString() ?? null,
        mfkDate: car.mfkDate?.toISOString().slice(0, 10) ?? null,
        currentMileageKm: car.currentMileageKm,
        serviceDueKm: car.serviceDueKm,
        serviceDoneKm: car.serviceDoneKm,
      };
    });

  return { companies, cars: fleet };
}
