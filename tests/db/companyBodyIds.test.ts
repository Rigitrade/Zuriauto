import { beforeEach, describe, expect, it } from "vitest";
import { POST as fineAction } from "@/app/api/admin/fines/[id]/actions/route";
import { POST as createCar } from "@/app/api/admin/cars/route";
import { POST as createUser } from "@/app/api/admin/users/route";
import { POST as registerLetter } from "@/app/api/admin/fines/documents/route";
import { prisma } from "@/lib/db";
import { getAssetStore } from "@/lib/storage";
import { buildCompany, snapshot, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase A, final review (15.11.2026): ids that arrive in the
 * request BODY must stop at the wall too, and the per-company uniques
 * (plates) must not let one company disturb another's sign-in.
 */

let a: CompanyFixture;
let b: CompanyFixture;

beforeEach(async () => {
  a = await buildCompany("A");
  b = await buildCompany("B");
});

function post(headers: Record<string, string>, body: unknown): Request {
  return new Request("https://zuriauto.ch/api/admin/x/", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ids in the request body", () => {
  it("a fine of B cannot be assigned to a rental of A", async () => {
    // B's own letter, not matched to any car: the common case it guards.
    const fine = await prisma.fine.create({
      data: { organisationId: b.organisationId, status: "NEEDS_REVIEW", reviewReason: "PLATE_NOT_IN_FLEET" },
      select: { id: true },
    });
    const before = await snapshot(a);

    const response = await fineAction(post(b.headers, { action: "assign", rentalId: a.rentalId }), {
      params: Promise.resolve({ id: fine.id }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    const after = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(after).toMatchObject({ carId: null, rentalId: null, customerId: null });
    expect(await snapshot(a)).toBe(before);
  });

  it("a fine letter slot of A cannot be registered by B, and A's letter stays", async () => {
    const response = await registerLetter(
      post(b.headers, { documentId: a.fineDocumentId, key: a.fineDocumentKey, sha256: "c".repeat(64) })
    );

    expect(response.status).toBe(404);
    expect(await getAssetStore().get(a.fineDocumentKey)).not.toBeNull();
  });
});

describe("per-company uniques", () => {
  it("B may register a car with A's plate; the new car is B's", async () => {
    const response = await createCar(post(b.headers, { model: "VW Golf", plate: a.plate }));

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const car = await prisma.car.findUniqueOrThrow({ where: { id } });
    expect(car.organisationId).toBe(b.organisationId);
  });

  it("B may not take a username A already uses, so sign-in stays unambiguous", async () => {
    const response = await createUser(
      post(b.headers, { username: "owner-a", displayName: "Copy", password: "Winter2026!!", role: "staff" })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "username-taken" });
  });
});
