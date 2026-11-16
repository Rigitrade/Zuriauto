/**
 * The read-only view of a partner company (multi-company phase D, 16.11.2026).
 *
 * ZURIAUTO's owner can look inside a partner's console, read-only (Ahmed's
 * decision of 15.11). Which partner is being viewed travels in its own cookie,
 * next to the session cookie. Kept free of imports so the middleware, which
 * runs before any route, can use it.
 */
export const VIEW_COOKIE = "zuriauto_view";

const READING = new Set(["GET", "HEAD", "OPTIONS"]);

/** The two ways out of a view, which must keep working inside one. */
const WAY_OUT = new Set(["/api/admin/view", "/api/admin/session"]);

/**
 * True for a request that would change something while a view is open: it
 * is answered "read-only" before it reaches any route. The routes refuse it
 * on their own as well (`requireAdmin`); this is what gives the office a
 * clear message rather than a signed-out screen.
 */
export function refusedWhileViewing(request: { method: string; pathname: string; viewing: boolean }): boolean {
  if (!request.viewing) return false;
  if (!request.pathname.startsWith("/api/admin/")) return false;
  if (READING.has(request.method.toUpperCase())) return false;
  const path = request.pathname.replace(/\/+$/, "");
  return !WAY_OUT.has(path);
}
