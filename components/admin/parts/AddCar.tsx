"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Labels } from "@/components/admin/types";

/** Add a vehicle. Stage 3 turns this into a dialog; for now it is the same
 *  always-open form the single-file dashboard had, moved unchanged. */
export function AddCar({
  L,
  busy,
  onAdd,
}: {
  L: Labels;
  busy: boolean;
  onAdd: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onAdd({ model, plate, vin })) {
          setModel("");
          setPlate("");
          setVin("");
        }
      }}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
    >
      <Input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={L.fleet.model}
      />
      <Input
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder={L.fleet.platePlaceholder}
      />
      <Input
        value={vin}
        onChange={(e) => setVin(e.target.value)}
        placeholder={L.fleet.vinOptional}
      />
      <button
        type="submit"
        disabled={busy || !model.trim() || !plate.trim()}
        className="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {L.fleet.add}
      </button>
    </form>
  );
}
