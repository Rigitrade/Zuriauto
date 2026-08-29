import { beforeEach, describe, expect, it } from "vitest";
import { GET as assetGet } from "@/app/api/admin/assets/[id]/route";
import { GET as listGet } from "@/app/api/admin/rentals/[id]/documents/route";
import { GET as pdfGet } from "@/app/api/admin/contracts/[id]/pdf/route";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { hashPassword } from "@/lib/admin/password";
import { persistPickup, type PickupUpload } from "@/lib/rental/persistPickup";
import type { ContractDetails } from "@/lib/rental/schema";
import { getAssetStore } from "@/lib/storage";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";

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
  { kind: "ID_FRONT", body: new Uint8Array([2, 2, 2]), contentType: "image/jpeg" },
  { kind: "ID_BACK", body: new Uint8Array([3]), contentType: "image/jpeg" },
  { kind: "LICENCE_FRONT", body: new Uint8Array([4]), contentType: "image/jpeg" },
  { kind: "LICENCE_BACK", body: new Uint8Array([5]), contentType: "image/jpeg" },
  { kind: "SIGNATURE", body: new Uint8Array([6]), contentType: "image/png" },
];

async function rental() {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  return persistPickup({
    organisationId: org.id,
    details,
    vehicleSlug: details.vehicleId,
    uploads,
    pdf: { body: new Uint8Array([7]) },
    // The store the routes read, so an asset can actually be fetched back.
    store: getAssetStore(),
  });
}

async function session(role: "owner" | "staff" = "staff", username = "anna") {
  const org = await ensureOrganisation(prisma);
  const user = await prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username,
      displayName: username,
      role,
      passwordHash: await hashPassword("a-long-enough-password"),
      credentialsChangedAt: new Date(),
    },
  });
  return `${ADMIN_COOKIE}=${issueAdminSession(user.id)}`;
}

const req = (cookie?: string) =>
  new Request("https://zuriauto.ch/x", { headers: cookie ? { cookie } : {} });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("the office can reach its documents", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = "test-admin-signing-key";
  });

  it("refuses the list without a session", async () => {
    const saved = await rental();
    expect((await listGet(req(), params(saved.rentalId))).status).toBe(401);
  });

  it("refuses one document without a session", async () => {
    await rental();
    const asset = await prisma.asset.findFirstOrThrow();
    expect((await assetGet(req(), params(asset.id))).status).toBe(401);
  });

  it("lists what exists without serving any of it", async () => {
    const saved = await rental();
    const cookie = await session();

    const body = await (
      await listGet(req(cookie), params(saved.rentalId))
    ).json();

    expect(body.contracts).toHaveLength(1);
    expect(body.contracts[0].hasPdf).toBe(true);
    expect(body.contracts[0].assets).toHaveLength(6);
    expect(body.contracts[0].assets.map((a: { kind: string }) => a.kind)).toContain(
      "LICENCE_FRONT"
    );
    // The list answers "is it on file", never "here it is": no key, no bytes.
    expect(JSON.stringify(body)).not.toContain("storageKey");
  });

  it("serves the bytes to staff, and records who asked", async () => {
    await rental();
    const cookie = await session("staff", "desk");
    const asset = await prisma.asset.findFirstOrThrow({
      where: { kind: "ID_FRONT" },
    });

    const response = await assetGet(req(cookie), params(asset.id));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([2, 2, 2])
    );

    const log = await prisma.assetAccess.findMany({ where: { assetId: asset.id } });
    expect(log).toHaveLength(1);
    expect(log[0].username).toBe("desk");
  });

  it("serves the signed contract PDF, and logs that too", async () => {
    // The PDF embeds the portrait, both sides of the ID and both sides of the
    // licence. An unlogged route to it would be a way to read every identity
    // image in the system without leaving a trace.
    const saved = await rental();
    const cookie = await session("staff", "desk2");
    const contract = await prisma.contract.findFirstOrThrow({
      where: { rentalId: saved.rentalId },
      select: { id: true, contractNumber: true },
    });

    const response = await pdfGet(req(cookie), params(contract.id));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      `${contract.contractNumber}.pdf`
    );
    // The bytes themselves, not just the headers. A route that answers 200
    // with an empty or mangled body is exactly the failure that looks like
    // "the PDF will not open" from the outside.
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([7])
    );

    const log = await prisma.assetAccess.findMany({
      where: { contractId: contract.id },
    });
    expect(log).toHaveLength(1);
    expect(log[0].username).toBe("desk2");
    expect(log[0].assetId).toBeNull();
  });

  it("refuses the contract PDF without a session", async () => {
    const saved = await rental();
    const contract = await prisma.contract.findFirstOrThrow({
      where: { rentalId: saved.rentalId },
      select: { id: true },
    });
    expect((await pdfGet(req(), params(contract.id))).status).toBe(401);
  });

  it("answers 410 for a document the retention policy removed", async () => {
    // Distinct from 404 on purpose: "we checked a passport and the image is
    // now gone" is a different fact from "no passport was ever taken".
    await rental();
    const cookie = await session();
    const asset = await prisma.asset.findFirstOrThrow();
    await prisma.asset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });

    const response = await assetGet(req(cookie), params(asset.id));
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("deleted");
  });

  it("still lists a deleted document, so its absence is explainable", async () => {
    const saved = await rental();
    const cookie = await session();
    const asset = await prisma.asset.findFirstOrThrow({ where: { kind: "ID_BACK" } });
    await prisma.asset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date("2026-08-01") },
    });

    const body = await (
      await listGet(req(cookie), params(saved.rentalId))
    ).json();
    const listed = body.contracts[0].assets.find(
      (a: { kind: string }) => a.kind === "ID_BACK"
    );
    expect(listed.deletedAt).toBeTruthy();
  });
});
