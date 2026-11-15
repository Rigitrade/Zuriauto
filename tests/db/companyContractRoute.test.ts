import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/rental-contract/route";
import { prisma } from "@/lib/db";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import { issueReuseToken } from "@/lib/rental/reuseToken";
import type { ContractDetails } from "@/lib/rental/schema";
import { getAssetStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-office-secret";

/**
 * Multi-company phase B, review fix: the company is read BEFORE the contract
 * is recorded. A failure reading it must answer "not recorded" with nothing
 * saved, never an error for a contract that was saved.
 */
const failing = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/company/load", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/company/load")>();
  return {
    ...original,
    loadCompanyIdentity: async (...args: Parameters<typeof original.loadCompanyIdentity>) => {
      if (failing.on) throw new Error("database blip");
      return original.loadCompanyIdentity(...args);
    },
  };
});

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    paymentMethod: "twint",
    totalWeeks: 1,
    weeklyAmountCents: 45_000,
    depositCents: 50_000,
  },
  lastName: "Meier",
  firstName: "Anna",
  birthDate: "1990-04-12",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "Switzerland",
  mobile: "079 123 45 67",
  email: "anna@example.ch",
  gtcAccepted: true,
  gtcVersion: "2026-07-31",
  gtcLanguage: "de",
  acceptedAt: "2026-08-17T08:00:00.000Z",
  truthfulInfoConfirmedAt: "2026-08-17T08:00:10.000Z",
  deceptionNoticeConfirmedAt: "2026-08-17T08:00:20.000Z",
  place: "Zurich",
};

const ALL_FIVE: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

/**
 * The first contract, written directly so the route test is about the second.
 *
 * Seeded through `getAssetStore()` rather than a fresh memory store, because
 * that is what the route will use: with R2 unconfigured it caches one memory
 * store for the process, so the copy the route performs can actually find these
 * objects. A local `createMemoryStore()` here would make the happy path fail
 * for a reason that has nothing to do with the code under test.
 */
async function seedFirstContract() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  const saved = await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads: ALL_FIVE,
    pdf: { body: new Uint8Array([7]) },
    store: getAssetStore(),
  });
  await prisma.car.updateMany({ data: { status: "available" } });
  return saved;
}

function submission(meta: Record<string, unknown>): Request {
  const body = new FormData();
  body.append(
    "pdf",
    new File([new Uint8Array([37, 80, 68, 70])], "c.pdf", {
      type: "application/pdf",
    })
  );
  body.append(
    "asset:SIGNATURE",
    new File([new Uint8Array([6])], "s.png", { type: "image/png" })
  );
  body.append("meta", JSON.stringify(meta));
  body.append("company", "");

  return new Request("https://zuriauto.ch/api/rental-contract/", {
    method: "POST",
    body,
  });
}

const meta = {
  contractNumber: "ZA-20260822-0002",
  customerName: "Anna Meier",
  customerEmail: "anna@example.ch",
  vehicleLabel: "Toyota Prius",
  plate: "ZH 513925",
  mileageKm: 120_000,
  language: "de",
  details,
};

describe("POST /api/rental-contract when the company cannot be read", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
    failing.on = false;
  });

  it("records nothing and says so, rather than failing after the contract is saved", async () => {
    const first = await seedFirstContract();
    failing.on = true;

    const response = await POST(
      submission({ ...meta, reuseToken: issueReuseToken(first.contractId), identityChecked: true })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "not-recorded" });
    expect(await prisma.contract.count()).toBe(1);
  });
});
