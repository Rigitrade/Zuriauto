"use client";

import { useState } from "react";
import { CalendarPlus, Check, FileText, Mail, Phone, X } from "lucide-react";
import { day } from "@/components/admin/format";
import { DocumentsDialog } from "./DocumentsDialog";
import { toZurichInput } from "@/lib/admin/rentalPeriod";
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
  busy,
  onSavePeriod,
}: {
  period: CarPeriod;
  L: Labels;
  /** True when a window was searched: every row shown is then an answer to
   *  it, and reads as one rather than as a line of a long list. */
  highlight: boolean;
  busy?: boolean;
  /** Called only for a period the endpoint will accept — see `editablePeriod`.
   *  Resolves false on refusal, so the form stays open with the typed dates
   *  still in it rather than discarding them. */
  onSavePeriod?: (body: { startAt: string; endAt: string }) => Promise<boolean>;
}) {
  const [showingDocuments, setShowingDocuments] = useState(false);
  const [editing, setEditing] = useState(false);
  const cancelled = period.status === "CANCELLED";
  // A rental imported from a PDF that states no term was written with both
  // ends on the same instant. That is the thing worth offering to fix, and
  // labelling it is clearer than an edit button with nothing to explain it.
  const openEnded = period.startAt === period.endAt;
  const editable = period.editablePeriod === true && onSavePeriod !== undefined;

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

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-[var(--admin-muted)]">
          <span>
            {day(period.startAt)} – {day(period.endAt)}
          </span>
          {editable && openEnded && (
            <span className="rounded-full bg-[var(--admin-attn-soft)] px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--admin-attn)] ring-1 ring-inset ring-[var(--admin-attn)]/25">
              {L.history.periodSame}
            </span>
          )}
        </p>

        {editing && onSavePeriod && (
          <PeriodForm
            period={period}
            L={L}
            busy={busy === true}
            onCancel={() => setEditing(false)}
            onSave={async (body) => {
              if (await onSavePeriod(body)) setEditing(false);
            }}
          />
        )}

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

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            {L.history.editPeriod}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowingDocuments(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {L.history.documents}
        </button>
      </div>
    </li>
  );
}

/**
 * Two boxes and a warning.
 *
 * Inline rather than in a dialog: the office is reading down a list of periods
 * to work out which one it is correcting, and a modal would cover the very
 * rows that answer that.
 *
 * `datetime-local` rather than `date`, because the start is genuinely known to
 * the minute — it is the moment the original PDF was created — and rounding it
 * to midnight to make the form tidier would throw away the one part of the
 * period the document actually supports.
 */
function PeriodForm({
  period,
  L,
  busy,
  onCancel,
  onSave,
}: {
  period: CarPeriod;
  L: Labels;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: { startAt: string; endAt: string }) => Promise<void>;
}) {
  // Zurich wall clock, never the browser's. A laptop set to another zone would
  // otherwise show, and then save, a different hour than the office means.
  const [startAt, setStartAt] = useState(() => toZurichInput(period.startAt));
  const [endAt, setEndAt] = useState(() => toZurichInput(period.endAt));

  // A string compare is a date compare for this format, and it avoids parsing
  // a half-typed value into a Date that reads as some year in the 200s.
  const reversed = startAt !== "" && endAt !== "" && endAt < startAt;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ startAt, endAt });
      }}
      className="mt-2.5 grid gap-2.5 rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]/40 p-3"
    >
      <p className="text-xs text-[var(--admin-faint)]">
        {L.history.editPeriodHint}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1">
          <span className="text-xs text-[var(--admin-muted)]">
            {L.history.periodStart}
          </span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm tabular-nums outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
          />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-xs text-[var(--admin-muted)]">
            {L.history.periodEnd}
          </span>
          <input
            type="datetime-local"
            value={endAt}
            min={startAt || undefined}
            onChange={(event) => setEndAt(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm tabular-nums outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
          />
        </label>
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
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--admin-accent)] px-3 text-xs font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {L.fleet.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--admin-muted)] underline"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {L.fleet.cancel}
        </button>
      </div>
    </form>
  );
}
