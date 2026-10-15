"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { RentalAccountDialog, type AccountSubject } from "@/components/admin/parts/RentalAccountDialog";
import { purposeText } from "./paymentText";
import { zurichTime } from "@/components/admin/format";
import { formatChf } from "@/lib/rental/money";
import type { Labels } from "@/components/admin/types";
import type { PaymentChoice, PaymentDetailData } from "@/lib/payments/queries";

interface BookOption {
  key: string;
  label: string;
  chargeId: string | null;
  depositCents: number;
  /** What it costs; null for a credit, which takes any amount. */
  expectedCents: number | null;
}

/** What a payment can be booked to on one rental: each open week, the deposit
 *  while it is outstanding, deposit + the first open week, or a credit. */
function bookOptions(choice: PaymentChoice | undefined, P: Labels["payments"]): BookOption[] {
  if (!choice) return [];
  const outstanding = Math.max(0, choice.depositCents - choice.depositReceivedCents);
  const weeks: BookOption[] = choice.openCharges.map((c) => ({
    key: `week:${c.id}`,
    label: `${c.weekNumber === 0 ? P.purposeReturnBalance : P.purposeWeek.replace("{n}", String(c.weekNumber))} · CHF ${formatChf(c.amountCents)}`,
    chargeId: c.id,
    depositCents: 0,
    expectedCents: c.amountCents,
  }));
  const deposit: BookOption[] = [];
  if (outstanding > 0) {
    deposit.push({
      key: "deposit",
      label: `${P.purposeDeposit} · CHF ${formatChf(outstanding)}`,
      chargeId: null,
      depositCents: outstanding,
      expectedCents: outstanding,
    });
    const first = choice.openCharges.find((c) => c.weekNumber >= 1);
    if (first) {
      deposit.push({
        key: `depositWeek:${first.id}`,
        label: `${P.purposeDepositWeek.replace("{n}", String(first.weekNumber))} · CHF ${formatChf(outstanding + first.amountCents)}`,
        chargeId: first.id,
        depositCents: outstanding,
        expectedCents: outstanding + first.amountCents,
      });
    }
  }
  return [...weeks, ...deposit, { key: "credit", label: P.asCredit, chargeId: null, depositCents: 0, expectedCents: null }];
}

/** The option the amount fits exactly, else a credit. */
function fitting(options: BookOption[], amountCents: number): string {
  return options.find((o) => o.expectedCents === amountCents)?.key ?? "credit";
}

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
  const [optionKey, setOptionKey] = useState<string>("credit");
  /** "Zahler merken": on by default when TWINT passed on an email or phone. */
  const [remember, setRemember] = useState(false);
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
    setOptionKey(fitting(bookOptions(first, L.payments), data.amountCents));
    setRemember(Boolean(data.payerEmail || data.payerPhone));
  }, [paymentId, L.payments]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!detail) return null;
  const choice = detail.choices.find((c) => c.rentalId === rentalId);
  const options = bookOptions(choice, P);
  const option = options.find((o) => o.key === optionKey) ?? options[options.length - 1];
  const amountWarning =
    option && option.expectedCents !== null && option.expectedCents !== detail.amountCents
      ? P.amountWarn.replace("{a}", formatChf(detail.amountCents)).replace("{b}", formatChf(option.expectedCents))
      : null;
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
                {[detail.renterName, detail.plate, purposeText(detail, P)]
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
                  const next = detail.choices.find((c) => c.rentalId === e.target.value);
                  setOptionKey(fitting(bookOptions(next, P), detail.amountCents));
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
              {P.purpose}
              <select className={field} value={option?.key ?? "credit"} onChange={(e) => setOptionKey(e.target.value)}>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {amountWarning && <p className="text-xs text-[var(--admin-attn)] sm:col-span-2">{amountWarning}</p>}
            {(detail.payerEmail || detail.payerPhone) && (
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-0.5" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>{P.rememberPayer}</span>
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--admin-rule)] px-4 py-3">
            <button
              type="button"
              disabled={busy || !rentalId}
              onClick={() =>
                act({
                  action: "book",
                  rentalId,
                  chargeId: option?.chargeId ?? null,
                  depositCents: option?.depositCents ?? 0,
                  rememberPayer: remember,
                })
              }
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
