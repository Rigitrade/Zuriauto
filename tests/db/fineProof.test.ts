import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { notifyRenter, type NotifyDeps, type SentMail } from "@/lib/fines/notify";
import { submitProof } from "@/lib/fines/proofSubmit";
import { createMemoryStore } from "@/lib/storage";
import { processFineDocument } from "@/lib/fines/process";
import { FINE_NOW, fakeReader, letterDocument, priusLetter, seedOrganisation, seedRental } from "./fineHelpers";

/** What the OCR reads off whatever screenshot the test submits. */
let screenshotText = "";
vi.mock("@/lib/fines/proofOcr", () => ({
  readProofText: async () => screenshotText,
}));
const { POST } = await import("@/app/api/fines/proof/route");

const MAIL = { host: "h", port: 587, user: "u", pass: "p", from: "office@zuriauto.ch", office: "office@zuriauto.ch" };
const PAID_SCREENSHOT = "TWINT Zahlung erfolgreich CHF 40.00 Referenz 00 19809 19800 08305 57506 01742";

async function notifiedFine() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:10:00Z") });
  const store = createMemoryStore();
  const fine = await prisma.fine.create({
    data: {
      organisationId: org.id,
      issuerName: "Kantonspolizei Zürich",
      fineNumber: "830557506 017 4",
      paymentReference: "001980919800083055750601742",
      amountCents: 4000,
      violationAt: new Date("2026-07-02T08:00:00Z"),
      offenceTextDe: "Überschreiten der Höchstgeschwindigkeit",
      offenceTextEn: "Exceeding the speed limit",
      dueDate: new Date("2026-10-04T00:00:00Z"),
      carId: rental.carId,
      rentalId: rental.id,
      customerId: rental.customerId,
      status: "NEEDS_REVIEW",
    },
  });
  const sent: SentMail[] = [];
  const deps: NotifyDeps = {
    client: prisma,
    store,
    now: FINE_NOW,
    mail: MAIL,
    baseUrl: "https://www.zuriauto.ch",
    send: async (_c, message) => {
      sent.push(message);
    },
  };
  await notifyRenter(deps, fine.id, "notice");
  const token = /\?t=([A-Za-z0-9_-]+)/.exec(sent[0].text)![1];
  return { fine, deps, sent, token, store };
}

const IMAGE = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), contentType: "image/jpeg" };

describe("submitProof", () => {
  beforeEach(() => {
    screenshotText = PAID_SCREENSHOT;
  });

  it("marks a fine paid on a screenshot showing its amount and reference, and thanks the renter", async () => {
    const { fine, deps, sent, token, store } = await notifiedFine();

    const result = await submitProof(deps, { token, ...IMAGE, paidOn: "2026-09-05" }, async () => PAID_SCREENSHOT);

    expect(result).toEqual({ ok: true, verdict: "MATCH" });
    const updated = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(updated).toMatchObject({ status: "PAID", paidVia: "PROOF_VERIFIED", paidAt: FINE_NOW });
    const proof = await prisma.finePaymentProof.findFirstOrThrow({ where: { fineId: fine.id } });
    expect(proof).toMatchObject({ verdict: "MATCH", contentType: "image/jpeg", bytes: 6 });
    expect(proof.paidOn?.toISOString().slice(0, 10)).toBe("2026-09-05");
    expect(store.objects.has(proof.storageKey)).toBe(true);
    expect(sent.at(-1)?.subject).toMatch(/^Zahlung bestätigt/);
  });

  it("leaves a screenshot it cannot match for the office, and the link working", async () => {
    const { fine, deps, sent, token } = await notifiedFine();

    const result = await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => "CHF 40.00 an Migros");

    expect(result).toEqual({ ok: true, verdict: "MISMATCH" });
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("PROOF_SUBMITTED");
    expect(sent.at(-1)?.to).toBe("office@zuriauto.ch");
    // Retryable: a second, better screenshot through the same link.
    expect(await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT)).toEqual({
      ok: true,
      verdict: "MATCH",
    });
  });

  it("refuses the link once the fine is paid", async () => {
    const { deps, token } = await notifiedFine();
    await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT);

    expect(await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT)).toEqual({
      ok: false,
      code: "link-unusable",
    });
    expect(await prisma.finePaymentProof.count()).toBe(1);
  });

  it("refuses the link sent before a Mahnung reopened the fine", async () => {
    const { fine, deps, token, store } = await notifiedFine();
    await prisma.fine.update({ where: { id: fine.id }, data: { status: "PAID", paidAt: FINE_NOW, paidVia: "OFFICE" } });
    // The Mahnung arrives and is processed the real way: it matches the fine
    // by its payment reference and reopens it.
    const document = await letterDocument(fine.organisationId, store, 0);
    await processFineDocument(
      {
        client: prisma,
        store,
        reader: fakeReader([priusLetter("reminder")]),
        now: FINE_NOW,
        notify: async (fineId, reason) => {
          await notifyRenter(deps, fineId, reason);
        },
      },
      document.id
    );
    expect((await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).reviewReason).toBe("REMINDER_AFTER_PAID");

    expect((await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT)).ok).toBe(false);
  });

  it("refuses an expired link", async () => {
    const { deps, token } = await notifiedFine();
    const later = { ...deps, now: new Date("2027-01-01T00:00:00Z") };
    expect((await submitProof(later, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT)).ok).toBe(false);
  });
});

function form(fields: Record<string, string | Blob>, origin?: string) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return new Request("https://www.zuriauto.ch/api/fines/proof/", {
    method: "POST",
    headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...(origin ? { origin } : {}) },
    body,
  });
}

describe("POST /api/fines/proof", () => {
  beforeEach(() => {
    screenshotText = PAID_SCREENSHOT;
    process.env.RATE_LIMIT_SALT = "test-salt";
  });

  it("accepts a screenshot through the link", async () => {
    const { token } = await notifiedFine();
    const response = await POST(form({ token, file: new File([IMAGE.bytes], "s.jpg", { type: "image/jpeg" }), company: "" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verdict: "MATCH" });
  });

  it("answers a dead link with one code", async () => {
    await notifiedFine();
    const response = await POST(form({ token: "nonsense", file: new File([IMAGE.bytes], "s.jpg", { type: "image/jpeg" }) }));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ code: "link-unusable" });
  });

  it("refuses a cross-site post", async () => {
    const { token } = await notifiedFine();
    const response = await POST(
      form({ token, file: new File([IMAGE.bytes], "s.jpg", { type: "image/jpeg" }) }, "https://evil.example")
    );
    expect(response.status).toBe(403);
  });

  it("refuses a file too large or of the wrong kind", async () => {
    const { token } = await notifiedFine();
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "s.jpg", { type: "image/jpeg" });
    expect((await POST(form({ token, file: big }))).status).toBe(413);
    const html = new File(["<html>"], "s.html", { type: "text/html" });
    expect((await POST(form({ token, file: html }))).status).toBe(415);
  });
});

describe("the link in the reopened mail", () => {
  beforeEach(() => {
    screenshotText = PAID_SCREENSHOT;
  });

  it("works, and puts the proof in front of the office instead of marking it paid", async () => {
    // Review finding: the reopened mail asked for a bank confirmation through
    // a link that opened "this link no longer works".
    const { fine, deps, sent } = await notifiedFine();
    await prisma.fine.update({
      where: { id: fine.id },
      data: { status: "NEEDS_REVIEW", reviewReason: "REMINDER_AFTER_PAID", reminderLevel: 1 },
    });
    await notifyRenter(deps, fine.id, "reopened");
    const reopened = sent.find((m) => m.subject.includes("noch offen"))!;
    const token = /\?t=([A-Za-z0-9_-]+)/.exec(reopened.text)![1];

    const result = await submitProof(deps, { token, ...IMAGE, paidOn: null }, async () => PAID_SCREENSHOT);

    expect(result).toEqual({ ok: true, verdict: "MATCH" });
    // The issuer says unpaid and the renter says paid: a person decides.
    expect(await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } })).toMatchObject({
      status: "PROOF_SUBMITTED",
      paidAt: null,
    });
    expect(sent.at(-1)?.to).toBe("office@zuriauto.ch");
  });
});
