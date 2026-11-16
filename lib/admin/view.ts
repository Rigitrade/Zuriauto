import { prisma } from "@/lib/db";
import { findSiteOrganisation } from "@/lib/organisation";
import { VIEW_COOKIE } from "./viewGuard";

/**
 * The read-only view of a partner company (multi-company phase D, 16.11.2026).
 * See `viewGuard.ts` for the cookie, and `requireAdmin` for how a view turns
 * every office screen to the partner's records and refuses every write.
 */
export { VIEW_COOKIE };

/** The view cookie's value: the id of the partner company being viewed. */
export function viewCookieFrom(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name !== VIEW_COOKIE) continue;
    // A damaged value is no view at all, never an error on every office page.
    try {
      return decodeURIComponent(rest.join("=")) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The partner a signed-in account may view, or null.
 *
 * Only an owner of the site company (ZURIAUTO) may view, and only a partner:
 * never ZURIAUTO itself, never a company that does not exist. Anything else
 * is ignored, so a cookie copied into a partner's browser shows that partner
 * its own console and nothing more.
 */
export async function viewablePartner(
  user: { role: "owner" | "staff"; organisationId: string },
  organisationId: string | undefined
): Promise<string | null> {
  if (!organisationId || user.role !== "owner") return null;
  const site = await findSiteOrganisation();
  if (!site || site.id !== user.organisationId || site.id === organisationId) return null;
  const target = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true } });
  return target?.id ?? null;
}

export function viewCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    maxAge,
  };
}
