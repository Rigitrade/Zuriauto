"use client";

import { useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AddCar } from "@/components/admin/parts/AddCar";
import { CarRow } from "@/components/admin/parts/CarRow";
import { Dialog } from "@/components/admin/parts/Dialog";
import { Panel } from "@/components/admin/parts/Panel";
import { useRowOrder } from "@/components/admin/parts/useRowOrder";

/** Every car in every status — unlike /api/fleet, which shows only what can
 *  be rented. Managing a retired car is the point of this screen. */
export function VehiclesSection() {
  const { L, language, data, busy, write, writeJson, reload } = useAdmin();
  const [adding, setAdding] = useState(false);

  const cars = data?.cars ?? [];
  /**
   * The office's order, dragged into place in this table (owner,
   * 17.10.2026). It is also the order of the pickup form's car list. A drop
   * saves the whole fleet's order at once; there is no Save button to forget.
   */
  const order = useRowOrder({
    items: cars,
    disabled: busy,
    save: (ids) =>
      write("/api/admin/cars/order/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
  });
  const orderable = cars.length > 1;
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
          language={language}
          busy={busy}
          /**
           * Two requests, because the photograph cannot be addressed until
           * the car exists — `PUT /api/admin/cars/[id]/photo/` needs an id
           * that POST is what produces.
           *
           * `writeJson` rather than `write` for the first one, so the id
           * comes back and the table is not repainted between the two: a
           * refetch in the middle would show the new car without its
           * photograph for as long as the upload takes, which reads as the
           * upload having failed.
           */
          onAdd={async (body, photo) => {
            const created = await writeJson<{ id: string }>(
              "/api/admin/cars/",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            // Stays open on failure so the typed plate is still there to
            // correct — a duplicate plate is the common case, and retyping the
            // whole car to fix one character would be its own annoyance.
            if (!created) return false;

            /**
             * The photograph, if one was chosen.
             *
             * A failure here is reported but does not undo the car: it exists,
             * it is correct, and it is missing a picture that can be added
             * from Edit in one click. Deleting a freshly created vehicle
             * because its photo upload timed out would be a far worse answer.
             */
            if (photo) {
              await writeJson(`/api/admin/cars/${created.id}/photo/`, {
                method: "PUT",
                headers: { "content-type": photo.type || "image/jpeg" },
                body: photo,
              });
            }

            await reload();
            setAdding(false);
            return true;
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
        {orderable && (
          <p className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-[var(--admin-rule)] px-4 py-2 text-xs text-[var(--admin-faint)]">
            <GripVertical className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{L.fleet.reorderHint}</span>
            <span
              role="status"
              className={`font-medium ${
                order.saving ? "text-[var(--admin-muted)]" : "text-[var(--admin-good)]"
              }`}
            >
              {order.saving ? L.fleet.orderSaving : order.justSaved ? L.fleet.orderSaved : ""}
            </span>
          </p>
        )}
        {cars.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">
            {L.fleet.empty}
          </p>
        ) : (
          // `relative` so the scroller also clips what is absolutely placed
          // inside it: the screen-reader "Vermietet: " of a renter's chip sat
          // past a phone's edge and made the whole page scroll sideways.
          <div className="relative overflow-x-auto">
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
                  {orderable && (
                    <th className="w-0 py-2.5 pr-0 pl-2">
                      <span className="sr-only">{L.fleet.reorder}</span>
                    </th>
                  )}
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
              <tbody ref={order.bodyRef}>
                {order.rows.map((car) => (
                  <CarRow
                    key={car.id}
                    car={car}
                    L={L}
                    language={language}
                    busy={busy}
                    dragging={order.dragging === car.id}
                    handle={
                      orderable ? (
                        <button
                          type="button"
                          {...order.handleProps(car.id)}
                          aria-label={`${L.fleet.dragHandle}: ${car.model} ${car.plate}`}
                          title={`${L.fleet.dragHandle} · ${L.fleet.dragKeys}`}
                          className={`grid h-9 w-8 cursor-grab touch-none place-items-center rounded-md hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-40 ${
                            order.dragging === car.id
                              ? "text-[var(--admin-accent)]"
                              : "text-[var(--admin-faint)]"
                          }`}
                        >
                          <GripVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : undefined
                    }
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
                    // The registration document, the same way and for the
                    // same reason: one file, no other field. Its endpoint is
                    // admin-only, unlike the photograph's — see the note
                    // there.
                    onUploadLicence={(file) =>
                      write(`/api/admin/cars/${car.id}/licence/`, {
                        method: "PUT",
                        headers: {
                          "content-type": file.type || "application/pdf",
                        },
                        body: file,
                      })
                    }
                    onRemoveLicence={() =>
                      write(`/api/admin/cars/${car.id}/licence/`, {
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
