import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildCompany, snapshot, type CompanyFixture } from "./companyFixture";

/**
 * Multi-company phase A (15.11.2026): company B's staff call every office
 * endpoint with company A's ids, and get nothing of A's back and change
 * nothing of A's. A control call by A's own owner proves each request really
 * reaches A's record, so a "not found" for B is the wall and not a bad test.
 */

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

interface Case {
  params?: (a: CompanyFixture) => Record<string, string | string[]>;
  body?: (a: CompanyFixture) => unknown;
  /** Raw bytes instead of JSON, for the upload endpoints. */
  raw?: { bytes: Uint8Array; contentType: string };
}

/** Keyed by the route file relative to app/api/admin, then the method. */
const CASES: Record<string, Partial<Record<Method, Case>>> = {
  "assets/[id]": { GET: { params: (a) => ({ id: a.assetId }) } },
  "cars/[id]/history": { GET: { params: (a) => ({ id: a.carId }) } },
  "cars/[id]/licence": {
    GET: { params: (a) => ({ id: a.carId }) },
    PUT: { params: (a) => ({ id: a.carId }), raw: { bytes: PDF, contentType: "application/pdf" } },
    DELETE: { params: (a) => ({ id: a.carId }) },
  },
  "cars/[id]/mark-out": {
    POST: {
      params: (a) => ({ id: a.carId }),
      body: () => ({ renterName: "X", startAt: "2026-11-10", endAt: "2026-11-17" }),
    },
  },
  "cars/[id]/photo": {
    PUT: { params: (a) => ({ id: a.carId }), raw: { bytes: JPEG, contentType: "image/jpeg" } },
    DELETE: { params: (a) => ({ id: a.carId }) },
  },
  "cars/[id]/repairs/[repairId]": {
    PATCH: { params: (a) => ({ id: a.carId, repairId: a.repairId }), body: () => ({ details: "Changed" }) },
    DELETE: { params: (a) => ({ id: a.carId, repairId: a.repairId }) },
  },
  "cars/[id]/repairs": {
    POST: { params: (a) => ({ id: a.carId }), body: () => ({ details: "New repair" }) },
  },
  "cars/[id]": {
    PATCH: { params: (a) => ({ id: a.carId }), body: () => ({ currentMileageKm: 123_456 }) },
    DELETE: { params: (a) => ({ id: a.carId }) },
  },
  "cars/order": { PUT: { body: (a) => ({ ids: [a.carId] }) } },
  "cars": { POST: { body: () => ({ model: "VW Golf", plate: "ZH 555555" }) } },
  "charges/[id]/reopen": { POST: { params: (a) => ({ id: a.chargeId }), body: () => ({}) } },
  "charges/[id]/waive": { POST: { params: (a) => ({ id: a.chargeId }), body: () => ({ note: "Goodwill" }) } },
  "contracts/[id]/pdf": { GET: { params: (a) => ({ id: a.contractId }) } },
  "contracts/[id]/resend": { POST: { params: (a) => ({ id: a.contractId }), body: () => ({}) } },
  "fines/[id]/actions": { POST: { params: (a) => ({ id: a.fineId }), body: () => ({ action: "markPaid" }) } },
  "fines/[id]": { GET: { params: (a) => ({ id: a.fineId }) } },
  "fines/documents/[id]/file": { GET: { params: (a) => ({ id: a.fineDocumentId }) } },
  "fines/documents/[id]/process": { POST: { params: (a) => ({ id: a.fineDocumentId }), body: () => ({}) } },
  "fines/documents/[id]": { DELETE: { params: (a) => ({ id: a.fineDocumentId }) } },
  "fines/documents": {
    POST: {
      body: (a) => ({ documentId: a.fineDocumentId, key: a.fineDocumentKey, sha256: "c".repeat(64) }),
    },
  },
  "fines/proofs/[id]/file": { GET: { params: (a) => ({ id: a.proofId }) } },
  "fines": { GET: {} },
  "fines/uploads/local/[...key]": {
    PUT: {
      params: (a) => ({ key: a.fineDocumentKey.split("/") }),
      raw: { bytes: new Uint8Array([1, 2, 3, 4]), contentType: "application/pdf" },
    },
  },
  "fines/uploads": { POST: { body: (a) => ({ sha256: a.label.toLowerCase().repeat(64), bytes: 1000 }) } },
  "overview": { GET: {} },
  "payments/[id]/actions": {
    POST: { params: (a) => ({ id: a.paymentId }), body: () => ({ action: "ignore", note: "Not ours" }) },
  },
  "payments/[id]": { GET: { params: (a) => ({ id: a.paymentId }) } },
  "payments/issues/[id]/resolve": { POST: { params: (a) => ({ id: a.mailIssueId }), body: () => ({}) } },
  "payments/mails/[id]/review": {
    POST: { params: (a) => ({ id: a.notificationId }), body: () => ({ action: "dismiss" }) },
  },
  "payments/mails/release": { POST: { body: () => ({}) } },
  "payments/mails": { GET: {} },
  "payments/owed": { GET: {} },
  "payments": { GET: {} },
  "rentals/[id]/account": { GET: { params: (a) => ({ id: a.rentalId }) } },
  "rentals/[id]/close": { POST: { params: (a) => ({ id: a.rentalId }), body: () => ({}) } },
  "rentals/[id]/documents": { GET: { params: (a) => ({ id: a.rentalId }) } },
  "rentals/[id]/payments": {
    POST: {
      params: (a) => ({ id: a.rentalId }),
      body: () => ({ amountCents: 10_000, paidOn: "2026-11-05", method: "CASH", chargeId: null }),
    },
  },
  "rentals/[id]/period": {
    PATCH: {
      params: (a) => ({ id: a.rentalId }),
      body: () => ({ startAt: "2026-11-02T09:00", endAt: "2026-11-09T09:00" }),
    },
  },
  "rentals/[id]/weeks-after-close": {
    POST: { params: (a) => ({ id: a.rentalId }), body: () => ({ choice: "keep" }) },
  },
  "users/[id]": { PATCH: { params: (a) => ({ id: a.ownerId }), body: () => ({ displayName: "Renamed" }) } },
  "users": {
    GET: {},
    POST: {
      body: () => ({ username: "new-staff", displayName: "New", password: "Winter2026!!", role: "staff" }),
    },
  },
};

/** Every office route handler, found by walking the folder. */
function discoverRoutes(): { route: string; method: Method; file: string }[] {
  const root = path.resolve("app/api/admin");
  const found: { route: string; method: Method; file: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "route.ts") {
        const route = path.relative(root, dir).split(path.sep).join("/");
        if (route === "session") continue;
        const source = readFileSync(full, "utf8");
        for (const method of METHODS) {
          if (new RegExp(`export async function ${method}\\b`).test(source)) {
            found.push({ route, method, file: full });
          }
        }
      }
    }
  };
  walk(root);
  return found.sort((x, y) => `${x.route} ${x.method}`.localeCompare(`${y.route} ${y.method}`));
}

const ROUTES = discoverRoutes();

function requestFor(c: Case, method: Method, owner: CompanyFixture, target: CompanyFixture): Request {
  const headers: Record<string, string> = { ...owner.headers, origin: "https://zuriauto.ch" };
  let body: BodyInit | undefined;
  if (c.raw) {
    headers["content-type"] = c.raw.contentType;
    body = new Uint8Array(c.raw.bytes);
  } else if (method !== "GET" && method !== "DELETE") {
    headers["content-type"] = "application/json";
    body = JSON.stringify(c.body ? c.body(target) : {});
  }
  return new Request("https://zuriauto.ch/api/admin/x/", { method, headers, body });
}

async function call(route: { file: string; method: Method }, c: Case, as: CompanyFixture, target: CompanyFixture) {
  const mod = (await import(/* @vite-ignore */ route.file)) as Record<string, unknown>;
  const handler = mod[route.method] as (req: Request, ctx: unknown) => Promise<Response>;
  const params = c.params ? c.params(target) : {};
  const response = await handler(requestFor(c, route.method, as, target), {
    params: Promise.resolve(params),
  });
  const text = await response.text();
  return { status: response.status, text };
}

/** Strings that would only appear in a response if A's data leaked. */
function leakMarkers(a: CompanyFixture): string[] {
  return [
    a.plate, a.renterLastName, a.carId, a.customerId, a.rentalId, a.contractId, a.assetId,
    a.chargeId, a.paymentId, a.repairId, a.fineId, a.fineDocumentId, a.proofId,
    a.notificationId, a.mailIssueId, a.ownerId,
  ];
}

describe("company isolation", () => {
  it("covers every office route: no route without a case, no case without a route", () => {
    const discovered = ROUTES.map((r) => `${r.method} ${r.route}`).sort();
    const listed = Object.entries(CASES)
      .flatMap(([route, methods]) => Object.keys(methods).map((m) => `${m} ${route}`))
      .sort();
    expect(listed).toEqual(discovered);
    expect(discovered.length).toBeGreaterThanOrEqual(45);
  });

  let a: CompanyFixture;
  let b: CompanyFixture;
  beforeEach(async () => {
    a = await buildCompany("A");
    b = await buildCompany("B");
  });

  it.each(ROUTES.map((r) => [`${r.method} ${r.route}`, r] as const))(
    "%s: company B gets nothing of A's and changes nothing of A's",
    async (_name, route) => {
      const c = CASES[route.route]?.[route.method];
      expect(c, "a case for this route").toBeDefined();
      const before = await snapshot(a);

      const asB = await call(route, c!, b, a);

      if (c!.params) {
        // Exactly "not found": a 409 or 400 would still say the record exists.
        expect(asB.status, asB.text.slice(0, 300)).toBe(404);
      } else {
        for (const marker of leakMarkers(a)) {
          expect(asB.text.includes(marker), `leaked ${marker}: ${asB.text.slice(0, 300)}`).toBe(false);
        }
      }
      expect(await snapshot(a)).toBe(before);
      expect(await prisma.assetAccess.count({ where: { userId: b.ownerId } })).toBe(0);

      // Control: the same request by A's owner reaches A's record.
      if (c!.params) {
        const asA = await call(route, c!, a, a);
        expect(asA.text.includes('"not-found"'), `control ${asA.status} ${asA.text.slice(0, 200)}`).toBe(false);
      }
    }
  );
});

describe("company isolation: overview counts", () => {
  it("counts only the caller's own fines and payments to review", async () => {
    const a = await buildCompany("A");
    const b = await buildCompany("B");
    // A gets a second fine and payment waiting, so its counts differ from B's.
    await prisma.fine.create({
      data: { organisationId: a.organisationId, status: "NEEDS_REVIEW", reviewReason: "FIELDS_MISSING" },
    });
    await prisma.payment.create({
      data: {
        organisationId: a.organisationId,
        externalId: "twint-a-2",
        amountCents: 100,
        paidAt: new Date("2026-11-03T10:00:00Z"),
        status: "NEEDS_REVIEW",
      },
    });
    const { GET } = await import("@/app/api/admin/overview/route");

    const response = await GET(new Request("https://zuriauto.ch/api/admin/overview/", { headers: b.headers }));
    const body = (await response.json()) as {
      fineAttention: { review: number };
      paymentReview: number;
    };

    expect(body.fineAttention.review).toBe(1);
    // One payment to book plus one unresolved TWINT mail issue, both B's.
    expect(body.paymentReview).toBe(2);
  });
});
