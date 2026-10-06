import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/session";
import { applyFineAction, fineActionSchema } from "@/lib/fines/actions";
import { notifyDeps } from "@/lib/fines/run";

/** An office action on a fine. See lib/fines/actions.ts for each one. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// "send" emails the renter with the letter attached.
export const maxDuration = 60;

const STATUS = { "bad-request": 400, conflict: 409, "not-found": 404 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ code: "unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }
  const parsed = fineActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "bad-request" }, { status: 400 });
  }

  const result = await applyFineAction(notifyDeps(new Date()), (await params).id, parsed.data, {
    id: user.id,
    displayName: user.displayName,
  });
  if (!result.ok) {
    return NextResponse.json({ code: result.code }, { status: STATUS[result.code] });
  }
  return NextResponse.json({ ok: true });
}
