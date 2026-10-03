import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getAssetStore, type MemoryStore } from "@/lib/storage";
import type { SentMail } from "@/lib/fines/notify";
import { adminCookie, closeAt, seedOrganisation, seedRental } from "./fineHelpers";

/**
 * The office's side: the list, one fine in full, its letter, and every action
 * the dashboard offers. The deps the routes build are swapped for a memory
 * store and a capturing mail sender.
 */

// The app's own store — in tests, the in-memory one — so the file routes
// read what the test wrote.
const store = getAssetStore() as MemoryStore;
const sent: SentMail[] = [];
vi.mock("@/lib/fines/run", async () => {
  const { prisma } = await import("@/lib/db");
  return {
    siteUrl: () => "https://www.zuriauto.ch",
    notifyDeps: (now: Date = new Date()) => ({
      client: prisma,
      store,
      now,
      mail: { host: "h", port: 587, user: "u", pass: "p", from: "office@zuriauto.ch", office: "office@zuriauto.ch" },
      baseUrl: "https://www.zuriauto.ch",
      send: async (_c: unknown, message: SentMail) => {
        sent.push(message);
      },
    }),
    runFineDocument: async () => "skipped",
  };
});

const { GET: list } = await import("@/app/api/admin/fines/route");
const { GET: detail } = await import("@/app/api/admin/fines/[id]/route");
const { POST: act } = await import("@/app/api/admin/fines/[id]/actions/route");
const { GET: letterFile } = await import("@/app/api/admin/fines/documents/[id]/file/route");
const { GET: proofFile } = await import("@/app/api/admin/fines/proofs/[id]/file/route");
const { POST: processAgain } = await import("@/app/api/admin/fines/documents/[id]/process/route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function get(url: string, cookie?: string) {
  return new Request(`https://www.zuriauto.ch${url}`, { headers: cookie ? { cookie } : {} });
}

async function post(url: string, body: unknown, cookie: string) {
  return new Request(`https://www.zuriauto.ch${url}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A fine waiting for the office about our Prius, with its letter. */
async function fineInReview(overrides: Record<string, unknown> = {}) {
  const org = await seedOrganisation();
  const anna = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:10:00Z") });
  await closeAt(org.id, anna, new Date("2026-07-02T09:00:00Z"));
  const luca = await seedRental(org.id, {
    signedAt: new Date("2026-07-02T10:00:00Z"),
    details: { email: "luca@example.ch", firstName: "Luca", lastName: "Brunner" },
  });
  await store.put("fines/d1/letter-0000000000000001.pdf", new Uint8Array([37, 80, 68, 70]), "application/pdf");
  const fine = await prisma.fine.create({
    data: {
      organisationId: org.id,
      issuerName: "Kantonspolizei Zürich",
      fineNumber: "830557506 017 4",
      paymentReference: "001980919800083055750601742",
      amountCents: 4000,
      violationAt: new Date("2026-07-02T08:30:00Z"),
      offenceTextDe: "Überschreiten der Höchstgeschwindigkeit",
      offenceTextEn: "Exceeding the speed limit",
      dueDate: new Date("2026-10-04T00:00:00Z"),
      carId: anna.carId,
      status: "NEEDS_REVIEW",
      reviewReason: "HANDOVER_BOUNDARY",
      ...overrides,
    },
  });
  const document = await prisma.fineDocument.create({
    data: {
      organisationId: org.id,
      storageKey: "fines/d1/letter-0000000000000001.pdf",
      sha256: "1".repeat(64),
      bytes: 4,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
      status: "PROCESSED",
      kind: "NOTICE",
      fineId: fine.id,
    },
  });
  return { org, fine, document, anna, luca, cookie: await adminCookie() };
}

beforeEach(() => {
  sent.length = 0;
  store.objects.clear();
});

describe("GET /api/admin/fines", () => {
  it("lists what is waiting for the office under review", async () => {
    const { fine, cookie } = await fineInReview();
    const body = await (await list(await get("/api/admin/fines/?tab=review", cookie))).json();
    expect(body.fines.map((f: { id: string }) => f.id)).toEqual([fine.id]);
    expect(body.fines[0]).toMatchObject({ plate: "ZH 513 925", reviewReason: "HANDOVER_BOUNDARY", amountCents: 4000 });
  });

  it("keeps sent fines out of review and in open", async () => {
    const { fine, cookie } = await fineInReview({ status: "NOTIFIED", reviewReason: null });
    expect((await (await list(await get("/api/admin/fines/?tab=review", cookie))).json()).fines).toEqual([]);
    const open = await (await list(await get("/api/admin/fines/?tab=open", cookie))).json();
    expect(open.fines.map((f: { id: string }) => f.id)).toEqual([fine.id]);
  });

  it("lists letters that failed to process under review", async () => {
    const { org, cookie } = await fineInReview();
    await prisma.fineDocument.create({
      data: {
        organisationId: org.id, storageKey: "fines/d2/letter.pdf", sha256: "2".repeat(64), bytes: 1, pages: 1,
        uploadedById: "u1", uploadedByName: "Eng Ahmed", status: "FAILED", attempts: 3, error: "tesseract crashed",
      },
    });
    const body = await (await list(await get("/api/admin/fines/?tab=review", cookie))).json();
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0]).toMatchObject({ status: "FAILED", error: "tesseract crashed" });
  });

  it("counts how many recent letters went through without review", async () => {
    const { fine, cookie } = await fineInReview();
    await prisma.fineEvent.createMany({
      data: [
        { fineId: fine.id, type: "fine.created", payload: { reviewReason: null } },
        { fineId: fine.id, type: "fine.created", payload: { reviewReason: "PLATE_NOT_IN_FLEET" } },
      ],
    });
    const body = await (await list(await get("/api/admin/fines/?tab=all", cookie))).json();
    expect(body.stats).toEqual({ last30: 2, auto: 1 });
  });

  it("answers nobody who is not signed in", async () => {
    expect((await list(await get("/api/admin/fines/"))).status).toBe(401);
  });
});

describe("GET /api/admin/fines/[id]", () => {
  it("shows the fine, its letters, and both renters around a handover", async () => {
    const { fine, document, anna, luca, cookie } = await fineInReview();
    const body = await (await detail(await get(`/api/admin/fines/${fine.id}/`, cookie), params(fine.id))).json();
    expect(body.fine.id).toBe(fine.id);
    expect(body.documents.map((d: { id: string }) => d.id)).toEqual([document.id]);
    expect(body.candidates.map((c: { rentalId: string }) => c.rentalId)).toEqual([anna.id, luca.id]);
    expect(body.candidates[0]).toMatchObject({ renterName: "Anna Meier", email: "anna@example.ch" });
  });
});

describe("the letter and the proof, opened", () => {
  it("serves the letter inline and records who opened it", async () => {
    const { document, cookie } = await fineInReview();
    const response = await letterFile(await get(`/api/admin/fines/documents/${document.id}/file/`, cookie), params(document.id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await prisma.assetAccess.findFirst({ where: { fineDocumentId: document.id } })).toMatchObject({
      username: "ahmed",
    });
  });

  it("serves a proof and records who opened it", async () => {
    const { fine, cookie } = await fineInReview();
    await store.put("fines/f/proof-1.jpg", new Uint8Array([1, 2]), "image/jpeg");
    const proof = await prisma.finePaymentProof.create({
      data: { fineId: fine.id, storageKey: "fines/f/proof-1.jpg", contentType: "image/jpeg", bytes: 2, verdict: "MISMATCH" },
    });
    const response = await proofFile(await get(`/api/admin/fines/proofs/${proof.id}/file/`, cookie), params(proof.id));
    expect(response.status).toBe(200);
    expect(await prisma.assetAccess.count({ where: { finePaymentProofId: proof.id } })).toBe(1);
  });

  it("refuses both to somebody not signed in", async () => {
    const { document } = await fineInReview();
    expect((await letterFile(await get(`/api/admin/fines/documents/${document.id}/file/`), params(document.id))).status).toBe(401);
  });
});

describe("POST /api/admin/fines/[id]/actions", () => {
  it("assigns the fine to the renter the office chose, and sends it", async () => {
    const { fine, anna, cookie } = await fineInReview();

    const assigned = await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "assign", rentalId: anna.id }, cookie), params(fine.id));
    expect(assigned.status).toBe(200);
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({
      rentalId: anna.id,
      customerId: anna.customerId,
      reviewReason: null,
      status: "NEEDS_REVIEW",
    });

    const sentResponse = await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "send" }, cookie), params(fine.id));
    expect(sentResponse.status).toBe(200);
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("NOTIFIED");
    expect(sent.map((m) => m.to)).toEqual(["anna@example.ch"]);

    const events = await prisma.fineEvent.findMany({ where: { fineId: fine.id }, orderBy: { createdAt: "asc" } });
    expect(events.find((e) => e.type === "office.assign")).toMatchObject({ actorName: "Eng Ahmed" });
  });

  it("refuses a rental of another car", async () => {
    const { org, fine, cookie } = await fineInReview();
    const other = await seedRental(org.id, {
      signedAt: new Date("2026-06-01T08:00:00Z"),
      details: { vehicleId: "octavia-zh886530", email: "o@example.ch" },
    });
    const response = await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "assign", rentalId: other.id }, cookie), params(fine.id));
    expect(response.status).toBe(409);
  });

  it("refuses to send a fine with no renter", async () => {
    const { fine, cookie } = await fineInReview();
    const response = await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "send" }, cookie), params(fine.id));
    expect(response.status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("sends again after a failed delivery", async () => {
    const { fine, anna, cookie } = await fineInReview({ reviewReason: "MAIL_FAILED" });
    await prisma.fine.update({ where: { id: fine.id }, data: { rentalId: anna.id, customerId: anna.customerId } });
    await prisma.fineNotification.create({
      data: { fineId: fine.id, kind: "FINE_NOTICE", dedupeKey: "notice", to: "anna@example.ch", error: "mailbox unavailable" },
    });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "send" }, cookie), params(fine.id));
    expect(sent.map((m) => m.to)).toEqual(["anna@example.ch"]);
  });

  it("corrects the moment and re-runs the matching", async () => {
    const { fine, anna, cookie } = await fineInReview();
    // 06:30 UTC is 08:30 Zurich, well inside Anna's rental.
    const response = await act(
      await post(`/api/admin/fines/${fine.id}/actions/`, { action: "correct", field: "violationAt", value: "2026-06-20T08:30" }, cookie),
      params(fine.id)
    );
    expect(response.status).toBe(200);
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({
      violationAt: new Date("2026-06-20T06:30:00Z"),
      rentalId: anna.id,
      reviewReason: null,
    });
  });

  it("refuses a correction that is not a value", async () => {
    const { fine, cookie } = await fineInReview();
    const response = await act(
      await post(`/api/admin/fines/${fine.id}/actions/`, { action: "correct", field: "violationAt", value: "yesterday" }, cookie),
      params(fine.id)
    );
    expect(response.status).toBe(400);
  });

  it("marks a fine paid by the office's word, and stops the link", async () => {
    const { fine, cookie } = await fineInReview({ status: "NOTIFIED", reviewReason: null });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "markPaid" }, cookie), params(fine.id));
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({ status: "PAID", paidVia: "OFFICE" });
  });

  it("accepts a proof the system could not read", async () => {
    const { fine, anna, cookie } = await fineInReview({ status: "PROOF_SUBMITTED", reviewReason: null });
    await prisma.fine.update({ where: { id: fine.id }, data: { rentalId: anna.id, customerId: anna.customerId } });
    const proof = await prisma.finePaymentProof.create({
      data: { fineId: fine.id, storageKey: "fines/f/p.jpg", contentType: "image/jpeg", bytes: 1, verdict: "MISMATCH" },
    });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "acceptProof", proofId: proof.id }, cookie), params(fine.id));
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({
      status: "PAID",
      paidVia: "PROOF_CHECKED_BY_OFFICE",
    });
    expect(await prisma.finePaymentProof.findUniqueOrThrow({ where: { id: proof.id } })).toMatchObject({ accepted: true });
  });

  it("rejects a proof and leaves the fine waiting for payment", async () => {
    const { fine, cookie } = await fineInReview({ status: "PROOF_SUBMITTED", reviewReason: null });
    const proof = await prisma.finePaymentProof.create({
      data: { fineId: fine.id, storageKey: "fines/f/p.jpg", contentType: "image/jpeg", bytes: 1, verdict: "MISMATCH" },
    });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "rejectProof", proofId: proof.id }, cookie), params(fine.id));
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("NOTIFIED");
  });

  it("closes, voids and reopens with a note", async () => {
    const { fine, cookie } = await fineInReview();
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "close", note: "Fahrer der Polizei gemeldet" }, cookie), params(fine.id));
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({
      status: "HANDLED_OTHERWISE",
      closedNote: "Fahrer der Polizei gemeldet",
    });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "reopen" }, cookie), params(fine.id));
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("NEEDS_REVIEW");
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "void", note: "doppelt" }, cookie), params(fine.id));
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("VOID");
  });

  it("records the handling fee as paid or waived", async () => {
    const { fine, cookie } = await fineInReview({ handlingFeeCents: 2000, handlingFeeStatus: "DUE" });
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "feePaid" }, cookie), params(fine.id));
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).handlingFeeStatus).toBe("PAID");
    await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "feeWaived" }, cookie), params(fine.id));
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).handlingFeeStatus).toBe("WAIVED");
  });

  it("refuses an action it does not know", async () => {
    const { fine, cookie } = await fineInReview();
    expect((await act(await post(`/api/admin/fines/${fine.id}/actions/`, { action: "explode" }, cookie), params(fine.id))).status).toBe(400);
  });
});

describe("POST /api/admin/fines/documents/[id]/process", () => {
  it("gives a failed letter its attempts back", async () => {
    const { org, cookie } = await fineInReview();
    const failed = await prisma.fineDocument.create({
      data: {
        organisationId: org.id, storageKey: "fines/d3/letter.pdf", sha256: "3".repeat(64), bytes: 1, pages: 1,
        uploadedById: "u1", uploadedByName: "Eng Ahmed", status: "FAILED", attempts: 3,
      },
    });
    const response = await processAgain(await post(`/api/admin/fines/documents/${failed.id}/process/`, {}, cookie), params(failed.id));
    expect(response.status).toBe(202);
    expect(await prisma.fineDocument.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ status: "FAILED", attempts: 0 });
  });
});

describe("fineAttentionCounts", () => {
  it("counts fines in review, proofs to check, and sent fines past their deadline", async () => {
    const { fineAttentionCounts } = await import("@/lib/fines/queries");
    const { org, fine } = await fineInReview();
    const base = { organisationId: org.id, amountCents: 1000 };
    await prisma.fine.createMany({
      data: [
        { ...base, status: "PROOF_SUBMITTED" },
        { ...base, status: "NOTIFIED", dueDate: new Date("2026-09-01T00:00:00Z") },
        { ...base, status: "NOTIFIED", dueDate: new Date("2026-12-01T00:00:00Z") },
        { ...base, status: "PAID", dueDate: new Date("2026-09-01T00:00:00Z") },
      ],
    });
    await prisma.fineDocument.create({
      data: {
        organisationId: org.id, storageKey: "fines/d9/letter.pdf", sha256: "9".repeat(64), bytes: 1, pages: 1,
        uploadedById: "u1", uploadedByName: "Eng Ahmed", status: "FAILED", attempts: 3,
      },
    });
    expect(fine.status).toBe("NEEDS_REVIEW");
    expect(await fineAttentionCounts(prisma, new Date("2026-10-03T12:00:00Z"))).toEqual({
      // The fine in review, and the letter that failed for good.
      review: 2,
      proof: 1,
      overdue: 1,
    });
  });
});
