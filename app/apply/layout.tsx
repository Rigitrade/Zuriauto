import type { Metadata } from "next";

/**
 * Keeps the contract form out of search results.
 *
 * The root layout sets `robots: { index: true }` for the whole site, which is
 * right for the marketing pages and wrong here: this page invites the visitor
 * to upload photographs of an identity card and a driving licence. It should
 * be reachable only by someone the office sent the link to, not by anyone who
 * searches. Metadata from a nested layout overrides the root, so this narrows
 * the rule to this route alone.
 *
 * `noindex` is a request, not access control — a public unauthenticated form is
 * still a public form. Real protection arrives with the Phase 2 token links.
 */
export const metadata: Metadata = {
  title: "Mietvertrag – Fahrzeugübernahme",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
