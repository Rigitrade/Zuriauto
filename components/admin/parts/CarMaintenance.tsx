"use client";

import { useState } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { day } from "@/components/admin/format";
import { formatKm, kmUntilService, serviceStanding } from "@/lib/admin/service";
import { formatChf } from "@/lib/rental/money";
import type { Car, Labels, Repair } from "@/components/admin/types";

/**
 * Everything about a car that is not its identity.
 *
 * A second dialog rather than more fields in the edit one, because the two are
 * opened for different reasons and at different rates. The edit dialog is for
 * correcting a plate — something done once, at the desk, carefully. This one
 * is opened after a service, after a garage visit, and every time somebody
 * reads the odometer, which is most weeks. Mixing them would mean the frequent
 * job scrolling past the rare one.
 *
 * Two things live here, in the order the office needs them: the service
 * figures (the numbers the warnings are computed from) and the repair list
 * (the part that changes weekly).
 *
 * The car's photograph is deliberately *not* here. It sits with the model,
 * the plate and the chassis number in the edit dialog, because that is the
 * category it belongs to — what this car is, rather than what has been done
 * to it. It lived here briefly for no better reason than that this was the
 * dialog being built at the time.
 */

export function CarMaintenance({
  car,
  L,
  busy,
  open,
  onClose,
  onSave,
  onAddRepair,
  onUpdateRepair,
  onDeleteRepair,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onAddRepair: (body: Record<string, string>) => Promise<boolean>;
  onUpdateRepair: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDeleteRepair: (id: string) => Promise<boolean>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${L.fleet.maintenanceFor} ${car.model} · ${car.plate}`}
      closeLabel={L.fleet.close}
    >
      <div className="grid gap-6">
        <ServiceFields car={car} L={L} busy={busy} onSave={onSave} />
        <RepairList
          car={car}
          L={L}
          busy={busy}
          onAdd={onAddRepair}
          onUpdate={onUpdateRepair}
          onDelete={onDeleteRepair}
        />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// The service figures.
// ---------------------------------------------------------------------

function ServiceFields({
  car,
  L,
  busy,
  onSave,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
}) {
  // Blank rather than "0" for a figure nobody has recorded. A zero here is a
  // reading, and saving the form would turn "unknown" into "this car has
  // covered no distance".
  const asField = (value: number | null | undefined) =>
    typeof value === "number" ? String(value) : "";

  const [mileage, setMileage] = useState(asField(car.currentMileageKm));
  const [doneKm, setDoneKm] = useState(asField(car.serviceDoneKm));
  const [dueKm, setDueKm] = useState(asField(car.serviceDueKm));
  const [doneOn, setDoneOn] = useState(car.serviceDoneOn ?? "");

  const dirty =
    mileage !== asField(car.currentMileageKm) ||
    doneKm !== asField(car.serviceDoneKm) ||
    dueKm !== asField(car.serviceDueKm) ||
    doneOn !== (car.serviceDoneOn ?? "");

  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
        {L.fleet.service}
      </h3>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          // Every field, every time. The endpoint only writes what changed
          // where it matters — see its note on the mileage read stamp.
          void onSave({
            currentMileageKm: mileage,
            serviceDoneKm: doneKm,
            serviceDueKm: dueKm,
            serviceDoneOn: doneOn,
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <NumberField
          label={L.fleet.mileage}
          value={mileage}
          onChange={setMileage}
        />
        <NumberField
          label={L.fleet.serviceDue}
          value={dueKm}
          onChange={setDueKm}
        />
        <NumberField
          label={L.fleet.serviceDone}
          value={doneKm}
          onChange={setDoneKm}
        />
        <DateField
          label={L.fleet.serviceDoneOn}
          value={doneOn}
          onChange={setDoneOn}
        />

        <p className="text-xs text-[var(--admin-faint)] sm:col-span-2">
          {L.fleet.serviceHint}
        </p>

        {/* What the two figures currently add up to, so the office can see the
            warning they are about to create before they save it. */}
        <ServiceSummary car={car} L={L} />

        <button
          type="submit"
          disabled={busy || !dirty}
          className="h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40 sm:col-span-2"
        >
          {L.fleet.save}
        </button>
      </form>
    </section>
  );
}

function ServiceSummary({ car, L }: { car: Car; L: Labels }) {
  const standing = serviceStanding(car);
  const remaining = kmUntilService(car);

  return (
    <dl className="grid gap-1 rounded-md bg-[var(--admin-sunk)] p-3 text-xs sm:col-span-2">
      <div className="flex justify-between gap-3">
        <dt className="text-[var(--admin-faint)]">{L.fleet.mileageRead}</dt>
        <dd className="text-[var(--admin-muted)]">
          {car.mileageReadAt ? day(car.mileageReadAt) : L.fleet.mileageNever}
        </dd>
      </div>
      {remaining !== null && (
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--admin-faint)]">{L.fleet.serviceDueShort}</dt>
          <dd
            className={
              standing === "overdue"
                ? "font-medium text-[var(--admin-crit)]"
                : standing === "due"
                  ? "font-medium text-[var(--admin-attn)]"
                  : "text-[var(--admin-muted)]"
            }
          >
            {remaining > 0
              ? `${L.fleet.serviceIn} ${formatKm(remaining)} km`
              : `${L.fleet.serviceOverdueBy} ${formatKm(Math.abs(remaining))} km`}
          </dd>
        </div>
      )}
    </dl>
  );
}

// ---------------------------------------------------------------------
// Repairs.
// ---------------------------------------------------------------------

function RepairList({
  car,
  L,
  busy,
  onAdd,
  onUpdate,
  onDelete,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onAdd: (body: Record<string, string>) => Promise<boolean>;
  onUpdate: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const repairs = car.repairs ?? [];
  const planned = repairs.filter((repair) => repair.status === "planned");
  const done = repairs.filter((repair) => repair.status === "done");

  return (
    <section className="grid gap-3 border-t border-[var(--admin-rule)] pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
        {L.fleet.repairs}
      </h3>

      <AddRepair L={L} busy={busy} onAdd={onAdd} />

      {repairs.length === 0 ? (
        <p className="text-xs text-[var(--admin-faint)]">{L.fleet.repairsNone}</p>
      ) : (
        <div className="grid gap-3">
          {/* Outstanding work first and history underneath, never interleaved:
              "what still has to happen to this car" is the question this list
              is opened to answer. */}
          <RepairGroup
            heading={L.fleet.repairsPlanned}
            repairs={planned}
            L={L}
            busy={busy}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
          <RepairGroup
            heading={L.fleet.repairsDone}
            repairs={done}
            L={L}
            busy={busy}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      )}
    </section>
  );
}

function RepairGroup({
  heading,
  repairs,
  L,
  busy,
  onUpdate,
  onDelete,
}: {
  heading: string;
  repairs: Repair[];
  L: Labels;
  busy: boolean;
  onUpdate: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  if (repairs.length === 0) return null;

  return (
    <div className="grid gap-1.5">
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-[var(--admin-faint)]">
        {heading} · {repairs.length}
      </h4>
      <ul className="grid gap-1.5">
        {repairs.map((repair) => (
          <RepairRow
            key={repair.id}
            repair={repair}
            L={L}
            busy={busy}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function RepairRow({
  repair,
  L,
  busy,
  onUpdate,
  onDelete,
}: {
  repair: Repair;
  L: Labels;
  busy: boolean;
  onUpdate: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const isDone = repair.status === "done";

  // The one line underneath: when, at what reading, what it cost, who wrote
  // it. Assembled rather than laid out in a grid, because most repairs have
  // one of the four and a grid of empty cells reads as missing data.
  const facts = [
    isDone
      ? repair.doneOn && day(repair.doneOn)
      : repair.plannedFor && day(repair.plannedFor),
    typeof repair.mileageKm === "number" && `${formatKm(repair.mileageKm)} km`,
    typeof repair.costCents === "number" && `CHF ${formatChf(repair.costCents)}`,
    `${L.fleet.repairBy} ${repair.createdBy}`,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-2 rounded-md border border-[var(--admin-rule)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${isDone ? "text-[var(--admin-muted)]" : "font-medium"}`}
        >
          {repair.details}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--admin-faint)]">
          {facts.join(" · ")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onUpdate(repair.id, { status: isDone ? "planned" : "done" })
          }
          aria-label={isDone ? L.fleet.repairReopen : L.fleet.repairMarkDone}
          title={isDone ? L.fleet.repairReopen : L.fleet.repairMarkDone}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--admin-faint)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-good)] disabled:opacity-40"
        >
          {isDone ? (
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {confirming ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!(await onDelete(repair.id))) setConfirming(false);
              }}
              className="h-7 rounded-md bg-[var(--admin-crit)] px-2 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {L.fleet.deleteConfirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-7 px-1 text-[11px] text-[var(--admin-muted)] underline"
            >
              {L.fleet.cancel}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={L.fleet.repairDelete}
            title={L.fleet.repairDelete}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--admin-faint)] transition-colors hover:bg-[var(--admin-crit-soft)] hover:text-[var(--admin-crit)]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

function AddRepair({
  L,
  busy,
  onAdd,
}: {
  L: Labels;
  busy: boolean;
  onAdd: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  /** One date input for two columns. Which one it fills is decided by the
   *  "already done" box below it — a repair cannot be both planned for a day
   *  and completed on a different one at the moment it is first written down. */
  const [when, setWhen] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [costChf, setCostChf] = useState("");
  const [alreadyDone, setAlreadyDone] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-dashed border-[var(--admin-rule-strong)] px-3 text-xs font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {L.fleet.repairAdd}
      </button>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await onAdd({
          details,
          status: alreadyDone ? "done" : "planned",
          /**
           * The single date input fills whichever column the box selects, and
           * the other key is left out entirely rather than sent empty.
           *
           * The distinction matters: an empty string means "clear this", and
           * on a repair being entered as already done with no date given, a
           * cleared `doneOn` would beat the rule that dates it today — leaving
           * a done repair with no date, which is invisible in a history read
           * as a chronology. Omitting the key means "not given", which is what
           * is actually true here.
           */
          ...(alreadyDone
            ? when && { doneOn: when }
            : when && { plannedFor: when }),
          mileageKm,
          costChf,
        });
        if (!ok) return;
        // Cleared only on success, so a refused entry is still on screen to
        // correct — the same reasoning the add-a-vehicle dialog follows.
        setDetails("");
        setWhen("");
        setMileageKm("");
        setCostChf("");
        setAlreadyDone(false);
        setOpen(false);
      }}
      className="grid gap-2 rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]/40 p-3"
    >
      <label className="grid gap-1">
        <span className="text-xs text-[var(--admin-muted)]">
          {L.fleet.repairDetails}
        </span>
        <input
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={L.fleet.repairDetailsPlaceholder}
          autoFocus
          className="h-9 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
        />
      </label>

      {/* Two columns, not three, even though there are three fields.
          `sm:` is a viewport query, so inside a 32rem dialog it fires on any
          desktop and asks for tracks of about 143px — narrower than a date
          input can draw "mm/dd/yyyy" plus its calendar button. The cost box
          was pushed clean through the side of the dialog. Two tracks give the
          date the room it needs and drop the cost onto a second row. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <DateField
          label={alreadyDone ? L.fleet.repairDoneOn : L.fleet.repairPlannedFor}
          value={when}
          onChange={setWhen}
        />
        <NumberField
          label={L.fleet.repairMileage}
          value={mileageKm}
          onChange={setMileageKm}
        />
        <NumberField
          label={L.fleet.repairCost}
          value={costChf}
          onChange={setCostChf}
          decimal
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--admin-muted)]">
        <input
          type="checkbox"
          checked={alreadyDone}
          onChange={(event) => setAlreadyDone(event.target.checked)}
          className="h-3.5 w-3.5"
        />
        {/* Recording something already finished is common — somebody types up
            a garage invoice after the fact — and without this they would have
            to add it as planned and immediately tick it off. The endpoint
            dates it today unless a date is given. */}
        {L.fleet.repairsDone}
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !details.trim()}
          className="h-9 rounded-md bg-[var(--admin-accent)] px-3 text-xs font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {L.fleet.save}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 px-2 text-xs text-[var(--admin-muted)] underline"
        >
          {L.fleet.cancel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Fields.
// ---------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
}) {
  return (
    // `min-w-0` on both the label and the box inside it. A grid item defaults
    // to `min-width: auto`, which means it refuses to shrink below the widest
    // thing in it — so a track that is too narrow does not clip, it silently
    // widens the whole grid and pushes the last column out of the dialog.
    // Overflowing is never the behaviour wanted here: the dialog is a fixed
    // width and the field should fit it.
    <label className="grid min-w-0 gap-1">
      <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      <input
        // `inputMode` rather than `type="number"`, which on a desktop browser
        // adds spinners nobody wants on an odometer and silently discards the
        // value when somebody types a thousands separator into it. The schema
        // accepts the separators a Swiss keyboard produces; this only asks the
        // phone for the right keypad.
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm tabular-nums outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    // Same `min-w-0` pair as the number field, and this is the one that needs
    // it: a date input carries the widest intrinsic size of anything on the
    // form, because the browser draws the whole mask and a calendar button
    // whether or not there is room.
    <label className="grid min-w-0 gap-1">
      <span className="text-xs text-[var(--admin-muted)]">{label}</span>
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm tabular-nums outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20 disabled:opacity-40"
      />
    </label>
  );
}
