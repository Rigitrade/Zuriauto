"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CircleSlash,
  Gauge,
  IdCard,
  KeyRound,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { CarMaintenance } from "./CarMaintenance";
import { DateField } from "./DateField";
import { EditCarDialog } from "./EditCarDialog";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "./RowMenu";
import { mfkStanding } from "@/lib/admin/mfk";
import { formatKm, kmUntilService, serviceStanding } from "@/lib/admin/service";
import { day } from "@/components/admin/format";
import { ColourDot } from "@/components/ui/colour-dot";
import type { AdminLanguage } from "@/lib/admin/labels";
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
  language,
  busy,
  onSave,
  onDelete,
  onAddRepair,
  onUpdateRepair,
  onDeleteRepair,
  onUploadPhoto,
  onRemovePhoto,
  onUploadLicence,
  onRemoveLicence,
  onMarkOut,
}: {
  car: Car;
  L: Labels;
  language: AdminLanguage;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onMarkOut: (body: Record<string, string>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onAddRepair: (body: Record<string, string>) => Promise<boolean>;
  onUpdateRepair: (id: string, body: Record<string, string>) => Promise<boolean>;
  onDeleteRepair: (id: string) => Promise<boolean>;
  onUploadPhoto: (blob: Blob) => Promise<boolean>;
  onRemovePhoto: () => Promise<boolean>;
  onUploadLicence: (file: Blob) => Promise<boolean>;
  onRemoveLicence: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  const [markingOut, setMarkingOut] = useState(false);
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
        language={language}
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
        onUploadLicence={onUploadLicence}
        onRemoveLicence={onRemoveLicence}
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

      <MarkOutDialog
        car={car}
        L={L}
        busy={busy}
        open={markingOut}
        onClose={() => setMarkingOut(false)}
        onMarkOut={async (body) => {
          const ok = await onMarkOut(body);
          if (ok) setMarkingOut(false);
          return ok;
        }}
      />

      <tr className="border-t border-[var(--admin-rule)] transition-colors hover:bg-[var(--admin-sunk)]/50">
        {/* The model is the way into the car's profile. A row that opens
            something on click needs one obvious target rather than a whole
            clickable row — the row already carries a menu, a status chip and
            seven columns of figures, and making all of it navigate would put
            a page change one stray click from every one of them. */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <ColourDot colour={car.colour} language={language} />
            <Link
              href={`/admin/vehicles/${car.id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {car.model}
            </Link>
          </div>
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
              {/* The profile, for somebody who came to the menu rather than
                  to the model. The same destination the model links to — a
                  menu that omitted it would make the link the only way in,
                  and a link is not where people look for "show me
                  everything". */}
              <RowMenuItem
                icon={<IdCard className="h-4 w-4" aria-hidden="true" />}
                href={`/admin/vehicles/${car.id}`}
              >
                {L.fleet.profileOpen}
              </RowMenuItem>

              <RowMenuSeparator />

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

              {/* Only for a car the fleet believes is free. It is the one
                  action here that creates a rental rather than changing a
                  status, and it exists because a car that went out on paper
                  cannot otherwise be handed back: the return form lists cars
                  that are `rented`, and the return itself needs an open
                  rental to attach the protocol to. */}
              {car.status === "available" && (
                <RowMenuItem
                  icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                  onSelect={() => setMarkingOut(true)}
                >
                  {L.fleet.markOut}
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
 * Recording that a car is already out, with nothing on paper to say so.
 *
 * The office hit this on the first day: vehicles left the yard before the
 * system existed, the return form lists only cars whose status is `rented`,
 * and so there was no way to hand them back. Flipping the status alone would
 * have been worse than nothing — the car would appear in the picker, the
 * renter would sign a return protocol and be emailed a PDF, and the server
 * would find no open rental and write none of it down.
 *
 * So this creates the missing rental. Three fields, one of them optional,
 * because the honest answer to "who has it" is often that nobody wrote it
 * down — and a form that insisted would be answered with a guess.
 */
function MarkOutDialog({
  car,
  L,
  busy,
  open,
  onClose,
  onMarkOut,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onMarkOut: (body: Record<string, string>) => Promise<boolean>;
}) {
  // Zurich, not the browser: a laptop set to another zone would default the
  // form to yesterday, and "out since" is the one field nobody re-reads.
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
  }).format(new Date());

  const [renterName, setRenterName] = useState("");
  const [startAt, setStartAt] = useState(today);
  const [endAt, setEndAt] = useState("");

  const reversed = endAt !== "" && endAt < startAt;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${L.fleet.markOutHeading} · ${car.plate}`}
      closeLabel={L.fleet.close}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onMarkOut({
            // Omitted rather than sent empty: the schema treats the key as
            // absent, and an empty string would be a name of no characters.
            ...(renterName.trim() && { renterName: renterName.trim() }),
            startAt,
            endAt,
          });
        }}
        className="grid gap-4"
      >
        <p className="text-sm text-[var(--admin-muted)]">{L.fleet.markOutHint}</p>

        <label className="grid gap-1">
          <span className="text-xs text-[var(--admin-muted)]">
            {L.fleet.markOutRenter}
          </span>
          <input
            value={renterName}
            onChange={(event) => setRenterName(event.target.value)}
            maxLength={120}
            autoFocus
            className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
          />
          <span className="text-xs text-[var(--admin-faint)]">
            {L.fleet.markOutRenterHint}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label={L.fleet.markOutFrom}
            value={startAt}
            onChange={setStartAt}
            max={today}
            placeholder={L.fleet.datePlaceholder}
            invalidHint={L.fleet.dateInvalid}
          />

          {/* `max` today on the one above and `min` today on this one, both
              matching the server. A return date already past would have the
              daily pass mail the renter an overdue notice the next morning —
              for a rental the office had only just written down in order to
              close it. */}
          <DateField
            label={L.fleet.markOutUntil}
            value={endAt}
            onChange={setEndAt}
            min={today}
            placeholder={L.fleet.datePlaceholder}
            invalidHint={L.fleet.dateInvalid}
          />
        </div>

        {reversed && (
          <p className="text-xs text-[var(--admin-crit)]">
            {L.errors.endBeforeStart}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || reversed || startAt === "" || endAt === ""}
            className="h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {L.fleet.markOut}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 text-sm text-[var(--admin-muted)] underline"
          >
            {L.fleet.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
