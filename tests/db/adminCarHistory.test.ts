import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/cars/[id]/history/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

/**
 * Who had this car on the day of the offence.
 *
 * The endpoint behind the Vehicle history screen. Unlike /api/admin/overview/,
 * which deliberately shows only what is still open, this one answers about the
 * past — which is the only kind of question a traffic fine ever asks, because
 * it arrives weeks after the car came back.
 */

const SECRET = "test-admin-secret";

/** A car every test can hang rentals off. Seeded from the real fleet so the
 *  slug and plate are the ones the office would actually type. */
async function fixtures() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const car = await prisma.car.findFirstOrThrow({
    where: { organisationId: org.id, slug: "prius-zh513925" },
    select: { id: true, plate: true, model: true },
  });
  return { org, car };
}

let customerSeq = 0;

async function renter(organisationId: string, firstName: string, lastName: string) {
  customerSeq += 1;
  return prisma.customer.create({
    data: {
      organisationId,
      firstName,
      lastName,
      // Unique per row: the schema holds email unique per organisation, and a
      // shared literal would make the second renter in a test fail to insert.
      email: `renter${customerSeq}@example.ch`,
      phone: `079 000 00 0${customerSeq}`,
      birthDate: new Date("1990-04-12"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
    select: { id: true },
  });
}

let contractSeq = 0;

/** A rental over a fixed window, with the pickup contract the office would
 *  reach for as proof of who signed. */
async function rented(options: {
  organisationId: string;
  carId: string;
  firstName: string;
  lastName: string;
  startAt: string;
  endAt: string;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  withContract?: boolean;
}) {
  const customer = await renter(
    options.organisationId,
    options.firstName,
    options.lastName
  );

  const rental = await prisma.rental.create({
    data: {
      organisationId: options.organisationId,
      carId: options.carId,
      customerId: customer.id,
      createdBy: "office",
      type: "WEEKLY",
      status: options.status ?? "COMPLETED",
      startAt: new Date(options.startAt),
      endAt: new Date(options.endAt),
    },
    select: { id: true },
  });

  if (options.withContract === false) return { ...rental, contractNumber: null };

  contractSeq += 1;
  const contractNumber = `ZA-20260701-${String(contractSeq).padStart(4, "0")}`;
  await prisma.contract.create({
    data: {
      organisationId: options.organisationId,
      rentalId: rental.id,
      contractNumber,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 120_000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: new Date(options.startAt),
      signedAt: new Date(options.startAt),
    },
  });

  return { ...rental, contractNumber };
}

/** Idempotent: a test that searches twice signs in as the same person both
 *  times, rather than tripping the unique username. */
async function signedIn(): Promise<Request> {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.upsert({
    where: {
      organisationId_username: { organisationId: org.id, username: "ahmed" },
    },
    update: {},
    create: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
  return new Request("https://zuriauto.ch/api/admin/cars/x/history/", {
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession(user.id)}` },
  });
}

/** The route reads its window off the URL, so a query has to be built onto a
 *  request that already carries the cookie. */
async function ask(carId: string, query = "") {
  const base = await signedIn();
  const request = new Request(
    `https://zuriauto.ch/api/admin/cars/${carId}/history/${query}`,
    { headers: base.headers }
  );
  return GET(request, { params: Promise.resolve({ id: carId }) });
}

describe("GET /api/admin/cars/[id]/history", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
  });

  it("refuses a request with no cookie", async () => {
    const { car } = await fixtures();
    const response = await GET(
      new Request(`https://zuriauto.ch/api/admin/cars/${car.id}/history/`),
      { params: Promise.resolve({ id: car.id }) }
    );
    expect(response.status).toBe(401);
  });

  it("reports a car nobody has heard of as not found", async () => {
    await fixtures();
    const response = await ask("no-such-car");
    expect(response.status).toBe(404);
  });

  it("shows a finished rental, which the overview hides", async () => {
    const { org, car } = await fixtures();
    const rental = await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
      status: "COMPLETED",
    });

    const body = await (await ask(car.id)).json();

    expect(body.car.plate).toBe(car.plate);
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].id).toBe(rental.id);
    expect(body.periods[0].status).toBe("COMPLETED");
    expect(body.periods[0].customerName).toBe("Anna Meier");
    expect(body.periods[0].contractNumber).toBe(rental.contractNumber);
  });

  it("carries the renter's phone and email, so the fine can be forwarded", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });

    const body = await (await ask(car.id)).json();
    expect(body.periods[0].customerPhone).toMatch(/079/);
    expect(body.periods[0].customerEmail).toContain("@");
  });

  it("lists the newest period first", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-06-20T08:00:00.000Z",
    });
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Luca",
      lastName: "Bernasconi",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });

    const body = await (await ask(car.id)).json();
    expect(body.periods.map((p: { customerName: string }) => p.customerName)).toEqual([
      "Luca Bernasconi",
      "Anna Meier",
    ]);
  });

  it("never reports another car's rentals", async () => {
    const { org, car } = await fixtures();
    const other = await prisma.car.findFirstOrThrow({
      where: { organisationId: org.id, slug: "prius-zh401859" },
      select: { id: true },
    });
    await rented({
      organisationId: org.id,
      carId: other.id,
      firstName: "Someone",
      lastName: "Else",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });

    const body = await (await ask(car.id)).json();
    expect(body.periods).toEqual([]);
  });

  it("finds the rental that covers the day of the offence", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Luca",
      lastName: "Bernasconi",
      startAt: "2026-07-20T08:00:00.000Z",
      endAt: "2026-07-28T08:00:00.000Z",
    });

    const body = await (
      await ask(car.id, "?from=2026-07-12T00:00:00.000Z&to=2026-07-12T23:59:59.999Z")
    ).json();

    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].customerName).toBe("Anna Meier");
  });

  it("matches a rental that spans the whole window rather than sitting inside it", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-06-01T08:00:00.000Z",
      endAt: "2026-08-31T08:00:00.000Z",
    });

    // Containment would return nothing here, and the office would conclude
    // the car was with nobody for a fortnight it was plainly out.
    const body = await (
      await ask(car.id, "?from=2026-07-01T00:00:00.000Z&to=2026-07-14T00:00:00.000Z")
    ).json();

    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].customerName).toBe("Anna Meier");
  });

  it("answers with nothing for a date the car was in the yard", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Luca",
      lastName: "Bernasconi",
      startAt: "2026-07-20T08:00:00.000Z",
      endAt: "2026-07-28T08:00:00.000Z",
    });

    // The 17th falls between the two. Reporting either renter here would put
    // somebody else's fine on them.
    const body = await (
      await ask(car.id, "?from=2026-07-17T00:00:00.000Z&to=2026-07-17T23:59:59.999Z")
    ).json();

    expect(body.periods).toEqual([]);
  });

  it("treats a window with only a start as that single instant", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });

    const covered = await (await ask(car.id, "?from=2026-07-10T09:00:00.000Z")).json();
    expect(covered.periods).toHaveLength(1);

    const after = await (await ask(car.id, "?from=2026-07-19T09:00:00.000Z")).json();
    expect(after.periods).toEqual([]);
  });

  it("refuses a window it cannot read rather than ignoring it", async () => {
    const { car } = await fixtures();
    // Silently dropping an unparseable date would answer a different question
    // from the one that was asked, and look authoritative doing it.
    const response = await ask(car.id, "?from=the-twelfth");
    expect(response.status).toBe(400);
  });

  it("keeps a cancelled rental on the timeline, labelled as cancelled", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
      status: "CANCELLED",
    });

    // A cancelled rental means the car never left the yard. Hiding the row
    // would leave a hole in the timeline with no explanation; showing it
    // unlabelled would hand somebody a fine for a car they never collected.
    const body = await (await ask(car.id)).json();
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].status).toBe("CANCELLED");
  });

  it("shows a rental still running as the car's current holder", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-09-01T08:00:00.000Z",
      endAt: "2026-09-30T08:00:00.000Z",
      status: "ACTIVE",
    });

    const body = await (await ask(car.id)).json();
    expect(body.periods[0].status).toBe("ACTIVE");
  });

  it("reports a period with no contract rather than dropping it", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
      withContract: false,
    });

    const body = await (await ask(car.id)).json();
    expect(body.periods).toHaveLength(1);
    expect(body.periods[0].contractNumber).toBeNull();
  });

  it("records who ran the search, against which car and window", async () => {
    const { org, car } = await fixtures();
    await rented({
      organisationId: org.id,
      carId: car.id,
      firstName: "Anna",
      lastName: "Meier",
      startAt: "2026-07-01T08:00:00.000Z",
      endAt: "2026-07-15T08:00:00.000Z",
    });

    await ask(car.id, "?from=2026-07-12T00:00:00.000Z&to=2026-07-12T23:59:59.999Z");

    const logged = await prisma.carHistoryLookup.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0].carId).toBe(car.id);
    // The username, as AssetAccess records it — not the display name, which
    // two people could share.
    expect(logged[0].username).toBe("ahmed");
    expect(logged[0].matches).toBe(1);
    expect(logged[0].windowFrom).toEqual(new Date("2026-07-12T00:00:00.000Z"));
  });

  it("records a search that found nobody", async () => {
    const { car } = await fixtures();

    await ask(car.id);

    // The same reasoning as CustomerLookup's empty rows: a run of searches
    // that match nothing is exactly the shape of somebody trawling, and not
    // recording those would defeat the point of the table.
    const logged = await prisma.carHistoryLookup.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0].matches).toBe(0);
  });
});
