import type { Metadata } from "next";

/**
 * A partner's pickup and return pages (multi-company phase C, 16.11.2026).
 * Kept out of search results for the reason app/pickup/layout.tsx gives:
 * these forms ask for identity documents and are meant for the people the
 * partner sends the link to.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function PartnerPagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
