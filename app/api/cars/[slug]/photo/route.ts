import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAssetStore } from "@/lib/storage";

/**
 * A car's photograph, served to anyone.
 *
 * Public, unlike `/api/admin/assets/[id]/`, and the difference is the subject.
 * That endpoint proxies somebody's passport and logs every read; this one
 * serves a picture of a car parked outside the office, which is the same
 * photograph the marketing pages would happily put on the front page. Putting
 * it behind the admin session would mean the pickup form — filled in by a
 * customer at the kerb, signed into nothing — could not show the car they are
 * about to drive away.
 *
 * Keyed by slug rather than by id, because the slug is what
 * `/api/fleet/` already gives the picker as `FleetVehicle.id`. A caller
 * holding a fleet listing can build this URL without a second lookup.
 *
 * Streamed through the handler rather than redirected to a presigned URL, for
 * the plain reason that the bucket has no public origin and this is one small
 * image cached for a year.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A year, and immutable — because the URL changes when the photograph does.
 *
 * The version query the picker appends comes from `photoUpdatedAt`, so a
 * replaced photograph is a different URL rather than the same one with new
 * bytes. That is what makes a long cache safe: nothing has to expire for the
 * office to see their change.
 *
 * A request without that query is still answered, and still cached — but
 * revalidated, since such a URL cannot say which version it wanted.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, max-age=0, must-revalidate";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const car = await prisma.car.findFirst({
    where: { slug },
    select: { photoKey: true, photoContentType: true, photoUpdatedAt: true },
  });

  // One answer for "no such car" and "that car has no photograph". The
  // difference is of no use to a caller and enumerating slugs should not
  // report which ones exist.
  if (!car?.photoKey) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  /**
   * The version stamp, as an ETag.
   *
   * Lets a browser that already holds the image revalidate with a 304 rather
   * than pulling the bytes through a serverless function again — which is the
   * difference between a hover preview that appears instantly and one that
   * flickers.
   */
  const etag = `"${car.photoUpdatedAt?.getTime() ?? 0}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const object = await getAssetStore().get(car.photoKey);
  if (!object) {
    // The row outlived its object — a bucket restored from an older snapshot,
    // or a removal that half succeeded. Honest 404 rather than a 500: there
    // is nothing here, and nothing the caller can do differently.
    console.warn(`[fleet] car ${slug} points at a photo that is not in the store`);
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  const versioned = new URL(request.url).searchParams.has("v");

  return new Response(Buffer.from(object.body), {
    status: 200,
    headers: {
      "content-type": car.photoContentType ?? object.contentType,
      "content-length": String(object.body.byteLength),
      "cache-control": versioned ? IMMUTABLE : REVALIDATE,
      ETag: etag,
    },
  });
}
