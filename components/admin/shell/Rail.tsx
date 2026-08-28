"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Labels, Me } from "@/components/admin/types";

/**
 * Section navigation.
 *
 * A vertical rail at desktop widths and a horizontally scrolling bar below
 * 768px — not a drawer. Seven items fit in a bar, and a drawer would cost a
 * tap before every navigation while hiding the one thing this navigation is
 * for: the count of work waiting on somebody. See decision 6 in
 * docs/superpowers/specs/2026-08-28-admin-dashboard-console-design.md.
 *
 * Customers and Contracts are deliberately absent. They arrive in stage 4 with
 * the endpoints behind them; a rail item that leads to an empty screen is
 * worse than a shorter rail.
 */

interface Item {
  href: string;
  label: string;
  /** Owner-only items are not rendered for staff. The fence is the API's
   *  403 — this only avoids showing a door that will not open. */
  ownerOnly?: boolean;
  badge?: number;
}

export function Rail({
  L,
  me,
  attention,
}: {
  L: Labels;
  me: Me;
  /** How many things need a person. Rendered on Overview at every width. */
  attention: number;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/admin", label: L.nav.overview, badge: attention || undefined },
    { href: "/admin/rentals", label: L.nav.rentals },
    { href: "/admin/vehicles", label: L.nav.fleet },
    { href: "/admin/accounts", label: L.nav.accounts, ownerOnly: true },
    { href: "/admin/password", label: L.nav.myPassword },
  ];

  const visible = items.filter((item) => !item.ownerOnly || me.role === "owner");

  return (
    <nav
      aria-label={L.nav.sections}
      className="
        -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-2
        md:mx-0 md:w-44 md:shrink-0 md:flex-col md:overflow-visible
        md:border-b-0 md:border-r md:pb-0 md:pr-3
      "
    >
      {visible.map((item) => {
        // Exact match for Overview, prefix for the rest: /admin must not light
        // up while /admin/vehicles is open, but a future /admin/vehicles/123
        // should still show Vehicles as current.
        const active =
          item.href === "/admin"
            ? pathname === "/admin" || pathname === "/admin/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active
                ? "bg-slate-900 text-white md:bg-slate-100 md:text-slate-900 md:font-semibold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
