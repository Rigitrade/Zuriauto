"use client";

import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Bell, Check } from "lucide-react";
import type { AttentionItem } from "@/lib/admin/attention";
import type { Labels } from "@/components/admin/types";
import {
  attentionDetail,
  attentionHref,
  attentionTitle,
} from "@/components/admin/overview/attentionText";

/**
 * The header's bell: how much is waiting, from any page of the console.
 *
 * Renders the same items as the Overview band, from the same selector, so the
 * bell, the band and the rail's badge always agree on the number. It is a
 * pointer, not a second place to do the work: each row links to where its
 * action already lives, so there is one "confirm return" button and one
 * "send again", not two copies that could drift.
 *
 * Built on the same Radix menu as `RowMenu`, for the same reasons given there
 * — arrow keys, Escape, focus returning to the trigger, and not being clipped
 * by the sticky header it sits in.
 */
export function NotificationBell({
  items,
  L,
  now,
}: {
  items: AttentionItem[];
  L: Labels;
  now: Date;
}) {
  const count = items.length;

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={count > 0 ? `${L.bell.label}: ${count} ${L.bell.waiting}` : L.bell.label}
        className="relative grid h-9 w-9 place-items-center rounded-md text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30 focus-visible:outline-none data-[state=open]:bg-[var(--admin-sunk)] data-[state=open]:text-[var(--admin-ink)]"
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[var(--admin-attn)] px-1 text-[0.6875rem] leading-none font-semibold tabular-nums text-white ring-2 ring-[var(--admin-surface)]"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--admin-rule)] bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-xl"
        >
          <Menu.Label className="border-b border-[var(--admin-rule)] px-3.5 py-2.5 text-xs font-bold tracking-wider text-[var(--admin-attn)] uppercase">
            {L.bell.heading}
            {count > 0 ? ` · ${count}` : ""}
          </Menu.Label>

          {count === 0 ? (
            <p className="flex items-center gap-2.5 px-3.5 py-4 text-sm text-[var(--admin-muted)]">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--admin-good-soft)] text-[var(--admin-good)]"
                aria-hidden="true"
              >
                <Check className="h-3 w-3" />
              </span>
              {L.bell.empty}
            </p>
          ) : (
            <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-1">
              {items.map((item) => (
                <Menu.Item key={item.key} asChild>
                  <Link
                    href={attentionHref(item)}
                    className="block cursor-pointer rounded-md px-2.5 py-2 outline-none select-none data-[highlighted]:bg-[var(--admin-sunk)]"
                  >
                    <span className="block text-sm font-semibold">
                      {attentionTitle(item, L)} — {item.customerName}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--admin-faint)]">
                      {attentionDetail(item, L, now)}
                    </span>
                  </Link>
                </Menu.Item>
              ))}
            </div>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
