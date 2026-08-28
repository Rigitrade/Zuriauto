"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AddCar } from "@/components/admin/parts/AddCar";
import { CarRow } from "@/components/admin/parts/CarRow";
import { Dialog } from "@/components/admin/parts/Dialog";
import { Panel } from "@/components/admin/parts/Panel";

/** Every car in every status — unlike /api/fleet, which shows only what can
 *  be rented. Managing a retired car is the point of this screen. */
export function VehiclesSection() {
  const { L, data, busy, write } = useAdmin();
  const [adding, setAdding] = useState(false);

  const cars = data?.cars ?? [];
  const available = cars.filter((car) => car.status === "available").length;

  return (
    <>
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={L.fleet.addHeading}
        closeLabel={L.fleet.close}
      >
        <AddCar
          L={L}
          busy={busy}
          onAdd={async (body) => {
            const ok = await write("/api/admin/cars/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            // Stays open on failure so the typed plate is still there to
            // correct — a duplicate plate is the common case, and retyping the
            // whole car to fix one character would be its own annoyance.
            if (ok) setAdding(false);
            return ok;
          }}
        />
      </Dialog>

      <Panel
        title={L.fleet.heading}
        meta={`${cars.length} · ${available} ${L.counts.available.toLowerCase()}`}
        action={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {L.fleet.addHeading}
          </button>
        }
      >
        {cars.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">
            {L.fleet.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="bg-[var(--admin-sunk)] text-left text-xs uppercase tracking-wider text-[var(--admin-faint)]">
                  <th className="px-4 py-2.5 font-medium">{L.fleet.model}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.plate}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.status}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <CarRow
                    key={car.id}
                    car={car}
                    L={L}
                    busy={busy}
                    onSave={(body) =>
                      write(`/api/admin/cars/${car.id}/`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                      })
                    }
                    onDelete={() =>
                      write(`/api/admin/cars/${car.id}/`, { method: "DELETE" })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
