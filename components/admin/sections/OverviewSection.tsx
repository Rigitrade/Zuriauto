"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { day } from "@/components/admin/format";

/**
 * The landing section.
 *
 * Stage 1 rehouses the counter grid unchanged, so this ships without any
 * behaviour to re-verify. Stage 2 is where it earns its place: the attention
 * band, the Today timeline, and a reduced counter set in which `Verträge`
 * stops sitting beside `Rückgabe offen` as though the two were equally worth
 * looking at.
 */
export function OverviewSection() {
  const { L, data } = useAdmin();
  const counts = data?.counts;

  if (!counts) return null;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            [L.counts.available, counts.available],
            [L.counts.rented, counts.rented],
            [L.counts.retired, counts.retired],
            [L.counts.activeRentals, counts.activeRentals],
            [L.counts.returnsAwaiting, counts.returnsAwaiting],
            [L.counts.contracts, counts.contracts],
            [L.counts.mailFailed, counts.mailFailed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-xl font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </section>

      {data?.latestContractAt && (
        <p className="text-xs text-slate-500">
          {L.fleet.latestContract}: {day(data.latestContractAt)}
        </p>
      )}
    </>
  );
}
