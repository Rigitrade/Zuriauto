"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { RentalRow } from "@/components/admin/parts/RentalRow";

/** Every rental that is neither COMPLETED nor CANCELLED, returns awaiting
 *  confirmation first — "what came back that I have not dealt with" is the
 *  question this screen exists to answer. */
export function RentalsSection() {
  const { L, data, busy, write } = useAdmin();

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
          {L.rentals.heading}
        </h2>
        {data?.rentals.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">{L.rentals.none}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data?.rentals.map((rental) => (
              <RentalRow
                key={rental.id}
                rental={rental}
                L={L}
                busy={busy}
                onClose={() =>
                  write(`/api/admin/rentals/${rental.id}/close/`, { method: "POST" })
                }
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">{L.rentals.closeHint}</p>
    </>
  );
}
