"use client";

import { useState } from "react";
import { day } from "@/components/admin/format";
import type { Labels, Rental } from "@/components/admin/types";

/**
 * One open rental.
 *
 * A stacked block rather than a table row, on every width. A rental carries a
 * customer, a car, two dates, a contract number and sometimes a return — six
 * things, which is more than a table row survives on a phone, and the office
 * reads this list at the kerbside as often as at the desk.
 *
 * The returned badge is the loudest thing in the row on purpose: that rental's
 * car is still marked rented and stays that way until somebody here confirms.
 */
export function RentalRow({
  rental,
  L,
  busy,
  onClose,
}: {
  rental: Rental;
  L: Labels;
  busy: boolean;
  onClose: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const returned = Boolean(rental.returnSubmittedAt);

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t border-[var(--admin-rule)] px-4 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{rental.customerName}</span>
          {returned && (
            <span className="rounded-full bg-[var(--admin-attn-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-attn)] ring-1 ring-inset ring-[var(--admin-attn)]/20">
              {L.rentals.returned}
            </span>
          )}
        </p>

        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          {rental.carModel}
          <span className="mx-1.5 text-[var(--admin-rule-strong)]">·</span>
          <span className="font-mono text-xs tabular-nums">{rental.carPlate}</span>
        </p>

        <p className="mt-1 text-xs text-[var(--admin-faint)] tabular-nums">
          {day(rental.startAt)} – {day(rental.endAt)}
          {rental.contractNumber ? ` · ${rental.contractNumber}` : ""}
          {rental.returnSubmittedAt
            ? ` · ${L.rentals.returnedOn} ${day(rental.returnSubmittedAt)}${
                rental.returnContractNumber
                  ? ` · ${rental.returnContractNumber}`
                  : ""
              }`
            : ""}
        </p>
      </div>

      {/* Confirmed, because it moves two rows and is an override rather than
          the return protocol. */}
      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-9 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {L.rentals.closeConfirm}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-9 rounded-md px-2.5 text-sm text-[var(--admin-muted)] underline underline-offset-2"
          >
            {L.rentals.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors ${
            returned
              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-ink)] hover:opacity-90"
              : "border border-[var(--admin-rule-strong)] text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
          }`}
        >
          {L.rentals.close}
        </button>
      )}
    </li>
  );
}
