"use client";

import { useState } from "react";
import { CircleSlash, Gauge, Pencil, Trash2, Wrench } from "lucide-react";
import { Dialog } from "./Dialog";
import { CarMaintenance } from "./CarMaintenance";
import { CarPhotoField } from "./CarPhotoField";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "./RowMenu";
import { mfkStanding } from "@/lib/admin/mfk";
import { formatKm, kmUntilService, serviceStanding } from "@/lib/admin/service";
import { day } from "@/components/admin/format";
import type { Car, Labels } from "@/components/admin/types";

/**
 * One vehicle, as a row you read rather than a row you type into.
 *
 * It used to render three live text inputs per car — thirty form fields on
 * screen for a fleet of ten, all of them editable at all times, none of them
 * indicating that anything had changed. Editing moves behind a dialog: the
 * table becomes readable, and a save becomes deliberate instead of something
 * that happens because somebody tabbed through a plate.
 *
 * Status is a chip with a word in it, never colour alone — the tables get
 * screenshotted into WhatsApp, and the office should not have to remember
 * which pale rectangle means what.
 */

const STATUS_CHIP: Record<string, string> = {
  available:
    "bg-[var(--admin-good-soft)] text-[var(--admin-good)] ring-[var(--admin-good)]/20",
  rented:
    "bg-[var(--admin-attn-soft)] text-[var(--admin-attn)] ring-[var(--admin-attn)]/20",
  maintenance:
    "bg-[var(--admin-attn-soft)] text-[var(--admin-attn)] ring-[var(--admin-attn)]/20",
  retired:
    "bg-[var(--admin-sunk)] text-[var(--admin-muted)] ring-[var(--admin-rule-strong)]",
};

export function CarRow({
  car,
  L,
  busy,
  onSave,
  onDelete,
  onAddRepair,
  onUpdateRepair,
  onDeleteRepair,
  onUploadPhoto,
  onRemovePhoto,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onAddRepair: (body: Record<string, string>) => Promise<boolean>;
  onUpdateRepair: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDeleteRepair: (id: string) => Promise<boolean>;
  onUploadPhoto: (blob: Blob) => Promise<boolean>;
  onRemovePhoto: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rented = car.status === "rented";
  const retired = car.status === "retired";
  const inGarage = car.status === "maintenance";
  const standing = mfkStanding(car.mfkDate, new Date());
  const service = serviceStanding(car);
  const remaining = kmUntilService(car);
  const plannedRepairs = (car.repairs ?? []).filter(
    (repair) => repair.status === "planned"
  ).length;
  const statusLabel =
    L.fleet.statuses[car.status as keyof typeof L.fleet.statuses] ?? car.status;

  return (
    <>
      <EditCarDialog
        car={car}
        L={L}
        busy={busy}
        open={editing}
        onClose={() => setEditing(false)}
        onSave={async (body) => {
          const ok = await onSave(body);
          if (ok) setEditing(false);
          return ok;
        }}
        onUploadPhoto={onUploadPhoto}
        onRemovePhoto={onRemovePhoto}
      />

      {/* Deliberately stays open after a save. Unlike the edit dialog, which
          is one correction and done, this one is worked through — a mileage,
          then a repair ticked off, then another added — and closing it on the
          first save would make the office reopen it three times. */}
      <CarMaintenance
        car={car}
        L={L}
        busy={busy}
        open={maintaining}
        onClose={() => setMaintaining(false)}
        onSave={onSave}
        onAddRepair={onAddRepair}
        onUpdateRepair={onUpdateRepair}
        onDeleteRepair={onDeleteRepair}
      />

      <tr className="border-t border-[var(--admin-rule)] transition-colors hover:bg-[var(--admin-sunk)]/50">
        <td className="px-4 py-3">
          <p className="font-medium">{car.model}</p>
          {car.vin && (
            <p className="mt-0.5 font-mono text-xs text-[var(--admin-faint)]">
              {car.vin}
            </p>
          )}
        </td>

        <td className="px-4 py-3 font-mono text-sm whitespace-nowrap tabular-nums text-[var(--admin-muted)]">
          {car.plate}
        </td>

        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              STATUS_CHIP[car.status] ??
              "bg-[var(--admin-sunk)] text-[var(--admin-muted)] ring-[var(--admin-rule-strong)]"
            }`}
          >
            {statusLabel}
          </span>
        </td>

        {/* The odometer, and when somebody last looked at it.
            A reading with no date is a number the office cannot plan
            against — 97'000 km read this morning and 97'000 km read in March
            are different facts about the same car. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
          {typeof car.currentMileageKm === "number" ? (
            <>
              <span className="text-[var(--admin-muted)]">
                {formatKm(car.currentMileageKm)} km
              </span>
              {car.mileageReadAt && (
                <span className="mt-0.5 block text-xs text-[var(--admin-faint)]">
                  {day(car.mileageReadAt)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--admin-faint)]">{L.fleet.mfkNone}</span>
          )}
        </td>

        {/* The next service, as a distance rather than a date: a garage
            schedules on kilometres and so does the warning. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
          {typeof car.serviceDueKm === "number" ? (
            <>
              <span
                className={
                  service === "overdue"
                    ? "font-medium text-[var(--admin-crit)]"
                    : service === "due"
                      ? "font-medium text-[var(--admin-attn)]"
                      : "text-[var(--admin-muted)]"
                }
              >
                {formatKm(car.serviceDueKm)} km
              </span>
              {service !== "none" && service !== "ok" && remaining !== null && (
                <span
                  className={`mt-0.5 block text-xs ${
                    service === "overdue"
                      ? "text-[var(--admin-crit)]"
                      : "text-[var(--admin-attn)]"
                  }`}
                >
                  {service === "overdue"
                    ? L.fleet.serviceOverdue
                    : `${L.fleet.serviceIn} ${formatKm(remaining)} km`}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--admin-faint)]">{L.fleet.mfkNone}</span>
          )}
        </td>

        {/* Outstanding repairs, as a count. The detail is one click away in
            the maintenance dialog; what belongs in a table the office scans
            top-down is whether this car is waiting on anything at all. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap">
          {plannedRepairs > 0 ? (
            <span className="inline-block rounded-full bg-[var(--admin-attn-soft)] px-2.5 py-1 text-xs font-medium text-[var(--admin-attn)] ring-1 ring-inset ring-[var(--admin-attn)]/20">
              {plannedRepairs} {L.fleet.repairsPlanned.toLowerCase()}
            </span>
          ) : (
            <span className="text-[var(--admin-faint)]">{L.fleet.mfkNone}</span>
          )}
        </td>

        {/* The inspection date, and how close it is. A date alone would make
            the office do the arithmetic on ten rows; the word says which ones
            need them today. */}
        <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
          {car.mfkDate ? (
            <>
              <span
                className={
                  standing === "expired"
                    ? "font-medium text-[var(--admin-crit)]"
                    : standing === "due"
                      ? "font-medium text-[var(--admin-attn)]"
                      : "text-[var(--admin-muted)]"
                }
              >
                {day(car.mfkDate)}
              </span>
              {standing !== "ok" && (
                <span
                  className={`mt-0.5 block text-xs ${
                    standing === "expired"
                      ? "text-[var(--admin-crit)]"
                      : "text-[var(--admin-attn)]"
                  }`}
                >
                  {standing === "expired" ? L.fleet.mfkExpired : L.fleet.mfkDue}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--admin-faint)]">{L.fleet.mfkNone}</span>
          )}
        </td>

        {/* Everything you can do to a car, behind one button.

            This was five controls side by side — two icons, a rule, another
            icon and a text button. They took about 300px, which is why the
            table needed 76rem and why it scrolled sideways inside the 72rem
            the shell gives it. Worse, the actions were the part that scrolled
            out of sight, so the fix for not seeing them was to drag the table
            left every time.

            In the menu they are also named. The wrench in particular was a
            grey glyph whose tooltip ("In die Werkstatt") reads almost like the
            gauge's ("Unterhalt"); the word beside it now says which is which.

            Ordered as they are reached for: the two that open a dialog first,
            then the two that change the car's status on one click, then the
            one that destroys it, each group behind a rule. */}
        <td className="px-4 py-3">
          <div className="flex justify-end">
            <RowMenu
              // The plate, not just "Actions": a screen reader running down
              // this column would otherwise read the same button ten times.
              label={`${L.fleet.actions} · ${car.plate}`}
              disabled={busy}
              open={menuOpen}
              onOpenChange={(next) => {
                setMenuOpen(next);
                // A half-finished deletion does not survive the menu closing.
                // Reopening it to find the red confirm still armed, one stray
                // click from going through, is the one state this must not
                // come back in.
                if (!next) setConfirmingDelete(false);
              }}
            >
              {/* Maintenance before edit: it is opened weekly, and the edit
                  dialog perhaps once in a car's life. */}
              <RowMenuItem
                icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                onSelect={() => setMaintaining(true)}
              >
                {L.fleet.maintenance}
              </RowMenuItem>

              <RowMenuItem
                icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                onSelect={() => setEditing(true)}
              >
                {L.fleet.edit}
              </RowMenuItem>

              {/* A rented car has no status controls at all: it is freed by
                  closing its rental, so a greyed-out row here would only
                  invite the question of why it does not work. With them gone
                  the rule has nothing under it, so it goes too. */}
              {!rented && <RowMenuSeparator />}

              {/* Also the way back from a status the MFK pass sets by itself.
                  Without it a car the system blocked for its inspection could
                  never be freed from this screen. */}
              {!rented && !retired && (
                <RowMenuItem
                  icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
                  onSelect={() =>
                    void onSave({ status: inGarage ? "available" : "maintenance" })
                  }
                >
                  {inGarage ? L.fleet.backOnRoad : L.fleet.toGarage}
                </RowMenuItem>
              )}

              {!rented && !inGarage && (
                <RowMenuItem
                  icon={<CircleSlash className="h-4 w-4" aria-hidden="true" />}
                  onSelect={() =>
                    void onSave({ status: retired ? "available" : "retired" })
                  }
                >
                  {retired ? L.fleet.reactivate : L.fleet.retire}
                </RowMenuItem>
              )}

              {!rented && <RowMenuSeparator />}

              {/* Two steps, and the second one is a different row of the menu
                  rather than a button that appears under the pointer. */}
              {!rented &&
                (confirmingDelete ? (
                  <>
                    <RowMenuItem
                      danger
                      disabled={busy}
                      icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                      onSelect={() => void onDelete()}
                    >
                      <span className="font-medium">{L.fleet.deleteConfirm}</span>
                    </RowMenuItem>
                    <RowMenuItem keepOpen onSelect={() => setConfirmingDelete(false)}>
                      <span className="text-[var(--admin-muted)]">
                        {L.fleet.cancel}
                      </span>
                    </RowMenuItem>
                  </>
                ) : (
                  <RowMenuItem
                    danger
                    keepOpen
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    onSelect={() => setConfirmingDelete(true)}
                  >
                    {L.fleet.delete}
                  </RowMenuItem>
                ))}
            </RowMenu>
          </div>
        </td>
      </tr>
    </>
  );
}

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
function EditCarDialog({
  car,
  L,
  busy,
  open,
  onClose,
  onSave,
  onUploadPhoto,
  onRemovePhoto,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onUploadPhoto: (blob: Blob) => Promise<boolean>;
  onRemovePhoto: () => Promise<boolean>;
}) {
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");
  const [mfkDate, setMfkDate] = useState(car.mfkDate ?? "");

  const dirty =
    model !== car.model ||
    plate !== car.plate ||
    vin !== (car.vin ?? "") ||
    mfkDate !== (car.mfkDate ?? "");

  return (
    <Dialog
      open={open}
      onClose={() => {
        // Discard on close, so reopening shows what the server holds rather
        // than a half-typed edit from ten minutes ago.
        setModel(car.model);
        setPlate(car.plate);
        setVin(car.vin ?? "");
        setMfkDate(car.mfkDate ?? "");
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ model, plate, vin, mfkDate });
        }}
        className="mt-4 grid gap-3"
      >
        <Field label={L.fleet.model} value={model} onChange={setModel} />
        <Field label={L.fleet.plate} value={plate} onChange={setPlate} mono />
        <Field label={L.fleet.vinOptional} value={vin} onChange={setVin} mono />
        <Field
          label={L.fleet.mfkOptional}
          value={mfkDate}
          onChange={setMfkDate}
          type="date"
        />
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

function Field({
  label,
  value,
  onChange,
  mono,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      />
    </label>
  );
}
