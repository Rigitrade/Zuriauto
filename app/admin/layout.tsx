import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * The office's fleet console, at /admin/.
 *
 * Unlinked and unindexed: nothing in the site's navigation, footer or sitemap
 * points here, and the username and password are what actually protect it —
 * obscurity on its own is not a fence. See lib/admin/session.ts.
 *
 * Deliberately outside MainLayout. This is a staff tool, not a page of the
 * site, and giving it the public header would invite someone to link it.
 *
 * A server component so it can carry the metadata below; the shell it renders
 * is the client component that owns the session. Every section under
 * /admin/... renders as this layout's `children`, and therefore only ever
 * mounts for somebody already signed in.
 */
export const metadata: Metadata = {
  title: "Fleet — ZURIAUTO",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
