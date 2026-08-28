"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { RentalRow } from "@/components/admin/parts/RentalRow";
import { Panel } from "@/components/admin/parts/Panel";

/** Every rental that is neither COMPLETED nor CANCELLED, returns awaiting
 *  confirmation first — "what came back that I have not dealt with" is the
 *  question this screen exists to answer. */
export function RentalsSection() {
  const { L, data, busy, write } = useAdmin();
  const rentals = data?.rentals ?? [];
  const awaiting = rentals.filter((rental) => rental.returnSubmittedAt).length;

  return (
    <>
      <Panel
        title={L.rentals.heading}
        meta={
          awaiting
            ? `${rentals.length} · ${awaiting} ${L.counts.returnsAwaiting.toLowerCase()}`
            : String(rentals.length)
        }
      >
        {rentals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">
            {L.rentals.none}
          </p>
        ) : (
          <ul>
            {rentals.map((rental) => (
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
      </Panel>

      <p className="px-1 text-xs text-[var(--admin-faint)]">{L.rentals.closeHint}</p>
    </>
  );
}
