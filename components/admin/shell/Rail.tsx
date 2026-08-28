"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  KeyRound,
  LayoutDashboard,
  Lock,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Labels, Me } from "@/components/admin/types";

/**
 * Section navigation, in two presentations of one list.
 *
 * A fixed sidebar at desktop widths, and a horizontally scrolling bar under
 * the header below 768px — not a drawer. Five items fit in a bar, and a drawer
 * costs a tap before every navigation while hiding the one thing this
 * navigation exists to push at somebody: the count of work waiting. See
 * decision 6 in docs/superpowers/specs/2026-08-28-admin-dashboard-console-design.md.
 *
 * Icons are decorative, never the only label. A staff tool used by whoever is
 * covering the desk today cannot rely on somebody having learned what a glyph
 * means.
 */

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Owner-only items are not rendered for staff. The fence is the API's
   *  403 — this only avoids showing a door that will not open. */
  ownerOnly?: boolean;
  badge?: number;
}

export function railItems(L: Labels, me: Me, attention: number): Item[] {
  return [
    {
      href: "/admin",
      label: L.nav.overview,
      icon: LayoutDashboard,
      badge: attention || undefined,
    },
    { href: "/admin/rentals", label: L.nav.rentals, icon: KeyRound },
    { href: "/admin/vehicles", label: L.nav.fleet, icon: CarFront },
    {
      href: "/admin/accounts",
      label: L.nav.accounts,
      icon: Users,
      ownerOnly: true,
    },
    { href: "/admin/password", label: L.nav.myPassword, icon: Lock },
  ].filter((item) => !item.ownerOnly || me.role === "owner");
}

/** Exact for Overview, prefix for the rest: /admin must not light up while
 *  /admin/vehicles is open, but a later /admin/vehicles/123 should. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname.startsWith(href);
}

export function Rail({
  L,
  me,
  attention,
  variant,
}: {
  L: Labels;
  me: Me;
  attention: number;
  variant: "sidebar" | "bar";
}) {
  const pathname = usePathname();
  const items = railItems(L, me, attention);

  if (variant === "bar") {
    return (
      <nav
        aria-label={L.nav.sections}
        className="flex gap-1 overflow-x-auto px-3 pb-2.5 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-[var(--admin-accent)] font-medium text-[var(--admin-accent-ink)]"
                  : "bg-[var(--admin-sunk)] text-[var(--admin-muted)]"
              }`}
            >
              {item.label}
              {item.badge ? (
                <span
                  className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6875rem] font-semibold tabular-nums ${
                    active
                      ? "bg-white/25 text-[var(--admin-accent-ink)]"
                      : "bg-[var(--admin-attn)] text-white"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={L.nav.sections} className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const active = isCurrent(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-[var(--admin-accent-soft)] font-semibold text-[var(--admin-accent)]"
                : "text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                active
                  ? "text-[var(--admin-accent)]"
                  : "text-[var(--admin-faint)] group-hover:text-[var(--admin-muted)]"
              }`}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--admin-attn)] px-1.5 text-xs font-semibold tabular-nums text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
