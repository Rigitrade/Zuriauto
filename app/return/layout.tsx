import type { Metadata } from "next";

/**
 * Keeps the return form out of search results, for the same reason
 * app/pickup/layout.tsx does: the form collects a name, an email address and
 * a signature, and should be reachable only by someone the office sent the
 * link to, not by anyone who searches.
 *
 * `noindex` is a request, not access control — a public unauthenticated form
 * is still a public form. Real protection arrives with the Phase 2 token
 * links.
 */
export const metadata: Metadata = {
  title: "Fahrzeugrückgabe",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function ReturnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
