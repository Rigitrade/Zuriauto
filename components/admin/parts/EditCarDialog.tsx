"use client";

import { useId, useState } from "react";
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
  // The footer's button is not inside the form it submits, so the two need a
  // name in common. Generated rather than built from the car's id, because
  // nothing says two of these can never be mounted at once and a duplicate id
  // would have one car's Speichern commit another's.
  const formId = useId();

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
      footer={
        <button
          type="submit"
          // Outside the form it commits, which is what `form` is for. The
          // alternative — moving the fields into the footer's DOM, or posting
          // the form from a click handler — trades a one-word attribute for
          // either a broken layout or a submit that Enter no longer reaches.
          form={formId}
          disabled={busy || !dirty || !model.trim() || !plate.trim()}
          className="h-10 w-full rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {L.fleet.save}
        </button>
      }
    >
      {/*
        What the office types, before what it uploads.

        The photograph and the registration used to open the dialog, so the
        first thing on screen was an empty grey tile and the car's own name was
        below the fold. The typed facts are why this dialog is opened; the two
        documents are added once in a car's life and belong after them, under a
        heading that says what they are.
      */}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ model, plate, vin, colour, mfkDate, mfkLastDate });
        }}
        className="grid gap-3"
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
      </form>

      {/*
        The two documents, under one heading and one sentence.

        Both write the moment a file is chosen, which is the one thing about
        this dialog that has to be said rather than discovered — so it is said
        once here instead of twice, once under each tile, where two copies of
        the same warning read as two different ones.

        The last section's own rule is removed: the footer draws its own a few
        pixels below, and two lines that close the same box is one too many.
      */}
      <section className="mt-5 grid gap-3 [&>section:last-of-type]:border-b-0 [&>section:last-of-type]:pb-0">
        <h3 className="text-xs font-semibold tracking-wider text-[var(--admin-faint)] uppercase">
          {L.fleet.documentsHeading}
        </h3>

        <CarPhotoField
          car={car}
          L={L}
          busy={busy}
          onUpload={onUploadPhoto}
          onRemove={onRemovePhoto}
          saveNote={false}
        />

        <CarLicenceField
          car={car}
          L={L}
          busy={busy}
          onUpload={onUploadLicence}
          onRemove={onRemoveLicence}
          saveNote={false}
        />

        <p className="text-xs text-[var(--admin-faint)]">
          {L.fleet.documentsSaveNow}
        </p>
      </section>
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
