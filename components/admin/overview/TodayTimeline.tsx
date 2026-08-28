"use client";

import type { Labels, Rental } from "@/components/admin/types";
import { day } from "@/components/admin/format";

/**
 * What is coming back, and when.
 *
 * Context rather than a problem — the one part of Overview that is not derived
 * from something being wrong. It answers the question the phone is ringing
 * about ("when is that car back?") without anybody having to read the rentals
 * list and compare dates.
 *
 * Open question 1 in the design spec asks whether this earns its place at all.
 * It is deliberately small and self-contained so that deleting it costs one
 * import if the answer turns out to be no.
 */
export function TodayTimeline({
  rentals,
  L,
  now,
}: {
  rentals: Rental[];
  L: Labels;
  now: Date;
}) {
  // Soonest first, and only rentals still out: a submitted return is already
  // in the band above, and repeating it here would double-count the work.
  const upcoming = rentals
    .filter((rental) => !rental.returnSubmittedAt)
    .filter((rental) => Number.isFinite(Date.parse(rental.endAt)))
    .sort((a, b) => Date.parse(a.endAt) - Date.parse(b.endAt))
    .slice(0, 4);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)]">
      <h2 className="flex items-baseline justify-between gap-2 border-b border-[var(--admin-rule)] px-4 py-2.5">
        <span className="text-sm font-semibold tracking-tight">{L.overview.today}</span>
        <span className="text-xs tabular-nums text-[var(--admin-faint)]">{day(now.toISOString())}</span>
      </h2>

      {upcoming.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">{L.overview.noReturnsToday}</p>
      ) : (
        <ul className="divide-y divide-[var(--admin-rule)]">
          {upcoming.map((rental) => {
            const overdue = Date.parse(rental.endAt) < now.getTime();
            return (
              <li key={rental.id} className="flex gap-4 px-4 py-2.5">
                <span
                  className={`w-20 shrink-0 pt-0.5 text-xs tabular-nums ${
                    overdue
                      ? "font-semibold text-[var(--admin-attn)]"
                      : "text-[var(--admin-muted)]"
                  }`}
                >
                  {day(rental.endAt)}
                </span>
                <span className="min-w-0 text-sm">
                  <span className="font-medium">
                    {rental.customerName}
                  </span>
                  <span className="block text-xs text-[var(--admin-faint)]">
                    {rental.carModel} · {rental.carPlate}
                    {overdue ? ` · ${L.overview.overdue}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
