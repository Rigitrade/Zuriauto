"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AttentionBand } from "@/components/admin/overview/AttentionBand";
import { TodayTimeline } from "@/components/admin/overview/TodayTimeline";
import { attentionItems } from "@/lib/admin/attention";
import { day } from "@/components/admin/format";

/**
 * The landing section: what needs a person, then what is coming back, then
 * the numbers.
 *
 * The counter set is deliberately shorter than it was. `Verträge` — a running
 * total nobody acts on — moves out of the row where it used to sit beside
 * `Rückgabe offen` as though the two were equally worth looking at. Returns
 * and unsent mail are not counters here at all any more: they are rows in the
 * band above, with the action attached.
 */
export function OverviewSection() {
  const { L, data, write } = useAdmin();

  // Set after mount rather than at module scope: a timestamp computed during
  // render differs between the server's HTML and the client's first paint,
  // which is a hydration mismatch. Ticks so "overdue" becomes true on a page
  // left open rather than at the next reload.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const items = useMemo(
    () => (data && now ? attentionItems(data, now) : []),
    [data, now]
  );

  if (!data || !now) return null;
  const { counts } = data;

  return (
    <>
      <AttentionBand
        items={items}
        L={L}
        now={now}
        onResend={(contractId) =>
          write(`/api/admin/contracts/${contractId}/resend/`, { method: "POST" })
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TodayTimeline rentals={data.rentals} L={L} now={now} />

        <dl className="grid grid-cols-2 gap-3 self-start">
          <Tile label={L.counts.available} value={counts.available} />
          <Tile label={L.counts.rented} value={counts.rented} />
          <Tile label={L.counts.activeRentals} value={counts.activeRentals} />
          <Tile label={L.counts.retired} value={counts.retired} />
        </dl>
      </div>

      <p className="text-xs text-slate-500">
        {L.counts.contracts}: {counts.contracts}
        {data.latestContractAt
          ? ` · ${L.fleet.latestContract}: ${day(data.latestContractAt)}`
          : ""}
      </p>
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
