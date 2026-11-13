import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/session";
import { importLegacyFines } from "@/lib/fines/legacy";

/**
 * Takes over the office's fines list from before the system — see
 * lib/fines/legacy.ts. `dry: true` checks the list and shows what would be
 * written; the second call, without it, writes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 1_000_000;

export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown; name?: unknown; dry?: unknown } | null;
  if (!body || typeof body.text !== "string" || body.text.length > MAX_CHARS) {
    return NextResponse.json({ code: "invalid" }, { status: 400 });
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Liste";
  const organisation = await prisma.organisation.findFirstOrThrow({ select: { id: true } });

  const result = await importLegacyFines(prisma, {
    organisationId: organisation.id,
    text: body.text,
    source: `list:${name}`,
    dry: body.dry !== false,
    actor: { id: user.id, name: user.displayName },
  });
  if (body.dry === false && result.problems.length === 0) {
    console.info(`[fines] ${result.imported} legacy fines imported from "${name}" by ${user.displayName}`);
  }
  return NextResponse.json(result);
}
