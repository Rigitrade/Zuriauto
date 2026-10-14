import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron (or any external scheduler) sends `Authorization: Bearer $CRON_SECRET`.
 * Shared by every cron route, so there is one rule for who may trigger mail
 * to customers and who may book payments.
 */
export function cronAuthorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fail closed. An unset secret must not mean an open trigger.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
