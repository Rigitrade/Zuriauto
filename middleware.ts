import { NextResponse, type NextRequest } from "next/server";
import { refusedWhileViewing, VIEW_COOKIE } from "@/lib/admin/viewGuard";

/**
 * While ZURIAUTO's owner views a partner company read-only (multi-company
 * phase D, 16.11.2026), any change to the office API is answered "read-only"
 * here, before it reaches a route. The routes refuse it as well; this is what
 * gives the office a message instead of a signed-out screen.
 */
export function middleware(request: NextRequest) {
  const refused = refusedWhileViewing({
    method: request.method,
    pathname: request.nextUrl.pathname,
    viewing: request.cookies.has(VIEW_COOKIE),
  });
  if (refused) return NextResponse.json({ code: "read-only" }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/admin/:path*" };
