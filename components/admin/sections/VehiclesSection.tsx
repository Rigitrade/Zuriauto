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
  /**
   * How many people are waiting to be told a car is free.
   *
   * Shown beside the counts rather than as its own panel, because on almost
   * every day it is zero and a permanent empty panel is furniture. When it is
   * not zero it is demand the office can act on — five people waiting is the
   * argument for getting a car out of the garage today rather than on Friday.
   */
  const waiting = data?.counts.waitingForCar ?? 0;

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
        meta={
          `${cars.length} · ${available} ${L.counts.available.toLowerCase()}` +
          (waiting > 0 ? ` · ${waiting} ${L.fleet.waitlistCount}` : "")
        }
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
            {/* 54rem, down from 76rem.

                The service book added three columns and the actions column
                held five side-by-side controls, which together asked for more
                width than the shell has to give — `max-w-6xl` is 72rem — so
                the table scrolled sideways on every screen, including the big
                one in the office. Folding the actions into a single menu
                button gave back about 300px and let the rest breathe.

                The floor stays, because a phone is narrower than any of this
                and eight columns of fleet data will not honestly fit one.
                There, sideways scrolling is the right trade against a table
                squeezed into an unreadable one. */}
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="bg-[var(--admin-sunk)] text-left text-xs uppercase tracking-wider text-[var(--admin-faint)]">
                  <th className="px-4 py-2.5 font-medium">{L.fleet.model}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.plate}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.status}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.mileageShort}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.service}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.repairs}</th>
                  <th className="px-4 py-2.5 font-medium">{L.fleet.mfk}</th>
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
                    onAddRepair={(body) =>
                      write(`/api/admin/cars/${car.id}/repairs/`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                      })
                    }
                    onUpdateRepair={(repairId, body) =>
                      write(`/api/admin/cars/${car.id}/repairs/${repairId}/`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                      })
                    }
                    onDeleteRepair={(repairId) =>
                      write(`/api/admin/cars/${car.id}/repairs/${repairId}/`, {
                        method: "DELETE",
                      })
                    }
                    // The one write that is not JSON. The body is the image
                    // itself — there is exactly one file and no other field,
                    // so a multipart envelope would be a parser and a
                    // boundary string bought for nothing.
                    onUploadPhoto={(blob) =>
                      write(`/api/admin/cars/${car.id}/photo/`, {
                        method: "PUT",
                        headers: { "content-type": blob.type || "image/jpeg" },
                        body: blob,
                      })
                    }
                    onRemovePhoto={() =>
                      write(`/api/admin/cars/${car.id}/photo/`, {
                        method: "DELETE",
                      })
                    }
                    // Creates a rental where none exists, so a car that went
                    // out on paper can be handed back. See the endpoint for
                    // why a status change on its own would silently lose the
                    // return protocol.
                    onMarkOut={(body) =>
                      write(`/api/admin/cars/${car.id}/mark-out/`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                      })
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
