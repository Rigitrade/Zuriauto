"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { RentalAccountDialog, type AccountSubject } from "@/components/admin/parts/RentalAccountDialog";
import { zurichTime } from "@/components/admin/format";
import { formatChf } from "@/lib/rental/money";
import type { PaymentDetailData } from "@/lib/payments/queries";

/** One payment: what TWINT said, why it waits, and the choice to book it. */
export function PaymentDetail({
  paymentId,
  onBack,
  onChanged,
}: {
  paymentId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { L, write, busy } = useAdmin();
  const P = L.payments;
  const [detail, setDetail] = useState<PaymentDetailData | null>(null);
  const [rentalId, setRentalId] = useState<string>("");
  const [chargeId, setChargeId] = useState<string>("");
  const [note, setNote] = useState("");
  /** The rental whose Mietkonto is open: the booked one, or the one chosen to book to. */
  const [accountFor, setAccountFor] = useState<AccountSubject | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/payments/${paymentId}/`);
    if (!response.ok) return;
    const data: PaymentDetailData = await response.json();
    setDetail(data);
    const first = data.choices.find((c) => c.isCandidate) ?? data.choices[0];
    setRentalId(first?.rentalId ?? "");
    setChargeId(first?.openCharges.find((c) => c.amountCents === data.amountCents)?.id ?? "");
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!detail) return null;
  const choice = detail.choices.find((c) => c.rentalId === rentalId);
  const act = async (body: unknown) => {
    if (await write(`/api/admin/payments/${paymentId}/actions/`, { method: "POST", body: JSON.stringify(body) })) {
      await load();
      onChanged();
    }
  };
  const reason = detail.reviewReason ? ((P as Record<string, string>)[`reason${detail.reviewReason}`] ?? detail.reviewReason) : null;
  const field = "h-9 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-2 text-sm";
  const button = "inline-flex h-9 items-center rounded-md px-4 text-sm disabled:opacity-50";

  const accountLink = "ml-2 text-xs text-[var(--admin-muted)] underline underline-offset-2 hover:text-[var(--admin-ink)]";

  return (
    <div className="space-y-4">
      {accountFor && <RentalAccountDialog rental={accountFor} L={L} open onClose={() => setAccountFor(null)} />}
      <button type="button" onClick={onBack} className="text-sm text-[var(--admin-muted)] hover:underline">
        ← {P.back}
      </button>

      <Panel
        title={`CHF ${formatChf(detail.amountCents)} · ${zurichTime(detail.paidAt)}`}
        meta={(P as Record<string, string>)[`status${detail.status}`] ?? detail.status}
      >
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 px-4 py-3 text-sm">
          <dt className="text-[var(--admin-muted)]">{P.payer}</dt>
          <dd>{[detail.payerName, detail.payerEmail, detail.payerPhone].filter(Boolean).join(" · ") || "—"}</dd>
          <dt className="text-[var(--admin-muted)]">{P.message}</dt>
          <dd className="whitespace-pre-line">{detail.message ?? "—"}</dd>
          {reason && (
            <>
              <dt className="text-[var(--admin-muted)]">{P.why}</dt>
              <dd className="text-[var(--admin-crit)]">{reason}</dd>
            </>
          )}
          {detail.renterName && (
            <>
              <dt className="text-[var(--admin-muted)]">{P.renter}</dt>
              <dd>
                {[detail.renterName, detail.plate, detail.weekNumber ? `${P.week} ${detail.weekNumber}` : null]
                  .filter(Boolean)
                  .join(" · ")}
                {detail.rentalId && (
                  <button
                    type="button"
                    onClick={() => setAccountFor({ id: detail.rentalId!, customerName: detail.renterName! })}
                    className={accountLink}
                  >
                    {L.account.button}
                  </button>
                )}
              </dd>
            </>
          )}
        </dl>
      </Panel>

      {detail.status === "NEEDS_REVIEW" && (
        <Panel title={P.book}>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            <label className="text-sm">
              {P.chooseRental}
              <select
                className={field}
                value={rentalId}
                onChange={(e) => {
                  setRentalId(e.target.value);
                  setChargeId("");
                }}
              >
                {detail.choices.map((c) => (
                  <option key={c.rentalId} value={c.rentalId}>
                    {c.isCandidate ? "★ " : ""}
                    {c.renterName} · {c.plate} · {c.carModel}
                  </option>
                ))}
              </select>
              {choice && (
                <button
                  type="button"
                  onClick={() => setAccountFor({ id: choice.rentalId, customerName: choice.renterName })}
                  className={`${accountLink} ml-0 mt-1`}
                >
                  {L.account.button}
                </button>
              )}
            </label>
            <label className="text-sm">
              {P.chooseWeek}
              <select className={field} value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
                <option value="">{P.asCredit}</option>
                {(choice?.openCharges ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {P.week} {c.weekNumber} · CHF {formatChf(c.amountCents)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--admin-rule)] px-4 py-3">
            <button
              type="button"
              disabled={busy || !rentalId}
              onClick={() => act({ action: "book", rentalId, chargeId: chargeId || null })}
              className={`${button} bg-[var(--admin-accent)] text-[var(--admin-accent-ink)]`}
            >
              {P.book}
            </button>
            <input
              className={`${field} max-w-xs`}
              placeholder={P.ignoreNote}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => act({ action: "ignore", note })}
              className={`${button} border border-[var(--admin-rule-strong)]`}
            >
              {P.ignore}
            </button>
          </div>
        </Panel>
      )}

      {detail.status !== "NEEDS_REVIEW" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: "undo" })}
          className={`${button} border border-[var(--admin-rule-strong)]`}
        >
          {P.undo}
        </button>
      )}

      <Panel title={P.timeline}>
        <ul className="space-y-1 px-4 py-3 text-sm">
          {detail.events.map((e) => (
            <li key={`${e.type}-${e.createdAt}`}>
              {zurichTime(e.createdAt)} · {e.type} · {e.actorName ?? P.bySystem}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
