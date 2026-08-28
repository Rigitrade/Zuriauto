"use client";

import Link from "next/link";
import type { AttentionItem } from "@/lib/admin/attention";
import type { Labels } from "@/components/admin/types";
import { day } from "@/components/admin/format";

/**
 * What needs a person, at the top of the console.
 *
 * The empty state is rendered explicitly and never as absence. A band that
 * simply disappears when there is nothing to do is indistinguishable from a
 * band that failed to render, and the difference between those two is a car
 * nobody knows is blocked.
 *
 * Every row carries its reason and its action side by side, because the cost
 * of the old screen was not that the information was missing — it was that
 * the number and the thing you do about it lived in different places.
 */
export function AttentionBand({
  items,
  L,
  now,
}: {
  items: AttentionItem[];
  L: Labels;
  now: Date;
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="text-sm font-medium text-emerald-900">
          {L.overview.nothingWaiting}
        </p>
        <p className="mt-0.5 text-xs text-emerald-800/80">
          {L.overview.nothingWaitingHint}
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 border-l-4 bg-amber-50">
      <h2 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-900">
        {L.overview.needsYou} · {items.length}
      </h2>
      <ul className="divide-y divide-slate-200 border-t border-amber-200">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {title(item, L)} — {item.customerName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{detail(item, L, now)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.kind === "return" && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-amber-900">
                  {L.overview.carStaysBlocked}
                </span>
              )}
              <Link
                href={item.kind === "mail" ? "/admin/rentals" : "/admin/rentals"}
                className="h-9 rounded-md border border-slate-300 px-3 text-sm leading-9 text-slate-700 transition-colors hover:bg-slate-50"
              >
                {item.kind === "return" ? L.rentals.close : L.overview.open}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function title(item: AttentionItem, L: Labels): string {
  if (item.kind === "return") return L.overview.confirmReturn;
  if (item.kind === "ending") return L.overview.endsToday;
  return L.overview.mailNotDelivered;
}

function detail(item: AttentionItem, L: Labels, now: Date): string {
  if (item.kind === "mail") {
    return [item.contractNumber, item.at ? day(item.at) : null]
      .filter(Boolean)
      .join(" · ");
  }

  const parts = [item.carModel, item.carPlate].filter(Boolean);
  if (item.at) {
    const overdue =
      item.kind === "ending" && Date.parse(item.at) < now.getTime();
    parts.push(
      `${item.kind === "return" ? L.overview.returnsOn : ""} ${day(item.at)}${
        overdue ? ` · ${L.overview.overdue}` : ""
      }`.trim()
    );
  }
  return parts.join(" · ");
}
