import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/rental/actionToken";
import {
  MAX_SELF_SERVICE_WEEKS,
  extendRental,
  quoteExtension,
  recordReturnIntent,
  resolveManageToken,
} from "@/lib/rental/manage";
import { notifyExtension } from "@/lib/rental/manageActions";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

// Real claim-and-send logic, with the transport stubbed so nothing leaves.
vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/rental/lifecycleMail")
  >();
  return { ...original, sendMail: async () => {} };
});

beforeAll(() => {
  // readLifecycleMailConfig returns null without these, and notifyExtension
  // then returns before claiming anything.
  process.env.SMTP_HOST = "localhost";
  process.env.SMTP_USER = "u";
  process.env.SMTP_PASS = "p";
  process.env.MAIL_OFFICE = "office@zuriauto.ch";
});

const NOW = new Date("2026-08-18T09:00:00Z");
const START = new Date("2026-07-21T08:00:00Z");

async function aRentalWithToken(opts?: {
  type?: "WEEKLY" | "FIXED_TERM";
  status?: "ACTIVE" | "COMPLETED";
  expiresAt?: Date;
  usedAt?: Date;
  totalWeeks?: number;
}) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const car = await prisma.car.findFirstOrThrow({ where: { status: "available" } });

  const customer = await prisma.customer.create({
    data: {
      organisationId: org.id,
      firstName: "Anna",
      lastName: "Meier",
      email: "anna@example.ch",
      phone: "+41791234567",
      birthDate: new Date("1990-04-12T00:00:00.000Z"),
      street: "Bahnhofstrasse 1",
      postalCode: "8001",
      city: "Zürich",
      country: "Switzerland",
    },
  });

  const weekly = (opts?.type ?? "WEEKLY") === "WEEKLY";
  const totalWeeks = opts?.totalWeeks ?? 4;

  const rental = await prisma.rental.create({
    data: {
      organisationId: org.id,
      carId: car.id,
      customerId: customer.id,
      createdBy: "office",
      type: weekly ? "WEEKLY" : "FIXED_TERM",
      status: opts?.status ?? "ACTIVE",
      startAt: START,
      endAt: new Date("2026-08-18T08:00:00Z"),
      totalWeeks: weekly ? totalWeeks : null,
      weeklyAmountCents: weekly ? 45_000 : null,
      totalAmountCents: weekly ? null : 60_000,
      billingWeekday: weekly ? 2 : null,
    },
  });

  await prisma.contract.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      contractNumber: `ZA-TEST-${rental.id.slice(-6)}`,
      createdBy: "office",
      kind: "PICKUP",
      mileageKm: 1000,
      fuelLevel: "full",
      gtcVersion: "2026-07-31",
      gtcLanguage: "de",
      acceptedAt: START,
    },
  });

  if (weekly) {
    await prisma.charge.createMany({
      data: Array.from({ length: totalWeeks }, (_, i) => ({
        organisationId: org.id,
        rentalId: rental.id,
        weekNumber: i + 1,
        dueDate: new Date(START.getTime() + i * 7 * 86_400_000),
        amountCents: 45_000,
      })),
    });
  }

  const raw = generateToken();
  const token = await prisma.actionToken.create({
    data: {
      organisationId: org.id,
      rentalId: rental.id,
      purpose: "MANAGE_RENTAL",
      tokenHash: hashToken(raw),
      expiresAt: opts?.expiresAt ?? new Date("2026-09-01T09:00:00Z"),
      usedAt: opts?.usedAt ?? null,
    },
  });

  return { raw, token, rental, organisationId: org.id };
}

describe("resolveManageToken", () => {
  it("resolves a valid token to its rental", async () => {
    const { raw, rental } = await aRentalWithToken();
    const found = await resolveManageToken(prisma, raw, NOW);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.rental.id).toBe(rental.id);
    expect(found.rental.carPlate).toBeTruthy();
    expect(found.rental.customerFirstName).toBe("Anna");
  });

  it("refuses an unknown token", async () => {
    await aRentalWithToken();
    const found = await resolveManageToken(prisma, generateToken(), NOW);
    expect(found).toEqual({ ok: false, reason: "unusable" });
  });

  it("refuses an empty token", async () => {
    expect(await resolveManageToken(prisma, "", NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });

  it("refuses an expired token", async () => {
    const { raw } = await aRentalWithToken({
      expiresAt: new Date("2026-08-17T09:00:00Z"),
    });
    expect(await resolveManageToken(prisma, raw, NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });

  it("refuses an already-used token", async () => {
    const { raw } = await aRentalWithToken({
      usedAt: new Date("2026-08-17T09:00:00Z"),
    });
    expect(await resolveManageToken(prisma, raw, NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });

  it("gives the same answer for unknown, expired and used", async () => {
    // Deliberate: a caller learns only that the link does not work, never
    // which of the three reasons applies.
    const unknown = await resolveManageToken(prisma, generateToken(), NOW);
    const { raw: expired } = await aRentalWithToken({
      expiresAt: new Date("2026-08-01T09:00:00Z"),
    });
    expect(unknown).toEqual(await resolveManageToken(prisma, expired, NOW));
  });

  it("refuses a token for a rental that is no longer active", async () => {
    const { raw } = await aRentalWithToken({ status: "COMPLETED" });
    expect(await resolveManageToken(prisma, raw, NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });
});

describe("recordReturnIntent", () => {
  it("records the intent and burns the token", async () => {
    const { raw, token, rental } = await aRentalWithToken();

    expect(await recordReturnIntent(prisma, token.id, rental.id, NOW)).toEqual({
      ok: true,
    });

    const event = await prisma.rentalEvent.findFirstOrThrow();
    expect(event.type).toBe("return.intended");

    // The link cannot be replayed.
    expect(await resolveManageToken(prisma, raw, NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });

  it("leaves the rental ACTIVE, so the overdue pass still fires", async () => {
    // RETURN_SUBMITTED is reserved for Phase 4. A promise is not a handover.
    const { token, rental } = await aRentalWithToken();
    await recordReturnIntent(prisma, token.id, rental.id, NOW);

    const after = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
    });
    expect(after.status).toBe("ACTIVE");
  });

  it("refuses a second use of the same token", async () => {
    const { token, rental } = await aRentalWithToken();
    await recordReturnIntent(prisma, token.id, rental.id, NOW);

    expect(await recordReturnIntent(prisma, token.id, rental.id, NOW)).toEqual({
      ok: false,
      reason: "token-consumed",
    });
    expect(await prisma.rentalEvent.count()).toBe(1);
  });

  it("survives two concurrent submissions of the same link", async () => {
    const { token, rental } = await aRentalWithToken();

    const results = await Promise.all([
      recordReturnIntent(prisma, token.id, rental.id, NOW),
      recordReturnIntent(prisma, token.id, rental.id, NOW),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.rentalEvent.count()).toBe(1);
  });
});

describe("quoteExtension", () => {
  it("prices at the existing weekly rate and moves the end date", () => {
    const quote = quoteExtension(
      { startAt: START, totalWeeks: 4, weeklyAmountCents: 45_000 },
      2
    );
    expect(quote).not.toBeNull();
    expect(quote!.amountCents).toBe(90_000);
    expect(quote!.firstNewWeek).toBe(5);
    // Six weeks from 21 July is 1 September, same wall-clock time in Zurich.
    expect(quote!.newEndAt.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("refuses a fixed-term rental, which has no weekly rate", () => {
    expect(
      quoteExtension(
        { startAt: START, totalWeeks: null, weeklyAmountCents: null },
        2
      )
    ).toBeNull();
  });

  it("refuses nonsense week counts", () => {
    const rental = { startAt: START, totalWeeks: 4, weeklyAmountCents: 45_000 };
    expect(quoteExtension(rental, 0)).toBeNull();
    expect(quoteExtension(rental, 1.5)).toBeNull();
  });
});

describe("extendRental", () => {
  it("moves endAt, adds charges and leaves the earlier ones untouched", async () => {
    const { token, rental } = await aRentalWithToken({ totalWeeks: 4 });

    const result = await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 2,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.amountCents).toBe(90_000);
    expect(result.paymentUrl).toContain("sumup");

    const after = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
    });
    expect(after.totalWeeks).toBe(6);
    expect(after.endAt.toISOString()).toBe("2026-09-01T08:00:00.000Z");

    const charges = await prisma.charge.findMany({
      orderBy: { weekNumber: "asc" },
    });
    expect(charges.map((c) => c.weekNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    // Week 5 continues from the original start, not from today.
    expect(charges[4].dueDate.toISOString()).toBe("2026-08-18T08:00:00.000Z");
    // Everything already scheduled is still scheduled.
    expect(charges.every((c) => c.status === "SCHEDULED")).toBe(true);
  });

  it("records the extension as an event", async () => {
    const { token, rental } = await aRentalWithToken();
    await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 1,
      now: NOW,
    });
    const event = await prisma.rentalEvent.findFirstOrThrow();
    expect(event.type).toBe("rental.extended");
  });

  it("burns the token, so the link cannot be replayed", async () => {
    const { raw, token, rental } = await aRentalWithToken();
    await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 1,
      now: NOW,
    });
    expect(await resolveManageToken(prisma, raw, NOW)).toEqual({
      ok: false,
      reason: "unusable",
    });
  });

  it("refuses a second extension with the same token, changing nothing", async () => {
    const { token, rental } = await aRentalWithToken({ totalWeeks: 4 });
    await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 2,
      now: NOW,
    });

    const second = await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 2,
      now: NOW,
    });

    expect(second).toEqual({ ok: false, reason: "token-consumed" });
    const after = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
    });
    expect(after.totalWeeks).toBe(6);
    expect(await prisma.charge.count()).toBe(6);
  });

  it("refuses more weeks than a renter may add alone", async () => {
    const { token, rental } = await aRentalWithToken();
    expect(
      await extendRental(prisma, {
        tokenId: token.id,
        rentalId: rental.id,
        weeks: MAX_SELF_SERVICE_WEEKS + 1,
        now: NOW,
      })
    ).toEqual({ ok: false, reason: "too-many-weeks" });

    // The token is untouched, so the renter can still choose a shorter one.
    const token2 = await prisma.actionToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(token2.usedAt).toBeNull();
  });

  it("refuses a fixed-term rental", async () => {
    const { token, rental } = await aRentalWithToken({ type: "FIXED_TERM" });
    expect(
      await extendRental(prisma, {
        tokenId: token.id,
        rentalId: rental.id,
        weeks: 1,
        now: NOW,
      })
    ).toEqual({ ok: false, reason: "not-extendable" });
  });

  it("survives two concurrent extensions of the same link", async () => {
    const { token, rental } = await aRentalWithToken({ totalWeeks: 4 });

    const results = await Promise.all([
      extendRental(prisma, {
        tokenId: token.id,
        rentalId: rental.id,
        weeks: 2,
        now: NOW,
      }),
      extendRental(prisma, {
        tokenId: token.id,
        rentalId: rental.id,
        weeks: 2,
        now: NOW,
      }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const after = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
    });
    expect(after.totalWeeks).toBe(6);
  });
});

describe("audit regressions", () => {
  it("notifies the office about an extension without labelling it overdue", async () => {
    // It used to claim kind RENTAL_OVERDUE, which would have Phase 5 counting
    // every extension as a late car. Asserted on the rows, not the source.
    const { token, rental } = await aRentalWithToken();

    const result = await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 1,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolved = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
      include: { customer: true, car: true },
    });

    await notifyExtension(
      {
        id: resolved.id,
        organisationId: resolved.organisationId,
        endAt: resolved.endAt,
        customerFirstName: resolved.customer.firstName,
        customerEmail: resolved.customer.email,
        customerName: `${resolved.customer.firstName} ${resolved.customer.lastName}`,
        customerPhone: resolved.customer.phone,
        carModel: resolved.car.model,
        carPlate: resolved.car.plate,
        language: "de",
      },
      {
        weeks: result.quote.weeks,
        newEndAt: result.quote.newEndAt,
        amountCents: result.quote.amountCents,
        paymentUrl: result.paymentUrl,
      },
      NOW
    );

    const rows = await prisma.notification.findMany({
      orderBy: { dedupeKey: "asc" },
    });

    // Two rows: the renter's and the office's, both extensions.
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === "EXTENSION_CONFIRMED")).toBe(true);
    expect(
      await prisma.notification.count({ where: { kind: "RENTAL_OVERDUE" } })
    ).toBe(0);

    // One goes to the office, one to the renter, under distinct dedupe keys.
    expect(new Set(rows.map((r) => r.dedupeKey)).size).toBe(2);
    expect(rows.map((r) => r.to)).toContain("office@zuriauto.ch");
    expect(rows.map((r) => r.to)).toContain(resolved.customer.email);
  });
  it("still returns a payable link if the provider is unreachable", async () => {
    // The extension is committed and the token spent by this point. Showing the
    // renter an error would have them retry into a 410 and believe it failed.
    const { token, rental } = await aRentalWithToken();
    const payments = await import("@/lib/payments");
    const spy = vi
      .spyOn(payments, "getPaymentProvider")
      .mockReturnValue({
        name: "broken",
        confirmsAutomatically: false,
        createRequest: async () => {
          throw new Error("provider down");
        },
      });

    const result = await extendRental(prisma, {
      tokenId: token.id,
      rentalId: rental.id,
      weeks: 1,
      now: NOW,
    });

    spy.mockRestore();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentUrl).toContain("sumup");

    // And the extension itself still stands.
    const after = await prisma.rental.findUniqueOrThrow({
      where: { id: rental.id },
    });
    expect(after.totalWeeks).toBe(5);
  });
});
