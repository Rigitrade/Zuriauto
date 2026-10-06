import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { sweepExpiredFineFiles } from "@/lib/fines/retention";
import { createMemoryStore } from "@/lib/storage";
import { seedOrganisation } from "./fineHelpers";

/**
 * Fines under docs/DATA-RETENTION.md: a payment screenshot can show the
 * renter's bank and goes after five years; the letter and the fine record —
 * the basis of the GTC fee, a commercial record — after ten. Both clocks run
 * from when the fine was closed. An open fine is never touched.
 */

const NOW = new Date("2037-01-01T00:00:00Z");

async function closedFine(organisationId: string, store: ReturnType<typeof createMemoryStore>, paidAt: Date, n: number) {
  const fine = await prisma.fine.create({
    data: { organisationId, status: "PAID", paidAt, paidVia: "OFFICE", fineNumber: `f-${n}`, issuerIban: "CH24" },
  });
  const letterKey = `fines/d${n}/letter-${String(n).padStart(16, "0")}.pdf`;
  await store.put(letterKey, new Uint8Array([1]), "application/pdf");
  await prisma.fineDocument.create({
    data: {
      organisationId, storageKey: letterKey, sha256: String(n).padStart(64, "0"), bytes: 1, pages: 1,
      uploadedById: "u", uploadedByName: "U", status: "PROCESSED", fineId: fine.id,
    },
  });
  const proofKey = `fines/${fine.id}/proof-${String(n).padStart(16, "0")}.jpg`;
  await store.put(proofKey, new Uint8Array([2]), "image/jpeg");
  await prisma.finePaymentProof.create({
    data: { fineId: fine.id, storageKey: proofKey, contentType: "image/jpeg", bytes: 1, verdict: "MATCH" },
  });
  await prisma.fineEvent.create({ data: { fineId: fine.id, type: "fine.created" } });
  return { fine, letterKey, proofKey };
}

describe("sweepExpiredFineFiles", () => {
  it("removes a closed fine's payment screenshot after five years, keeping the letter", async () => {
    const org = await seedOrganisation();
    const store = createMemoryStore();
    const six = await closedFine(org.id, store, new Date("2031-01-01T00:00:00Z"), 1);

    const result = await sweepExpiredFineFiles(prisma, store, NOW);

    expect(result).toMatchObject({ proofsDeleted: 1, finesDeleted: 0 });
    expect(store.objects.has(six.proofKey)).toBe(false);
    expect(await prisma.finePaymentProof.count({ where: { fineId: six.fine.id } })).toBe(0);
    expect(store.objects.has(six.letterKey)).toBe(true);
    expect(await prisma.fine.count({ where: { id: six.fine.id } })).toBe(1);
  });

  it("removes the letter and the fine record after ten years", async () => {
    const org = await seedOrganisation();
    const store = createMemoryStore();
    const eleven = await closedFine(org.id, store, new Date("2026-01-01T00:00:00Z"), 2);

    const result = await sweepExpiredFineFiles(prisma, store, NOW);

    expect(result).toMatchObject({ finesDeleted: 1 });
    expect(store.objects.has(eleven.letterKey)).toBe(false);
    expect(await prisma.fine.count()).toBe(0);
    expect(await prisma.fineDocument.count()).toBe(0);
    expect(await prisma.fineEvent.count()).toBe(0);
  });

  it("never touches a fine that is still open, however old", async () => {
    const org = await seedOrganisation();
    const store = createMemoryStore();
    const old = await closedFine(org.id, store, new Date("2020-01-01T00:00:00Z"), 3);
    await prisma.fine.update({ where: { id: old.fine.id }, data: { status: "NOTIFIED", paidAt: null } });

    expect(await sweepExpiredFineFiles(prisma, store, NOW)).toMatchObject({ proofsDeleted: 0, finesDeleted: 0 });
    expect(store.objects.has(old.proofKey)).toBe(true);
  });
});
