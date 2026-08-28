import type { Metadata } from "next";
import AdminDashboard from "@/components/admin/AdminDashboard";

/**
 * The office's fleet page, at /admin/.
 *
 * Unlinked and unindexed: nothing in the site's navigation, footer or sitemap
 * points here, and a signed-in account — a username and password — is what
 * actually protects it; obscurity on its own is not a fence. See
 * lib/admin/session.ts.
 *
 * Deliberately outside MainLayout. This is a staff tool, not a page of the
 * site, and giving it the public header would invite someone to link it.
 */
export const metadata: Metadata = {
  title: "Fleet — ZURIAUTO",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
