import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/admin/fines/documents/route";
import { PUT as localPut } from "@/app/api/admin/fines/uploads/local/[...key]/route";
import { POST as slot } from "@/app/api/admin/fines/uploads/route";
import { prisma } from "@/lib/db";
import { adminCookie, seedOrganisation } from "./fineHelpers";

/**
 * Upload is three steps — ask for a slot, PUT the file to it, register it —
 * because a scan is too large to pass through a function. In tests the slot
 * is the local route, which writes to the in-memory store.
 */

const LETTER = new Uint8Array(
  readFileSync(join(process.cwd(), "lib/fines/__fixtures__/kapo-zh-mahnung.pdf"))
);

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function json(url: string, body: unknown, cookie?: string) {
  return new Request(`https://zuriauto.ch${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

/** Slot, PUT, and the register request — not yet sent. */
async function uploaded(bytes: Uint8Array, cookie: string) {
  const hash = sha256(bytes);
  const slotResponse = await slot(await json("/api/admin/fines/uploads/", { sha256: hash, bytes: bytes.length }, cookie));
  expect(slotResponse.status).toBe(200);
  const { documentId, key, url } = await slotResponse.json();
  expect(url).toBe(`/api/admin/fines/uploads/local/${key}/`);

  const put = await localPut(
    new Request(`https://zuriauto.ch${url}`, {
      method: "PUT",
      headers: { "content-type": "application/pdf", cookie },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
    }),
    { params: Promise.resolve({ key: key.split("/") }) }
  );
  expect(put.status).toBe(204);
  return { documentId, key, sha256: hash };
}

describe("uploading a fine letter", () => {
  it("registers an uploaded letter for processing", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const { documentId, key, sha256: hash } = await uploaded(LETTER, cookie);

    const response = await register(await json("/api/admin/fines/documents/", { documentId, key, sha256: hash }, cookie));
    expect(response.status).toBe(201);

    const row = await prisma.fineDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(row).toMatchObject({
      storageKey: key,
      sha256: hash,
      pages: 1,
      bytes: LETTER.length,
      status: "UPLOADED",
      uploadedByName: "Eng Ahmed",
    });
  });

  it("refuses a slot for a letter already uploaded, naming it", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const first = await uploaded(LETTER, cookie);
    await register(await json("/api/admin/fines/documents/", first, cookie));

    const again = await slot(await json("/api/admin/fines/uploads/", { sha256: first.sha256, bytes: LETTER.length }, cookie));
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ code: "duplicate", documentId: first.documentId });
  });

  it("registers one of two simultaneous uploads of the same scan", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const a = await uploaded(LETTER, cookie);
    const b = await uploaded(LETTER, cookie);

    const statuses = await Promise.all([
      register(await json("/api/admin/fines/documents/", a, cookie)).then((r) => r.status),
      register(await json("/api/admin/fines/documents/", b, cookie)).then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(await prisma.fineDocument.count()).toBe(1);
  });

  it("refuses something that is not a PDF, and keeps no row", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const fake = new TextEncoder().encode("<html>not a letter</html>".repeat(10));
    const upload = await uploaded(fake, cookie);

    const response = await register(await json("/api/admin/fines/documents/", upload, cookie));
    expect(response.status).toBe(415);
    expect(await prisma.fineDocument.count()).toBe(0);
  });

  it("refuses a file that is not the one the slot was asked for", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const upload = await uploaded(LETTER, cookie);

    const response = await register(
      await json("/api/admin/fines/documents/", { ...upload, sha256: "0".repeat(64) }, cookie)
    );
    expect(response.status).toBe(400);
  });

  it("refuses a key outside the document's own folder", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const upload = await uploaded(LETTER, cookie);

    const response = await register(
      await json("/api/admin/fines/documents/", { ...upload, key: "pickup/x/PORTRAIT-1.jpg" }, cookie)
    );
    expect(response.status).toBe(400);
  });

  it("refuses an oversized slot", async () => {
    await seedOrganisation();
    const cookie = await adminCookie();
    const response = await slot(
      await json("/api/admin/fines/uploads/", { sha256: "a".repeat(64), bytes: 21 * 1024 * 1024 }, cookie)
    );
    expect(response.status).toBe(413);
  });

  it("answers nobody who is not signed in", async () => {
    expect((await slot(await json("/api/admin/fines/uploads/", { sha256: "a".repeat(64), bytes: 10 }))).status).toBe(401);
    expect((await register(await json("/api/admin/fines/documents/", {}))).status).toBe(401);
  });
});
