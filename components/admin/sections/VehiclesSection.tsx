"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AddCar } from "@/components/admin/parts/AddCar";
import { CarRow } from "@/components/admin/parts/CarRow";
import { Dialog } from "@/components/admin/parts/Dialog";

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
            // correct — a duplicate plate is the common case, and retyping
            // the whole car to fix one character would be its own annoyance.
            if (ok) setAdding(false);
            return ok;
          }}
        />
      </Dialog>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
          <span>
            {L.fleet.heading}
            <span className="ml-2 font-normal text-slate-400">
              {cars.length} · {available} {L.counts.available.toLowerCase()}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {L.fleet.addHeading}
          </button>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="p-3 font-medium">{L.fleet.model}</th>
                <th className="p-3 font-medium">{L.fleet.plate}</th>
                <th className="p-3 font-medium">{L.fleet.vin}</th>
                <th className="p-3 font-medium">{L.fleet.status}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data?.cars.map((car) => (
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
              {data?.cars.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sm text-slate-500">
                    {L.fleet.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
