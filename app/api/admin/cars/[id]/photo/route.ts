import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  CAR_PHOTO_MAX_BYTES,
  carPhotoExtension,
  normaliseCarPhotoType,
  refuseCarPhoto,
} from "@/lib/admin/carPhoto";
import { requireAdmin } from "@/lib/admin/session";
import { carPhotoKey, getAssetStore } from "@/lib/storage";

/**
 * A car's photograph: replacing it, and removing it.
 *
 * The bytes arrive as the raw request body with a `Content-Type` header,
 * rather than as multipart form data. There is exactly one file and no other
 * field, so a multipart envelope would be a parser and a boundary string
 * bought for nothing. The browser compresses before sending — the same
 * `compressImage` the document captures use — so what lands here is a
 * 1600px JPEG, well inside the platform's request limit.
 *
 * Replacing writes a new key and then deletes the old object, in that order.
 * The reverse would leave a window in which the row points at bytes that are
 * already gone, and the fleet screen would show a broken image for whatever
 * time the upload then took.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    select: { id: true, photoKey: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = new Uint8Array(await request.arrayBuffer());

  // Checked against the bytes actually received, never against the
  // `Content-Length` header: a header is a claim, and the body is the fact.
  const refusal = refuseCarPhoto({ contentType, bytes: body.byteLength });
  if (refusal) {
    return NextResponse.json(
      { code: refusal, maxBytes: CAR_PHOTO_MAX_BYTES },
      { status: refusal === "too-large" ? 413 : 415 }
    );
  }

  const type = normaliseCarPhotoType(contentType);
  const key = carPhotoKey(car.id, carPhotoExtension(type));
  const store = getAssetStore();

  try {
    await store.put(key, body, type);
  } catch (error) {
    console.error("[admin] could not store the car photo:", error);
    return NextResponse.json({ code: "failed" }, { status: 500 });
  }

  const updated = await prisma.car.update({
    where: { id: car.id },
    data: {
      photoKey: key,
      photoContentType: type,
      // What the public photo endpoint turns into an ETag, so a replaced
      // photograph is not served from a cache for a week.
      photoUpdatedAt: new Date(),
    },
    select: { id: true, slug: true, photoUpdatedAt: true },
  });

  /**
   * The old object, once the row no longer points at it.
   *
   * Deliberately after the update and deliberately not fatal: an orphaned
   * object costs a fraction of a cent a year, and failing the request over
   * one would tell the office their upload did not work when it did.
   */
  if (car.photoKey && car.photoKey !== key) {
    try {
      await store.remove(car.photoKey);
    } catch (error) {
      console.warn("[admin] the previous car photo could not be removed:", error);
    }
  }

  return NextResponse.json({
    id: updated.id,
    slug: updated.slug,
    photoUpdatedAt: updated.photoUpdatedAt?.toISOString() ?? null,
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
    select: { id: true, photoKey: true },
  });
  if (!car) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // The row first. If the object removal then fails, the photograph is
  // already unreachable — which is what was asked for — and the orphan is a
  // storage cost rather than a privacy one: a car has no face.
  await prisma.car.update({
    where: { id: car.id },
    data: { photoKey: null, photoContentType: null, photoUpdatedAt: null },
  });

  if (car.photoKey) {
    try {
      await getAssetStore().remove(car.photoKey);
    } catch (error) {
      console.warn("[admin] the car photo object could not be removed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
