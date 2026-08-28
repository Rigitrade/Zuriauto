"use client";

import { useState } from "react";
import { day } from "@/components/admin/format";
import type { Labels, Rental } from "@/components/admin/types";

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

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-medium text-slate-900">
          {rental.carPlate} · {rental.customerName}
          {/* The renter has filled in the return form; the car stays marked
              rented until somebody here confirms it. */}
          {rental.returnSubmittedAt && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {L.rentals.returned}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {day(rental.startAt)} – {day(rental.endAt)}
          {rental.contractNumber ? ` · ${rental.contractNumber}` : ""}
          {rental.returnSubmittedAt
            ? ` · ${L.rentals.returnedOn} ${day(rental.returnSubmittedAt)}${
                rental.returnContractNumber ? ` · ${rental.returnContractNumber}` : ""
              }`
            : ""}
        </p>
      </div>

      {/* Confirmed, because it moves two rows and is an override rather than
          the return protocol. */}
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
          >
            {L.rentals.closeConfirm}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
          >
            {L.rentals.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-10 rounded-md px-3 text-sm text-slate-600 underline"
        >
          {L.rentals.close}
        </button>
      )}
    </li>
  );
}
