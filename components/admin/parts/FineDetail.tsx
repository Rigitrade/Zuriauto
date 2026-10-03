"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { formatChf } from "@/lib/rental/money";

/**
 * One fine, everything the office needs to decide on it.
 *
 * The letter beside what was read from it, each value with how sure the
 * reader was and the line it came from — so checking the machine is a glance
 * across, not a search. Then the rentals either side of the moment, which is
 * where a boundary case is settled, and every action the fine allows.
 */

type FieldView = { value: unknown; status: string; snippet: string | null };

interface Detail {
  fine: {
    id: string;
    status: string;
    reviewReason: string | null;
    violationAt: string | null;
    violationTimeKnown: boolean;
    amountCents: number | null;
    issuerName: string | null;
    fineNumber: string | null;
    location: string | null;
    offenceTextDe: string | null;
    dueDate: string | null;
    reminderLevel: number;
    firstSeenAsReminder: boolean;
    handlingFeeCents: number;
    handlingFeeStatus: string;
    rentalId: string | null;
    closedNote: string | null;
    car: { id: string; plate: string; model: string } | null;
    customer: { firstName: string; lastName: string; email: string; phone: string } | null;
  };
  documents: {
    id: string;
    status: string;
    kind: string | null;
    uploadedAt: string;
    uploadedByName: string;
    extraction: (Record<string, FieldView> & { checks?: { name: string; passed: boolean; detail: string }[] }) | null;
  }[];
  proofs: { id: string; verdict: string; submittedAt: string; paidOn: string | null; accepted: boolean | null }[];
  events: { id: string; type: string; actorName: string | null; createdAt: string }[];
  candidates: { rentalId: string; from: string; to: string | null; renterName: string; email: string; phone: string }[];
}

const FIELDS = [
  "plateText",
  "violationDate",
  "violationTime",
  "location",
  "amountCents",
  "fineNumber",
  "paymentReference",
  "offenceCode",
  "issuerName",
  "dueDate",
  "letterDate",
] as const;

function zurich(iso: string, withTime = true): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** `YYYY-MM-DDTHH:mm` in Zurich, for the correction field. */
function zurichInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function shown(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "amountCents") return `CHF ${formatChf(Number(value))}`;
  return String(value);
}

const chip: Record<string, string> = {
  CONFIRMED: "bg-[var(--admin-good-soft)] text-[var(--admin-good)]",
  READ: "bg-[var(--admin-sunk)] text-[var(--admin-muted)]",
  DOUBTFUL: "bg-[var(--admin-attn-soft)] text-[var(--admin-attn)]",
  MISSING: "bg-[var(--admin-crit-soft)] text-[var(--admin-crit)]",
};

const button =
  "h-9 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm transition-colors hover:bg-[var(--admin-sunk)] disabled:opacity-50";
const primary =
  "h-9 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-50";

export function FineDetail({
  fineId,
  onBack,
  onChanged,
}: {
  fineId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { L, data, write, busy } = useAdmin();
  const F = L.fines;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<null | "moment" | "car" | "amount" | "close">(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/fines/${fineId}/`);
    if (!response.ok) return setFailed(true);
    setDetail(await response.json());
  }, [fineId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    const ok = await write(`/api/admin/fines/${fineId}/actions/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (ok) {
      setEditing(null);
      await load();
      onChanged();
    }
  }

  if (failed) return <p className="text-sm text-[var(--admin-crit)]">{L.errors.generic}</p>;
  if (!detail) return <p className="text-sm text-[var(--admin-faint)]">…</p>;

  const { fine } = detail;
  const latest = detail.documents.at(-1);
  const extraction = latest?.extraction ?? null;
  const failedChecks = extraction?.checks?.filter((check) => !check.passed) ?? [];
  const open = ["NEEDS_REVIEW", "NOTIFIED", "PROOF_SUBMITTED"].includes(fine.status);
  const label = (prefix: string, key: string | null) =>
    key ? ((F as Record<string, string>)[`${prefix}${key}`] ?? key) : "";

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={`${button} inline-flex items-center gap-1.5`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {F.back}
      </button>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {fine.car ? `${fine.car.plate} · ${fine.car.model}` : "—"}
          {fine.violationAt && (
            <span className="ml-2 font-normal text-[var(--admin-muted)]">
              {zurich(fine.violationAt, fine.violationTimeKnown)}
            </span>
          )}
        </h2>
        <span className="text-sm">
          <strong>{label("status", fine.status)}</strong>
          {fine.reviewReason && <span className="text-[var(--admin-attn)]"> · {label("reason", fine.reviewReason)}</span>}
          {fine.reminderLevel > 0 && <span className="text-[var(--admin-faint)]"> · {F.reminder} {fine.reminderLevel}</span>}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)]">
          <header className="flex items-center justify-between border-b border-[var(--admin-rule)] px-4 py-2.5 text-sm font-semibold">
            {F.letter}
            {latest && (
              <a href={`/api/admin/fines/documents/${latest.id}/file/`} target="_blank" rel="noreferrer" className="text-[var(--admin-muted)]">
                <ExternalLink className="h-4 w-4" aria-label={F.letter} />
              </a>
            )}
          </header>
          {latest ? (
            <iframe title={F.letter} src={`/api/admin/fines/documents/${latest.id}/file/`} className="h-[60vh] w-full lg:h-[75vh]" />
          ) : (
            <p className="p-4 text-sm text-[var(--admin-faint)]">—</p>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
            <h3 className="text-sm font-semibold">{F.fields}</h3>
            <dl className="mt-2 divide-y divide-[var(--admin-rule)] text-sm">
              {FIELDS.map((key) => {
                const field = extraction?.[key];
                if (!field) return null;
                return (
                  <div key={key} className="grid grid-cols-[7rem_1fr_auto] items-start gap-2 py-1.5">
                    <dt className="text-[var(--admin-faint)]">{label("field", key)}</dt>
                    <dd className="min-w-0">
                      <span className="break-words">{shown(key, field.value)}</span>
                      {field.snippet && field.status !== "CONFIRMED" && (
                        <span className="block truncate font-mono text-[0.6875rem] text-[var(--admin-faint)]" title={field.snippet}>
                          {field.snippet}
                        </span>
                      )}
                    </dd>
                    <span className={`rounded-full px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide ${chip[field.status] ?? ""}`}>
                      {label("fs", field.status)}
                    </span>
                  </div>
                );
              })}
            </dl>
            {failedChecks.length > 0 && (
              <div className="mt-3 rounded-md bg-[var(--admin-attn-soft)] p-2.5 text-xs text-[var(--admin-attn)]">
                <p className="font-semibold">{F.checks}</p>
                <ul className="mt-1 list-disc pl-4">
                  {failedChecks.map((check) => (
                    <li key={check.name}>
                      {check.name}: {check.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {detail.candidates.length > 0 && (
            <section className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
              <h3 className="text-sm font-semibold">{F.candidates}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {detail.candidates.map((c) => (
                  <li key={c.rentalId} className={`flex flex-wrap items-center justify-between gap-2 rounded-md p-2 ${c.rentalId === fine.rentalId ? "bg-[var(--admin-accent-soft)]" : "bg-[var(--admin-sunk)]"}`}>
                    <span>
                      <strong>{c.renterName}</strong>
                      <span className="block text-xs text-[var(--admin-faint)]">
                        {zurich(c.from)} – {c.to ? zurich(c.to) : F.stillOut} · {c.email}
                      </span>
                    </span>
                    {open && c.rentalId !== fine.rentalId && (
                      <button type="button" disabled={busy} className={button} onClick={() => act({ action: "assign", rentalId: c.rentalId })}>
                        {F.assign}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3 rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
            {fine.customer && (
              <p className="text-sm">
                {fine.customer.firstName} {fine.customer.lastName} · {fine.customer.email}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {open && fine.rentalId && fine.status !== "PROOF_SUBMITTED" && (
                <button type="button" disabled={busy} className={primary} onClick={() => act({ action: "send" })}>
                  {F.send}
                </button>
              )}
              {open && (
                <>
                  <button type="button" disabled={busy} className={button} onClick={() => { setEditing("moment"); setDraft(fine.violationAt ? zurichInput(fine.violationAt) : ""); }}>
                    {F.correct}: {F.correctMoment}
                  </button>
                  <button type="button" disabled={busy} className={button} onClick={() => { setEditing("car"); setDraft(fine.car?.id ?? ""); }}>
                    {F.correct}: {F.correctCar}
                  </button>
                  <button type="button" disabled={busy} className={button} onClick={() => { setEditing("amount"); setDraft(fine.amountCents ? formatChf(fine.amountCents) : ""); }}>
                    {F.correct}: {F.correctAmount}
                  </button>
                  <button type="button" disabled={busy} className={button} onClick={() => act({ action: "markPaid" })}>
                    {F.markPaid}
                  </button>
                  <button type="button" disabled={busy} className={button} onClick={() => { setEditing("close"); setDraft(""); }}>
                    {F.close}
                  </button>
                </>
              )}
              {fine.status !== "VOID" && (
                <button type="button" disabled={busy} className={button} onClick={() => act({ action: "void" })}>
                  {F.void}
                </button>
              )}
              {!open && (
                <button type="button" disabled={busy} className={button} onClick={() => act({ action: "reopen" })}>
                  {F.reopen}
                </button>
              )}
            </div>

            {editing && (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing === "close") return act({ action: "close", note: draft });
                  if (editing === "moment") return act({ action: "correct", field: "violationAt", value: draft });
                  if (editing === "car") return act({ action: "correct", field: "carId", value: draft });
                  const cents = Math.round(Number(draft.replace(/['\s]/g, "").replace(",", ".")) * 100);
                  return act({ action: "correct", field: "amountCents", value: cents });
                }}
              >
                {editing === "car" ? (
                  <select value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 rounded-md border border-[var(--admin-rule-strong)] bg-transparent px-2 text-sm">
                    {(data?.cars ?? []).map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.plate} · {car.model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={editing === "moment" ? "datetime-local" : "text"}
                    value={draft}
                    placeholder={editing === "close" ? F.closeNote : undefined}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-9 min-w-[14rem] flex-1 rounded-md border border-[var(--admin-rule-strong)] bg-transparent px-2 text-sm"
                  />
                )}
                <button type="submit" disabled={busy || !draft} className={primary}>
                  {F.save}
                </button>
                <button type="button" className={button} onClick={() => setEditing(null)}>
                  {F.cancel}
                </button>
              </form>
            )}

            {fine.handlingFeeCents > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  {F.fee}: CHF {formatChf(fine.handlingFeeCents)} · {fine.handlingFeeStatus}
                </span>
                {fine.handlingFeeStatus === "DUE" && (
                  <>
                    <button type="button" disabled={busy} className={button} onClick={() => act({ action: "feePaid" })}>
                      {F.feePaid}
                    </button>
                    <button type="button" disabled={busy} className={button} onClick={() => act({ action: "feeWaived" })}>
                      {F.feeWaived}
                    </button>
                  </>
                )}
              </div>
            )}
            {fine.closedNote && <p className="text-sm text-[var(--admin-muted)]">{fine.closedNote}</p>}
          </section>

          {detail.proofs.length > 0 && (
            <section className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
              <h3 className="text-sm font-semibold">{F.proofs}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {detail.proofs.map((proof) => (
                  <li key={proof.id} className="flex flex-wrap items-center justify-between gap-2">
                    <a href={`/api/admin/fines/proofs/${proof.id}/file/`} target="_blank" rel="noreferrer" className="underline">
                      {zurich(proof.submittedAt)} ·{" "}
                      {proof.verdict === "MATCH" ? F.proofMatch : proof.verdict === "UNREADABLE" ? F.proofUnreadable : F.proofMismatch}
                    </a>
                    {fine.status === "PROOF_SUBMITTED" && proof.accepted === null && (
                      <span className="flex gap-2">
                        <button type="button" disabled={busy} className={primary} onClick={() => act({ action: "acceptProof", proofId: proof.id })}>
                          {F.acceptProof}
                        </button>
                        <button type="button" disabled={busy} className={button} onClick={() => act({ action: "rejectProof", proofId: proof.id })}>
                          {F.rejectProof}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
            <h3 className="text-sm font-semibold">{F.timeline}</h3>
            <ol className="mt-2 space-y-1 text-xs text-[var(--admin-muted)]">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <span className="tabular-nums">{zurich(event.createdAt)}</span> · {event.type} · {event.actorName ?? F.system}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

