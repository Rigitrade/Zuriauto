"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AddCar } from "@/components/admin/parts/AddCar";
import { CarRow } from "@/components/admin/parts/CarRow";

/** Every car in every status — unlike /api/fleet, which shows only what can
 *  be rented. Managing a retired car is the point of this screen. */
export function VehiclesSection() {
  const { L, data, busy, write } = useAdmin();

  return (
    <>
      <AddCar
        L={L}
        busy={busy}
        onAdd={(body) =>
          write("/api/admin/cars/", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
          {L.fleet.heading}
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
