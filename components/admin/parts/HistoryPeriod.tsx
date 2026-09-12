"use client";

import { useState } from "react";
import { FileText, Mail, Phone } from "lucide-react";
import { day } from "@/components/admin/format";
import { DocumentsDialog } from "./DocumentsDialog";
import type { CarPeriod, Labels } from "@/components/admin/types";

/**
 * One stretch of a car's life, and who was holding it.
 *
 * A stacked block rather than a table row, for the reason RentalRow already
 * gives: this is read at the desk with a fine in hand as often as on a laptop.
 *
 * The contact details are the point of the row. A traffic fine has to be
 * forwarded to somebody, and the previous route to a past renter's number was
 * the database — so the phone and the email are on the row itself, as links
 * that dial and compose, not behind another click.
 *
 * A cancelled period is kept and labelled rather than hidden. The car never
 * left the yard on one of those, and a row that did not say so is exactly how
 * somebody else's fine lands on the person who happened to sign.
 */
export function HistoryPeriod({
  period,
  L,
  highlight,
}: {
  period: CarPeriod;
  L: Labels;
  /** True when a window was searched: every row shown is then an answer to
   *  it, and reads as one rather than as a line of a long list. */
  highlight: boolean;
}) {
  const [showingDocuments, setShowingDocuments] = useState(false);
  const cancelled = period.status === "CANCELLED";

  const statuses = L.history.statuses as Record<string, string>;
  const status = statuses[period.status] ?? period.status;

  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t border-[var(--admin-rule)] px-4 py-3.5 first:border-t-0 ${
        highlight ? "bg-[var(--admin-accent-soft)]" : ""
      }`}
    >
      <DocumentsDialog
        rental={period}
        L={L}
        open={showingDocuments}
        onClose={() => setShowingDocuments(false)}
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`font-medium ${
              cancelled ? "text-[var(--admin-muted)] line-through" : ""
            }`}
          >
            {period.customerName}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              cancelled
                ? "bg-[var(--admin-attn-soft)] text-[var(--admin-attn)] ring-[var(--admin-attn)]/20"
                : "bg-[var(--admin-sunk)] text-[var(--admin-muted)] ring-[var(--admin-rule-strong)]"
            }`}
          >
            {status}
          </span>
        </p>

        <p className="mt-1 text-sm tabular-nums text-[var(--admin-muted)]">
          {day(period.startAt)} – {day(period.endAt)}
        </p>

        {cancelled ? (
          <p className="mt-1 text-xs text-[var(--admin-attn)]">
            {L.history.cancelledHint}
          </p>
        ) : (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--admin-muted)]">
            <a
              href={`tel:${period.customerPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-[var(--admin-ink)] hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">{period.customerPhone}</span>
            </a>
            <a
              href={`mailto:${period.customerEmail}`}
              className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-[var(--admin-ink)] hover:underline"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{period.customerEmail}</span>
            </a>
          </p>
        )}

        <p className="mt-1 text-xs tabular-nums text-[var(--admin-faint)]">
          {period.contractNumber ?? L.history.noContract}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowingDocuments(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {L.history.documents}
      </button>
    </li>
  );
}
