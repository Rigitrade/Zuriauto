import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  CAR_LICENCE_MAX_BYTES,
  carLicenceExtension,
  normaliseCarLicenceType,
  refuseCarLicence,
} from "@/lib/admin/carLicence";
import { requireAdmin } from "@/lib/admin/session";
import { carLicenceKey, getAssetStore } from "@/lib/storage";

/**
 * A car's vehicle registration document (Fahrzeugausweis): reading it,
 * replacing it, and removing it.
 *
 * Three verbs on one route, unlike the photograph, which needs no GET of its
 * own — that one is public and is served by `/api/cars/[slug]/photo/` to
 * anybody, including the customer filling in the pickup form. This document is
 * not. It states the holder, the first registration and the weights, which
 * makes it the paperwork half of stealing a car, so every verb here sits
 * behind `requireAdmin` and the bytes are streamed through the handler rather
 * than handed out as a presigned URL.
 *
 * Not logged in `AssetAccess`, which is the one place this deliberately
 * diverges from `/api/admin/assets/[id]/`. That table exists to say who looked
 * at a named person's passport; this is a document about a company vehicle,
 * with no data subject to owe an account to. Logging it would bury the reads
 * that matter under the fleet screen's own thumbnails.
 *
 * Replacing writes the new object and then deletes the old one, in that order,
 * for the reason the photograph's endpoint gives: the reverse leaves a window
 * where the row points at bytes that are already gone.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { licenceKey: true, licenceContentType: true },
  });

  if (!car?.licenceKey) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const object = await getAssetStore().get(car.licenceKey);
  if (!object) {
    // The row outlived its object — a bucket restored from an older snapshot,
    // or a removal that half succeeded. Worth a log line: the database and the
    // bucket disagree.
    console.error(
      `[admin] car ${id} points at a registration document that is not in the store`
    );
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  return new NextResponse(Buffer.from(object.body), {
    headers: {
      "content-type": car.licenceContentType ?? object.contentType,
      // Inline, so the office opens it in a tab rather than accumulating
      // copies of every car's papers in Downloads.
      "content-disposition": "inline",
      /**
       * Not cached anywhere shared, and not written to disk.
       *
       * `private` rather than the photograph's year-long immutable cache. That
       * one is a picture of a car and is deliberately cached by every proxy
       * between here and the desk; this one should live no longer than the
       * session that asked for it.
       */
      "cache-control": "private, no-store",
      // A PDF is served from this origin, so the browser must not be free to
      // decide it is something more interesting than what it was told.
      "x-content-type-options": "nosniff",
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, licenceKey: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = new Uint8Array(await request.arrayBuffer());

  // Checked against the bytes actually received, never against the
  // `Content-Length` header: a header is a claim, and the body is the fact.
  const refusal = refuseCarLicence({ contentType, bytes: body.byteLength });
  if (refusal) {
    return NextResponse.json(
      { code: refusal, maxBytes: CAR_LICENCE_MAX_BYTES },
      { status: refusal === "too-large" ? 413 : 415 }
    );
  }

  const type = normaliseCarLicenceType(contentType);
  const key = carLicenceKey(car.id, carLicenceExtension(type));
  const store = getAssetStore();

  try {
    await store.put(key, body, type);
  } catch (error) {
    console.error("[admin] could not store the registration document:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }

  const updated = await prisma.car.update({
    where: { id: car.id },
    data: {
      licenceKey: key,
      licenceContentType: type,
      licenceUpdatedAt: new Date(),
    },
    select: { id: true, licenceUpdatedAt: true },
  });

  // The old object, once the row no longer points at it. Not fatal, for the
  // reason the photograph's endpoint gives: an orphan costs a fraction of a
  // cent, and failing here would report a working upload as broken.
  if (car.licenceKey && car.licenceKey !== key) {
    try {
      await store.remove(car.licenceKey);
    } catch (error) {
      console.warn(
        "[admin] the previous registration document could not be removed:",
        error
      );
    }
  }

  return NextResponse.json({
    id: updated.id,
    licenceUpdatedAt: updated.licenceUpdatedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, licenceKey: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  /**
   * The row first, the object second.
   *
   * The opposite order from the photograph's DELETE, and for a reason worth
   * stating: if the object removal fails here the document is already
   * unreachable, which is what was asked for. Removing the bytes first and
   * then failing to clear the row would leave the fleet screen offering a
   * document that 409s — the office would think the removal had not worked and
   * try again.
   */
  await prisma.car.update({
    where: { id: car.id },
    data: {
      licenceKey: null,
      licenceContentType: null,
      licenceUpdatedAt: null,
    },
  });

  if (car.licenceKey) {
    try {
      await getAssetStore().remove(car.licenceKey);
    } catch (error) {
      console.warn(
        "[admin] the registration document object could not be removed:",
        error
      );
    }
  }

  return NextResponse.json({ ok: true });
}
