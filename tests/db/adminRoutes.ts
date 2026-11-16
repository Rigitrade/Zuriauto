import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CompanyFixture } from "./companyFixture";

/**
 * Every office route with one request each, shared by the wall test between
 * companies (phase A) and the read-only view test (phase D). A new route
 * without a case here fails both, so neither can forget it.
 */

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type Method = (typeof METHODS)[number];

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

export interface Case {
  params?: (a: CompanyFixture) => Record<string, string | string[]>;
  body?: (a: CompanyFixture) => unknown;
  /** Raw bytes instead of JSON, for the upload endpoints. */
  raw?: { bytes: Uint8Array; contentType: string };
}

/** Keyed by the route file relative to app/api/admin, then the method. */
export const CASES: Record<string, Partial<Record<Method, Case>>> = {
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
  "company": { GET: {}, PATCH: { body: () => ({ phone: "+41 00 000 00 00" }) } },
  // ZURIAUTO's owner only (A is the oldest, so the site company here).
  "partners": {
    GET: {},
    POST: {
      body: () => ({
        brandName: "X CARS", legalName: "X GmbH", slug: "x-cars", officeEmail: "office@x.ch",
        owner: { displayName: "X", username: "x-owner", password: "lang-genug-123" },
      }),
    },
  },
  // ZURIAUTO's owner only (phase D): a's own id is the site company, which is
  // refused (403), never "not found" — the control call below relies on that.
  "partners/[id]": {
    PATCH: { params: (a) => ({ id: a.organisationId }), body: () => ({ brandName: "Renamed" }) },
  },
  // The read-only view of a partner (phase D): starting it is ZURIAUTO's
  // owner's alone; leaving it only clears a cookie.
  "view": {
    POST: { body: (a) => ({ organisationId: a.organisationId }) },
    DELETE: {},
  },
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
export function discoverRoutes(): { route: string; method: Method; file: string }[] {
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

export const ROUTES = discoverRoutes();

export function requestFor(
  c: Case,
  method: Method,
  owner: CompanyFixture,
  target: CompanyFixture,
  extraCookie?: string
): Request {
  const headers: Record<string, string> = { ...owner.headers, origin: "https://zuriauto.ch" };
  if (extraCookie) headers.cookie = `${headers.cookie}; ${extraCookie}`;
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

export async function call(
  route: { file: string; method: Method },
  c: Case,
  as: CompanyFixture,
  target: CompanyFixture,
  extraCookie?: string
) {
  const mod = (await import(/* @vite-ignore */ route.file)) as Record<string, unknown>;
  const handler = mod[route.method] as (req: Request, ctx: unknown) => Promise<Response>;
  const params = c.params ? c.params(target) : {};
  const response = await handler(requestFor(c, route.method, as, target, extraCookie), {
    params: Promise.resolve(params),
  });
  const text = await response.text();
  return { status: response.status, text };
}
