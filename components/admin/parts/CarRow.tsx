"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
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
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rented = car.status === "rented";
  const retired = car.status === "retired";
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

        <td className="px-4 py-3 font-mono text-sm tabular-nums text-[var(--admin-muted)]">
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

        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <IconButton
              label={L.fleet.save}
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </IconButton>

            {/* A rented car has no status toggle at all: it is freed by closing
                its rental, so a disabled button here would only invite the
                question of why it does not work. */}
            {!rented && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSave({ status: retired ? "available" : "retired" })}
                className="h-8 rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-40"
              >
                {retired ? L.fleet.reactivate : L.fleet.retire}
              </button>
            )}

            {!rented &&
              (confirmingDelete ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!(await onDelete())) setConfirmingDelete(false);
                    }}
                    className="h-8 rounded-md bg-[var(--admin-crit)] px-2.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {L.fleet.deleteConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="h-8 rounded-md px-2 text-xs text-[var(--admin-muted)] underline"
                  >
                    {L.fleet.cancel}
                  </button>
                </span>
              ) : (
                <IconButton
                  label={L.fleet.delete}
                  onClick={() => setConfirmingDelete(true)}
                  danger
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              ))}
          </div>
        </td>
      </tr>
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40 ${
        danger
          ? "text-[var(--admin-faint)] hover:bg-[var(--admin-crit-soft)] hover:text-[var(--admin-crit)]"
          : "text-[var(--admin-faint)] hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function EditCarDialog({
  car,
  L,
  busy,
  open,
  onClose,
  onSave,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");

  const dirty =
    model !== car.model || plate !== car.plate || vin !== (car.vin ?? "");

  return (
    <Dialog
      open={open}
      onClose={() => {
        // Discard on close, so reopening shows what the server holds rather
        // than a half-typed edit from ten minutes ago.
        setModel(car.model);
        setPlate(car.plate);
        setVin(car.vin ?? "");
        onClose();
      }}
      title={`${car.model} · ${car.plate}`}
      closeLabel={L.fleet.cancel}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ model, plate, vin });
        }}
        className="grid gap-3"
      >
        <Field label={L.fleet.model} value={model} onChange={setModel} />
        <Field label={L.fleet.plate} value={plate} onChange={setPlate} mono />
        <Field label={L.fleet.vinOptional} value={vin} onChange={setVin} mono />
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      />
    </label>
  );
}
