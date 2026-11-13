import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getAssetStore, type MemoryStore } from "@/lib/storage";
import { GET as list } from "@/app/api/admin/fines/route";
import { DELETE as remove } from "@/app/api/admin/fines/documents/[id]/route";
import { POST as slot } from "@/app/api/admin/fines/uploads/route";
import { adminCookie, seedOrganisation } from "./fineHelpers";

/**
 * Deleting an uploaded letter so the same scan can go in again — and only
 * while nobody outside the office has heard of it. Prompted by the
 * Stadtpolizei Zürich letter of 13.11.2026, whose first reading went wrong
 * and whose second upload was refused as a duplicate.
 */

const store = getAssetStore() as MemoryStore;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const SHA = "a".repeat(64);
const KEY = "fines/doc-a/letter-000000000000000a.pdf";

function del(id: string, cookie?: string) {
  return remove(
    new Request(`https://www.zuriauto.ch/api/admin/fines/documents/${id}/`, {
      method: "DELETE",
      headers: cookie ? { cookie } : {},
    }),
    params(id)
  );
}

async function letter(organisationId: string, data: Record<string, unknown> = {}) {
  await store.put(KEY, new Uint8Array([37, 80, 68, 70]), "application/pdf");
  return prisma.fineDocument.create({
    data: {
      organisationId,
      storageKey: KEY,
      sha256: SHA,
      bytes: 4,
      pages: 1,
      uploadedById: "u1",
      uploadedByName: "Eng Ahmed",
      ...data,
    },
  });
}

/** A letter read into a fine waiting in review, with its creation event. */
async function letterWithFine(organisationId: string, fine: Record<string, unknown> = {}) {
  const created = await prisma.fine.create({
    data: {
      organisationId,
      issuerName: "Stadtpolizei Zürich",
      issuerKind: "POLICE",
      amountCents: 8000,
      status: "NEEDS_REVIEW",
      reviewReason: "FIELDS_DOUBTFUL",
      ...fine,
    },
  });
  await prisma.fineEvent.create({ data: { fineId: created.id, type: "fine.created", payload: { reviewReason: "FIELDS_DOUBTFUL" } } });
  const document = await letter(organisationId, { status: "PROCESSED", fineId: created.id });
  return { fine: created, document };
}

async function slotFor(cookie: string) {
  return slot(
    new Request("https://www.zuriauto.ch/api/admin/fines/uploads/", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ sha256: SHA, bytes: 4 }),
    })
  );
}

beforeEach(() => {
  store.objects.clear();
});

describe("DELETE /api/admin/fines/documents/[id]", () => {
  it("is for the office only", async () => {
    const org = await seedOrganisation();
    const document = await letter(org.id, { status: "FAILED" });
    expect((await del(document.id)).status).toBe(401);
    expect(await prisma.fineDocument.count()).toBe(1);
  });

  it("deletes a letter that failed, and the same scan can then be uploaded again", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const document = await letter(org.id, { status: "FAILED", attempts: 3, error: "boom" });
    expect((await slotFor(cookie)).status).toBe(409);

    const response = await del(document.id, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fineDeleted: false });
    expect(await prisma.fineDocument.count()).toBe(0);
    expect(store.objects.has(KEY)).toBe(false);
    expect((await slotFor(cookie)).status).toBe(200);
  });

  it("deletes a reading that died long ago, and refuses one in progress", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const document = await letter(org.id, { status: "PROCESSING", claimedAt: new Date(), attempts: 1 });

    const busy = await del(document.id, cookie);
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ code: "letter-busy" });
    expect(await prisma.fineDocument.count()).toBe(1);

    await prisma.fineDocument.update({
      where: { id: document.id },
      data: { claimedAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
    expect((await del(document.id, cookie)).status).toBe(200);
    expect(await prisma.fineDocument.count()).toBe(0);
  });

  it("deletes a letter read into a fine nobody has heard of, with the fine", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const { fine, document } = await letterWithFine(org.id);
    // A send that failed leaves an unsent row; that is still nothing sent.
    await prisma.fineNotification.create({
      data: { fineId: fine.id, kind: "DRIVER_NOMINATION", dedupeKey: "nomination", to: "x@example.ch", error: "bounced" },
    });
    // And the office's own alert about it went out; only the office saw that.
    await prisma.fineNotification.create({
      data: { fineId: fine.id, kind: "OFFICE_ALERT", dedupeKey: "review", to: "office@zuriauto.ch", sentAt: new Date() },
    });

    const response = await del(document.id, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fineDeleted: true });
    expect(await prisma.fine.count()).toBe(0);
    expect(await prisma.fineEvent.count()).toBe(0);
    expect(await prisma.fineNotification.count()).toBe(0);
    expect(await prisma.fineDocument.count()).toBe(0);
    expect(store.objects.has(KEY)).toBe(false);
    expect((await slotFor(cookie)).status).toBe(200);
  });

  it.each([
    ["sent to the renter", { status: "NOTIFIED", reviewReason: null, notifiedAt: new Date() }],
    ["named to the police", { status: "DRIVER_NAMED", reviewReason: null, driverNamedAt: new Date() }],
    ["paid", { status: "PAID", reviewReason: null, paidAt: new Date() }],
  ])("keeps a fine already %s", async (_what, state) => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const { document } = await letterWithFine(org.id, state);

    const response = await del(document.id, cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "letter-has-history" });
    expect(await prisma.fine.count()).toBe(1);
    expect(await prisma.fineDocument.count()).toBe(1);
    expect(store.objects.has(KEY)).toBe(true);
  });

  it("keeps a fine in review that has already sent an email", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const { fine, document } = await letterWithFine(org.id, { reviewReason: "MAIL_FAILED" });
    await prisma.fineNotification.create({
      data: { fineId: fine.id, kind: "RENTER_NAMED", dedupeKey: "named", to: "glenn@example.ch", sentAt: new Date() },
    });
    expect((await del(document.id, cookie)).status).toBe(409);
    expect(await prisma.fine.count()).toBe(1);
  });

  it("keeps a fine that has a second letter on it", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const { fine, document } = await letterWithFine(org.id);
    await prisma.fineDocument.create({
      data: {
        organisationId: org.id, storageKey: "fines/doc-b/letter.pdf", sha256: "b".repeat(64), bytes: 1, pages: 1,
        uploadedById: "u1", uploadedByName: "Eng Ahmed", status: "PROCESSED", kind: "REMINDER", fineId: fine.id,
      },
    });
    expect((await del(document.id, cookie)).status).toBe(409);
    expect(await prisma.fineDocument.count()).toBe(2);
  });

  it("answers not-found for a letter that is not there", async () => {
    await seedOrganisation();
    const response = await del("nope", await adminCookie());
    expect(response.status).toBe(404);
  });
});

describe("a letter read but never attached to a fine", () => {
  it("is listed with the letters in progress, where it can be deleted", async () => {
    const org = await seedOrganisation();
    const cookie = await adminCookie();
    const document = await letter(org.id, { status: "PROCESSED", processedAt: new Date() });
    const body = await (
      await list(new Request("https://www.zuriauto.ch/api/admin/fines/?tab=all", { headers: { cookie } }))
    ).json();
    expect(body.documents.map((d: { id: string }) => d.id)).toEqual([document.id]);
    expect(body.documents[0].status).toBe("PROCESSED");
  });
});
