import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { getAssetStore } from "@/lib/storage";

/**
 * One stored document, served to a signed-in member of the office.
 *
 * The bytes are streamed **through this handler** rather than handed out as a
 * presigned URL. A presigned URL is a bearer token for somebody's passport
 * that survives being forwarded, pasted into a chat, or left in a browser
 * history — and it cannot be audited once issued, because the fetch never
 * touches this application again. Proxying costs a few hundred kilobytes of
 * function traffic and buys a link that is worthless the moment it leaves the
 * session that made it.
 *
 * Every read is recorded before it is served. `AssetAccess` follows the same
 * reasoning as `CustomerLookup`, which logs phone searches including the ones
 * that matched nothing: this is the highest-risk data in the system, and an
 * office tool that can show a passport should be able to say who asked for
 * it. Written first on purpose — a read that fails halfway through still
 * happened, and the log should say so.
 *
 * Owner and staff alike. Checking a licence against a traffic fine is the
 * daily work of whoever is at the desk, and making them fetch an owner would
 * mean the fine sits unanswered rather than the document going unseen.
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

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      contentType: true,
      kind: true,
      deletedAt: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ code: "not-found" }, { status: 404 });
  }

  // Distinct from "not found" so the office can tell "we never took one" from
  // "we took one and the retention policy has since removed it".
  if (asset.deletedAt) {
    return NextResponse.json({ code: "deleted" }, { status: 410 });
  }

  await prisma.assetAccess.create({
    data: { assetId: asset.id, userId: user.id, username: user.username },
  });

  const stored = await getAssetStore().get(asset.storageKey);
  if (!stored) {
    // The row outlived its object without the retention sweep's involvement.
    // Worth a log line: it means the bucket and the database disagree.
    console.error(
      `[admin] asset ${asset.id} (${asset.kind}) has no object at ${asset.storageKey}`
    );
    return NextResponse.json({ code: "no-document" }, { status: 409 });
  }

  return new NextResponse(Buffer.from(stored.body), {
    headers: {
      "content-type": stored.contentType || asset.contentType,
      // Inline so a licence opens in a tab rather than landing in Downloads,
      // where it would outlive the session that was allowed to see it.
      "content-disposition": "inline",
      // Never cached by a proxy, and not written to disk by the browser.
      "cache-control": "private, no-store",
    },
  });
}
