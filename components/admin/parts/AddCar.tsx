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
      // A vertical stack: this lives in a dialog now, not across the top of
      // the page, and three labelled fields in a 32rem panel read better as
      // rows than as a squeezed four-column grid.
      className="grid gap-3"
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
        className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {L.fleet.add}
      </button>
    </form>
  );
}
