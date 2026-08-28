import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/contracts/[id]/resend/route";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { hashPassword } from "@/lib/admin/password";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { createMemoryStore, getAssetStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

const SECRET = "test-admin-signing-key";

const details: ContractDetails = {
  vehicleId: "prius-zh513925",
  mileageKm: 120_000,
  fuelLevel: "3/4",
  existingDamage: "",
  terms: {
    type: "WEEKLY",
    startAt: "2026-08-17T08:00:00.000Z",
    totalWeeks: 4,
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
  place: "Zurich",
};

const uploads: PickupUpload[] = [
  { kind: "PORTRAIT", body: new Uint8Array([1]), contentType: "image/jpeg" },
  { kind: "ID_FRONT", body: new Uint8Array([2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

/**
 * @param intoRealStore whether the PDF lands in the store the route reads.
 *   getAssetStore() caches one memory store per process without R2, so passing
 *   it here is what lets the route find the object; a throwaway store leaves
 *   the row pointing at nothing, which is its own test below.
 */
async function seedContract(intoRealStore = true) {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  await persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    store: intoRealStore ? getAssetStore() : createMemoryStore(),
  });
  const contract = await prisma.contract.findFirstOrThrow({
    select: { id: true, mailSentAt: true },
  });
  return { org, contract };
}

async function staffSession() {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "anna",
      displayName: "Anna",
      role: "staff",
      passwordHash: await hashPassword("a-long-enough-password"),
      credentialsChangedAt: new Date(),
    },
  });
  return `${ADMIN_COOKIE}=${issueAdminSession(user.id)}`;
}

function request(id: string, cookie?: string): Request {
  return new Request(`https://zuriauto.ch/api/admin/contracts/${id}/resend/`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

describe("POST /api/admin/contracts/[id]/resend", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("refuses a request with no session", async () => {
    const { contract } = await seedContract();
    const response = await POST(request(contract.id), {
      params: Promise.resolve({ id: contract.id }),
    });
    expect(response.status).toBe(401);
  });

  it("refuses a contract that does not exist", async () => {
    const cookie = await staffSession();
    const id = "ckzzzzzzzzzzzzzzzzzzzzzzz";
    const response = await POST(request(id, cookie), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });

  it("refuses a contract whose mail already went", async () => {
    const { contract } = await seedContract();
    await prisma.contract.update({
      where: { id: contract.id },
      data: { mailSentAt: new Date() },
    });
    const cookie = await staffSession();

    const response = await POST(request(contract.id, cookie), {
      params: Promise.resolve({ id: contract.id }),
    });
    // Not an error the office caused, and not silent either: resending a
    // contract that already arrived would mail the customer twice.
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("already-sent");
  });

  it("refuses when the row outlived its document", async () => {
    // The contract exists, its pdfKey does not resolve. Nothing a retry fixes,
    // and distinct from "not found" so the office can tell the two apart.
    const { contract } = await seedContract(false);
    const cookie = await staffSession();

    const response = await POST(request(contract.id, cookie), {
      params: Promise.resolve({ id: contract.id }),
    });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("no-document");
  });

  it("reports the misconfiguration rather than pretending to send", async () => {
    // No SMTP in the test environment. The one thing this must never do is
    // stamp mailSentAt on a send that did not happen — that would hide the
    // contract from the office's list for ever.
    const { contract } = await seedContract();
    const cookie = await staffSession();

    const response = await POST(request(contract.id, cookie), {
      params: Promise.resolve({ id: contract.id }),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("mail-not-configured");

    const after = await prisma.contract.findUniqueOrThrow({
      where: { id: contract.id },
      select: { mailSentAt: true },
    });
    expect(after.mailSentAt).toBeNull();
  });
});
