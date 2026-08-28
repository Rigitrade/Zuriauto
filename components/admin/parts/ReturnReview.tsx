"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import { Dialog } from "./Dialog";
import { day } from "@/components/admin/format";
import { formatChf } from "@/lib/rental/money";
import type { Labels, Rental } from "@/components/admin/types";

/**
 * What the renter actually wrote, before the office frees the car.
 *
 * The button behind this modal moves two rows and puts a vehicle back in the
 * picker. Until now it was pressed against a badge and a date: fuel level,
 * cleanliness, damage, fines and the settlement were collected, put in a PDF,
 * and shown to nobody. Every one of them decides whether money is owed.
 *
 * Two rules in how this renders:
 *
 *  - **A missing answer is a gap, not a "no".** An addendum submitted before
 *    those columns existed carries a mileage and a signature and nothing
 *    else. Showing "Key returned: No" for a question never asked would be a
 *    lie the office might act on.
 *  - **The answers that cost money are the loud ones.** Needs a wash, damage,
 *    fines, an unpaid balance and a withheld deposit are marked; everything
 *    normal stays quiet. A screen where everything is emphasised emphasises
 *    nothing.
 */
export function ReturnReview({
  rental,
  L,
  busy,
  open,
  onClose,
  onApprove,
}: {
  rental: Rental;
  L: Labels;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onApprove: () => Promise<boolean>;
}) {
  const r = rental.returnReport ?? null;
  const owed = r?.hasDuePayment && r.dueAmountCents ? r.dueAmountCents : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${L.ret.heading} · ${rental.customerName}`}
      closeLabel={L.rentals.cancel}
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--admin-faint)]">
          {rental.carModel} · <span className="font-mono">{rental.carPlate}</span>
          {rental.returnSubmittedAt
            ? ` · ${L.ret.submitted} ${day(rental.returnSubmittedAt)}`
            : ""}
          {rental.returnContractNumber ? ` · ${rental.returnContractNumber}` : ""}
        </p>

        {!r ? (
          <p className="rounded-md bg-[var(--admin-sunk)] px-3 py-2.5 text-sm text-[var(--admin-muted)]">
            {L.ret.notRecorded}
          </p>
        ) : (
          <>
            <Group title={L.ret.condition}>
              <Row
                label={L.ret.distance}
                value={
                  r.distanceKm === null
                    ? `${r.mileageKm.toLocaleString("de-CH")} km`
                    : `${r.distanceKm.toLocaleString("de-CH")} km`
                }
                hint={
                  r.distanceKm === null
                    ? undefined
                    : `${L.ret.mileage} ${r.mileageKm.toLocaleString("de-CH")}`
                }
              />
              <Row label={L.ret.fuel} value={r.fuelLevel.replace(/_/g, " ")} />
              <Row
                label={L.ret.cleanliness}
                value={
                  r.cleanliness === null
                    ? L.ret.unknown
                    : r.cleanliness === "clean"
                      ? L.ret.clean
                      : L.ret.needsWash
                }
                alert={r.cleanliness === "needsWash"}
              />
              <YesNo label={L.ret.papers} value={r.papersInside} L={L} alertWhen={false} />
              <YesNo label={L.ret.key} value={r.keyReturned} L={L} alertWhen={false} />
              <Row
                label={L.ret.damages}
                value={r.damageNotes.trim() || L.ret.noDamages}
                alert={Boolean(r.damageNotes.trim())}
              />
              {r.tickets !== null && (
                <Row
                  label={L.ret.tickets}
                  value={r.tickets ? r.ticketsNote.trim() || L.ret.yes : L.ret.no}
                  alert={r.tickets === true}
                />
              )}
            </Group>

            <Group title={L.ret.settlement}>
              <YesNo label={L.ret.fullyPaid} value={r.fullyPaid} L={L} alertWhen={false} />
              {r.paidAmountCents !== null && (
                <Row
                  label={L.ret.paid}
                  value={`CHF ${formatChf(r.paidAmountCents)}`}
                  hint={r.paidOn ? `${L.ret.paidOn} ${day(r.paidOn)}` : undefined}
                />
              )}
              {r.paymentMethods.length > 0 && (
                <Row label={L.ret.methods} value={r.paymentMethods.join(", ")} />
              )}
              {owed !== null && (
                <Row
                  label={L.ret.due}
                  value={`CHF ${formatChf(owed)}`}
                  hint={
                    [
                      r.dueDate ? `${L.ret.dueOn} ${day(r.dueDate)}` : null,
                      r.dueMethod,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  alert
                />
              )}
              <YesNo label={L.ret.deposit} value={r.depositBack} L={L} alertWhen={false} />
            </Group>
          </>
        )}

        {owed !== null && (
          <p className="flex items-start gap-2 rounded-md border border-[var(--admin-attn-rule)] bg-[var(--admin-attn-soft)] px-3 py-2.5 text-xs text-[var(--admin-attn)]">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {L.ret.willCharge} <strong>CHF {formatChf(owed)}</strong>
              {r?.dueDate ? `, ${L.ret.dueOn} ${day(r.dueDate)}` : ""}.
            </span>
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await onApprove()) onClose();
          }}
          className="h-11 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {L.ret.approve}
        </button>
        <p className="text-xs text-[var(--admin-faint)]">{L.rentals.closeHint}</p>
      </div>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
        {title}
      </h3>
      <dl className="divide-y divide-[var(--admin-rule)] overflow-hidden rounded-lg border border-[var(--admin-rule)]">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-3 py-2 text-sm ${
        alert ? "bg-[var(--admin-attn-soft)]" : ""
      }`}
    >
      <dt className="shrink-0 text-[var(--admin-muted)]">{label}</dt>
      <dd
        className={`text-right ${
          alert ? "font-semibold text-[var(--admin-attn)]" : ""
        }`}
      >
        {value}
        {hint && (
          <span className="block text-xs font-normal text-[var(--admin-faint)]">
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

/** A tri-state answer. `null` renders as a dash, never as "No". */
function YesNo({
  label,
  value,
  L,
  alertWhen,
}: {
  label: string;
  value: boolean | null;
  L: Labels;
  /** Which answer is the one worth flagging. */
  alertWhen: boolean;
}) {
  if (value === null) {
    return <Row label={label} value={L.ret.unknown} />;
  }
  return (
    <div
      className={`flex items-center justify-between gap-4 px-3 py-2 text-sm ${
        value === alertWhen ? "bg-[var(--admin-attn-soft)]" : ""
      }`}
    >
      <dt className="text-[var(--admin-muted)]">{label}</dt>
      <dd
        className={`flex items-center gap-1.5 font-medium ${
          value === alertWhen
            ? "text-[var(--admin-attn)]"
            : "text-[var(--admin-good)]"
        }`}
      >
        {value ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {value ? L.ret.yes : L.ret.no}
      </dd>
    </div>
  );
}
