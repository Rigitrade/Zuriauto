"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { CarPhotoField } from "./CarPhotoField";
import { CarLicenceField } from "./CarLicenceField";
import { ColourField } from "./ColourField";
import { DateField } from "./DateField";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Car, Labels } from "@/components/admin/types";

/**
 * What the car *is*: its photograph, its model, its plate, its chassis number
 * and its MFK date.
 *
 * The MFK belongs with those and not with the service figures next door, even
 * though both are dates about work on a car. This one is not the office's to
 * decide: it is printed on the inspection certificate, it arrives once every
 * year or two, and typing it in is part of registering the vehicle. The
 * service book across the way is the office's own record, rewritten weekly.
 *
 * The photograph belongs here rather than with the service figures for the
 * reason the maintenance dialog now spells out — it is identity, not a record
 * of work done. It is the one control in this dialog that writes immediately
 * instead of waiting for Speichern, and it says so.
 */
export function EditCarDialog({
  car,
  L,
  language,
  busy,
  open,
  onClose,
  onSave,
  onUploadPhoto,
  onRemovePhoto,
  onUploadLicence,
  onRemoveLicence,
}: {
  car: Car;
  L: Labels;
  language: AdminLanguage;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onUploadPhoto: (blob: Blob) => Promise<boolean>;
  onRemovePhoto: () => Promise<boolean>;
  onUploadLicence: (file: Blob) => Promise<boolean>;
  onRemoveLicence: () => Promise<boolean>;
}) {
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");
  const [colour, setColour] = useState(car.colour ?? "");
  const [mfkDate, setMfkDate] = useState(car.mfkDate ?? "");
  const [mfkLastDate, setMfkLastDate] = useState(car.mfkLastDate ?? "");

  const dirty =
    model !== car.model ||
    plate !== car.plate ||
    vin !== (car.vin ?? "") ||
    colour !== (car.colour ?? "") ||
    mfkDate !== (car.mfkDate ?? "") ||
    mfkLastDate !== (car.mfkLastDate ?? "");

  // Advisory, not blocking: a previous inspection dated after the next one is
  // nearly always a typo, but the office is holding the certificate and this
  // screen is not.
  const mfkReversed =
    mfkDate !== "" && mfkLastDate !== "" && mfkLastDate > mfkDate;

  return (
    <Dialog
      open={open}
      onClose={() => {
        // Discard on close, so reopening shows what the server holds rather
        // than a half-typed edit from ten minutes ago.
        setModel(car.model);
        setPlate(car.plate);
        setVin(car.vin ?? "");
        setColour(car.colour ?? "");
        setMfkDate(car.mfkDate ?? "");
        setMfkLastDate(car.mfkLastDate ?? "");
        onClose();
      }}
      title={`${car.model} · ${car.plate}`}
      closeLabel={L.fleet.cancel}
    >
      <CarPhotoField
        car={car}
        L={L}
        busy={busy}
        onUpload={onUploadPhoto}
        onRemove={onRemovePhoto}
      />

      {/* The papers, under the picture. Both are "what this car is", and both
          write immediately — the two notes saying so sit one under the other
          rather than being separated by the fields that do wait for Save. */}
      <div className="mt-4">
        <CarLicenceField
          car={car}
          L={L}
          busy={busy}
          onUpload={onUploadLicence}
          onRemove={onRemoveLicence}
        />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ model, plate, vin, colour, mfkDate, mfkLastDate });
        }}
        className="mt-4 grid gap-3"
      >
        <Field label={L.fleet.model} value={model} onChange={setModel} />
        <Field label={L.fleet.plate} value={plate} onChange={setPlate} mono />
        <Field label={L.fleet.vinOptional} value={vin} onChange={setVin} mono />

        <ColourField
          value={colour}
          onChange={setColour}
          L={L}
          language={language}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label={L.fleet.mfkOptional}
            value={mfkDate}
            onChange={setMfkDate}
            placeholder={L.fleet.datePlaceholder}
            invalidHint={L.fleet.dateInvalid}
          />
          <DateField
            label={L.fleet.mfkLastOptional}
            value={mfkLastDate}
            onChange={setMfkLastDate}
            placeholder={L.fleet.datePlaceholder}
            invalidHint={L.fleet.dateInvalid}
            hint={L.fleet.mfkLastHint}
          />
        </div>

        {mfkReversed && (
          <p className="text-xs text-[var(--admin-attn)]">
            {L.fleet.mfkLastAfterNext}
          </p>
        )}

        <p className="text-xs text-[var(--admin-faint)]">{L.fleet.mfkHint}</p>
        <button
          type="submit"
          disabled={busy || !dirty || !model.trim() || !plate.trim()}
          className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {L.fleet.save}
        </button>
      </form>
    </Dialog>
  );
}

/** A plain text row. Dates do not come through here — they have their own
 *  control, because the native date input renders in the browser's locale
 *  rather than this console's. See DateField. */
function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      />
    </label>
  );
}
