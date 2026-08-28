"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { STATUS_STYLE } from "@/components/admin/format";
import type { Car, Labels } from "@/components/admin/types";

export function CarRow({
  car,
  L,
  busy,
  onSave,
  onDelete,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rented = car.status === "rented";
  const retired = car.status === "retired";
  const dirty = model !== car.model || plate !== car.plate || vin !== (car.vin ?? "");
  const style = STATUS_STYLE[car.status] ?? "bg-slate-100 text-slate-700";
  const statusLabel =
    L.fleet.statuses[car.status as keyof typeof L.fleet.statuses] ?? car.status;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="p-3 align-middle">
        <Input value={model} onChange={(e) => setModel(e.target.value)} className="h-10" />
      </td>
      <td className="p-3 align-middle tabular-nums">
        <Input value={plate} onChange={(e) => setPlate(e.target.value)} className="h-10 tabular-nums" />
      </td>
      <td className="p-3 align-middle">
        <Input value={vin} onChange={(e) => setVin(e.target.value)} className="h-10" />
      </td>
      <td className="p-3 align-middle">
        <span className={`rounded-full px-2 py-0.5 text-xs ${style}`}>{statusLabel}</span>
      </td>
      <td className="p-3 align-middle whitespace-nowrap">
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <>
              <button
                type="button"
                disabled={busy}
                // The row's own state already matches what is being sent; the
                // refetch behind onSave replaces it with the server's copy.
                onClick={() => onSave({ model, plate, vin })}
                className="h-10 rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {L.fleet.save}
              </button>
              <button
                type="button"
                // Discards the typed edit and goes back to what the server
                // last reported — the only way to undo a typo, since the
                // fields are always editable rather than behind an edit mode.
                onClick={() => {
                  setModel(car.model);
                  setPlate(car.plate);
                  setVin(car.vin ?? "");
                }}
                className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
              >
                {L.fleet.cancel}
              </button>
            </>
          )}

          {/* A rented car has no toggle at all: it is freed by closing its
              rental, so offering a disabled button here would only invite
              the question of why it does not work. */}
          {!rented && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave({ status: retired ? "available" : "retired" })}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
            >
              {retired ? L.fleet.reactivate : L.fleet.retire}
            </button>
          )}

          {!rented &&
            (confirmingDelete ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!(await onDelete())) setConfirmingDelete(false);
                  }}
                  className="h-10 rounded-md bg-red-600 px-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {L.fleet.deleteConfirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
                >
                  {L.fleet.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-10 rounded-md px-3 text-sm text-slate-600 underline"
              >
                {L.fleet.delete}
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}
