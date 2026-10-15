"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { zurichDay } from "@/components/admin/format";
import { formatChf } from "@/lib/rental/money";
import type { Labels } from "@/components/admin/types";
import type { AccountItem, RentalAccount } from "@/lib/payments/account";

/**
 * The Mietkonto: one rental's money — the deposit, every week and what paid
 * it, the balance declared at the return, credits, and what is due, paid and
 * open (the ledger spec, decision 7).
 *
 * Three things the office does here, each confirmed first because each one
 * changes what a renter is asked to pay: record a payment that did not come
 * by TWINT ("Barzahlung erfassen"), reopen a week the cut-over settled, and
 * decide whether the weeks after an early return are still owed.
 *
 * Fetched when it opens, like the documents dialog: it is a per-rental
 * question, and the rentals list should not carry every rental's account.
 */

export interface AccountSubject {
  id: string;
  customerName: string;
}

const OPEN = ["SCHEDULED", "REQUESTED", "REMINDED", "OVERDUE"];

/** Today in Zurich as YYYY-MM-DD, the date input's own format. */
function todayZurich(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
}

/** "250", "250.50", "1'250,5" → cents; null for anything else. */
function toCents(text: string): number | null {
  const clean = text.replace(/['’\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}

interface Purpose {
  key: string;
  label: string;
  chargeId: string | null;
  depositCents: number;
  /** What the amount must be; null for a credit, which takes any amount. */
  expectedCents: number | null;
}

function purposesOf(account: RentalAccount, A: Labels["account"]): Purpose[] {
  const outstanding = Math.max(0, account.deposit.agreedCents - account.deposit.receivedCents);
  const owedOpen = account.items.filter((i) => i.owed && OPEN.includes(i.status));
  const list: Purpose[] = owedOpen.map((i) => ({
    key: `week:${i.chargeId}`,
    label: `${i.weekNumber === 0 ? A.returnBalance : `${A.purposeWeek} ${i.weekNumber}`} · CHF ${formatChf(i.amountCents)}`,
    chargeId: i.chargeId,
    depositCents: 0,
    expectedCents: i.amountCents,
  }));
  if (outstanding > 0) {
    list.push({
      key: "deposit",
      label: `${A.purposeDeposit} · CHF ${formatChf(outstanding)}`,
      chargeId: null,
      depositCents: outstanding,
      expectedCents: outstanding,
    });
    // The pickup case: deposit and the first week still open, in one payment.
    const first = owedOpen.find((i) => i.weekNumber >= 1);
    if (first) {
      list.push({
        key: `depositWeek:${first.chargeId}`,
        label: `${A.purposeDepositWeek} ${first.weekNumber} · CHF ${formatChf(outstanding + first.amountCents)}`,
        chargeId: first.chargeId,
        depositCents: outstanding,
        expectedCents: outstanding + first.amountCents,
      });
    }
  }
  list.push({ key: "credit", label: A.purposeCredit, chargeId: null, depositCents: 0, expectedCents: null });
  return list;
}

const toneClass = {
  ok: "text-[var(--admin-good)]",
  open: "text-[var(--admin-crit)]",
  attn: "text-[var(--admin-attn)]",
  muted: "text-[var(--admin-faint)]",
} as const;

function statusOf(i: AccountItem, A: Labels["account"], dueBy: number): { text: string; tone: keyof typeof toneClass } {
  if (i.status === "PAID") {
    const by = i.paidBy;
    const method = by ? ((A as Record<string, string>)[`method${by.method}`] ?? by.method) : null;
    return { text: [A.paid, by ? zurichDay(by.paidAt) : null, method].filter(Boolean).join(" · "), tone: "ok" };
  }
  if (i.status === "SETTLED") return { text: A.settled, tone: "muted" };
  if (i.status === "VOID") return { text: A.void, tone: "muted" };
  if (i.pendingAfterClose) return { text: A.pending, tone: "attn" };
  return { text: A.open, tone: new Date(i.dueDate).getTime() <= dueBy ? "open" : "muted" };
}

const heading = "mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]";
const box = "rounded-lg border border-[var(--admin-rule)]";
const smallButton =
  "inline-flex h-8 items-center rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--admin-sunk)] disabled:opacity-40";
const field = "h-9 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-2 text-sm";

type Confirming = { kind: "reopen"; chargeId: string } | { kind: "void" } | { kind: "keep" } | null;

export function RentalAccountDialog({
  rental,
  L,
  open,
  onClose,
}: {
  rental: AccountSubject;
  L: Labels;
  open: boolean;
  onClose: () => void;
}) {
  const { write, busy, message } = useAdmin();
  const A = L.account;
  const [account, setAccount] = useState<RentalAccount | null>(null);
  const [failed, setFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayZurich);
  const [method, setMethod] = useState("CASH");
  const [purposeKey, setPurposeKey] = useState("");
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch(`/api/admin/rentals/${rental.id}/account/`);
      if (!response.ok) throw new Error();
      setAccount(((await response.json()) as { account: RentalAccount }).account);
    } catch {
      setFailed(true);
    }
  }, [rental.id]);

  useEffect(() => {
    if (!open) return;
    setConfirming(null);
    setActionFailed(false);
    void load();
  }, [open, load]);

  const purposes = useMemo(() => (account ? purposesOf(account, A) : []), [account, A]);
  const purpose = purposes.find((p) => p.key === purposeKey) ?? purposes[0];
  const cents = toCents(amount);
  // TWINT's Transaktions-Nr., required so the payment's email is then a duplicate.
  const transactionOk = method !== "TWINT" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId.trim());
  const mismatch =
    purpose && purpose.expectedCents !== null && cents !== null && cents !== purpose.expectedCents
      ? A.amountMismatch.replace("{x}", formatChf(purpose.expectedCents))
      : null;

  const act = async (url: string, body: unknown) => {
    setActionFailed(false);
    const ok = await write(url, { method: "POST", body: JSON.stringify(body) });
    setConfirming(null);
    if (!ok) {
      setActionFailed(true);
      return false;
    }
    await load();
    return true;
  };

  const record = async () => {
    if (!purpose || cents === null || mismatch) return;
    const ok = await act(`/api/admin/rentals/${rental.id}/payments/`, {
      amountCents: cents,
      paidOn,
      method,
      chargeId: purpose.chargeId,
      depositCents: purpose.depositCents,
      note,
      ...(method === "TWINT" ? { transactionId: transactionId.trim() } : {}),
    });
    if (ok) {
      setAmount("");
      setNote("");
      setTransactionId("");
      setPurposeKey("");
    }
  };

  const now = Date.now();
  const weeks = account?.items.filter((i) => i.weekNumber >= 1) ?? [];
  const balance = account?.items.find((i) => i.weekNumber === 0) ?? null;
  const pendingCount = account?.items.filter((i) => i.pendingAfterClose).length ?? 0;
  const startedBeforeCutover =
    account?.cutoverAt !== null && account !== null && new Date(account.startAt) < new Date(account.cutoverAt ?? 0);
  const yesNo = (value: boolean | null) => (value === null ? "—" : value ? A.yes : A.no);

  return (
    <Dialog open={open} onClose={onClose} title={`${A.heading} · ${rental.customerName}`} closeLabel={A.cancel}>
      <div className="flex flex-col gap-5">
        {(failed || actionFailed) && (
          <p className="rounded-md bg-[var(--admin-crit-soft)] px-3 py-2 text-sm text-[var(--admin-crit)]">
            {(actionFailed && message) || L.errors.generic}
          </p>
        )}
        {!account && !failed && <p className="text-sm text-[var(--admin-faint)]">{A.loading}</p>}

        {account && (
          <>
            <p className="text-sm text-[var(--admin-muted)]">
              {account.carModel} · <span className="font-mono text-xs tabular-nums">{account.plate}</span> ·{" "}
              <span className="tabular-nums">
                {zurichDay(account.startAt)} – {zurichDay(account.closedAt ?? account.endAt)}
              </span>
            </p>

            <section>
              <h3 className={heading}>{A.deposit}</h3>
              <div className={`${box} px-3 py-2.5 text-sm`}>
                <p className="tabular-nums">
                  {A.agreed} CHF {formatChf(account.deposit.agreedCents)} · {A.received}{" "}
                  {account.deposit.receivedCents > 0 ? (
                    <>
                      CHF {formatChf(account.deposit.receivedCents)}
                      {account.deposit.payments.map((p) => (
                        <span key={p.paymentId} className="text-[var(--admin-muted)]">
                          {" "}
                          ({zurichDay(p.paidAt)}, {(A as Record<string, string>)[`method${p.method}`] ?? p.method})
                        </span>
                      ))}
                    </>
                  ) : account.deposit.agreedCents > 0 ? (
                    <span className={startedBeforeCutover ? "text-[var(--admin-faint)]" : "text-[var(--admin-attn)]"}>
                      {startedBeforeCutover ? A.beforeCutover : A.notReceived}
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
                {account.closedAt && (
                  <p className="mt-0.5 text-[var(--admin-muted)]">
                    {A.back}: {yesNo(account.deposit.back)}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className={heading}>{A.weeks}</h3>
              {weeks.length === 0 ? (
                <p className="text-sm text-[var(--admin-faint)]">{A.nothingOpen}</p>
              ) : (
                <ul className={`${box} divide-y divide-[var(--admin-rule)]`}>
                  {weeks.map((i) => {
                    const status = statusOf(i, A, now);
                    const reopening = confirming?.kind === "reopen" && confirming.chargeId === i.chargeId;
                    return (
                      <li key={i.chargeId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">
                            {A.week} {i.weekNumber}
                          </span>
                          <span className="ml-2 text-xs text-[var(--admin-faint)] tabular-nums">
                            {A.due} {zurichDay(i.dueDate)}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                          <span className="tabular-nums">CHF {formatChf(i.amountCents)}</span>
                          <span className={`text-xs ${toneClass[status.tone]}`}>{status.text}</span>
                          {i.status === "SETTLED" &&
                            (reopening ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                {A.reopenConfirm}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => act(`/api/admin/charges/${i.chargeId}/reopen/`, {})}
                                  className={smallButton}
                                >
                                  {A.confirm}
                                </button>
                                <button type="button" onClick={() => setConfirming(null)} className="underline underline-offset-2">
                                  {A.cancel}
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirming({ kind: "reopen", chargeId: i.chargeId })}
                                className={smallButton}
                              >
                                {A.reopen}
                              </button>
                            ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {pendingCount > 0 && (
              <section className="rounded-lg border border-[var(--admin-attn-rule)] bg-[var(--admin-attn-soft)] px-3 py-2.5 text-sm">
                <p>{A.decideIntro.replace("{n}", String(pendingCount))}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {confirming?.kind === "void" || confirming?.kind === "keep" ? (
                    <>
                      <span>
                        {(confirming.kind === "void" ? A.decideConfirmVoid : A.decideConfirmKeep).replace("{n}", String(pendingCount))}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(`/api/admin/rentals/${rental.id}/weeks-after-close/`, { choice: confirming.kind })}
                        className={smallButton}
                      >
                        {A.confirm}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-xs underline underline-offset-2">
                        {A.cancel}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setConfirming({ kind: "void" })} className={smallButton}>
                        {A.decideVoid}
                      </button>
                      <button type="button" onClick={() => setConfirming({ kind: "keep" })} className={smallButton}>
                        {A.decideKeep}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            {(balance || account.declaration) && (
              <section>
                <h3 className={heading}>{A.afterReturn}</h3>
                <div className={`${box} space-y-1 px-3 py-2.5 text-sm`}>
                  {balance && (
                    <p className="flex flex-wrap justify-between gap-x-3">
                      <span>
                        {A.returnBalance}
                        <span className="ml-2 text-xs text-[var(--admin-faint)] tabular-nums">
                          {A.due} {zurichDay(balance.dueDate)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">CHF {formatChf(balance.amountCents)}</span>
                        <span className={`text-xs ${toneClass[statusOf(balance, A, now).tone]}`}>{statusOf(balance, A, now).text}</span>
                      </span>
                    </p>
                  )}
                  {account.declaration && (
                    <p className="text-[var(--admin-muted)]">
                      {A.declaration}:{" "}
                      {[
                        account.declaration.fullyPaid ? A.declFullyPaid : null,
                        account.declaration.paidAmountCents
                          ? `${A.declPaid} CHF ${formatChf(account.declaration.paidAmountCents)}`
                          : null,
                        account.declaration.paymentMethods.length ? account.declaration.paymentMethods.join(", ") : null,
                        account.declaration.hasDuePayment && account.declaration.dueAmountCents
                          ? `${A.declOwes} CHF ${formatChf(account.declaration.dueAmountCents)}${
                              account.declaration.dueDate ? ` ${A.declUntil} ${zurichDay(account.declaration.dueDate)}` : ""
                            }`
                          : null,
                        `${A.deposit} ${A.back}: ${yesNo(account.declaration.depositBack)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </section>
            )}

            {account.credits.length > 0 && (
              <section>
                <h3 className={heading}>{A.credits}</h3>
                <ul className={`${box} divide-y divide-[var(--admin-rule)] text-sm`}>
                  {account.credits.map((c) => (
                    <li key={c.paymentId} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
                      <span className="text-[var(--admin-muted)]">
                        {zurichDay(c.paidAt)} · {(A as Record<string, string>)[`method${c.method}`] ?? c.method}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                      <span className="tabular-nums">CHF {formatChf(c.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className={heading}>{A.totals}</h3>
              <dl className={`${box} grid grid-cols-3 divide-x divide-[var(--admin-rule)] text-center text-sm`}>
                {[
                  [A.dueToDate, account.totals.dueToDateCents, ""],
                  [A.paidTotal, account.totals.paidCents, ""],
                  [A.openTotal, account.totals.openCents, account.totals.openCents > 0 ? "text-[var(--admin-crit)] font-semibold" : ""],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="px-2 py-2">
                    <dt className="text-xs text-[var(--admin-faint)]">{label}</dt>
                    <dd className={`tabular-nums ${tone}`}>CHF {formatChf(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className={heading}>{A.record}</h3>
              <div className={`${box} grid gap-3 px-3 py-3 sm:grid-cols-2`}>
                <label className="text-sm sm:col-span-2">
                  {A.purpose}
                  <select className={field} value={purpose?.key ?? ""} onChange={(e) => setPurposeKey(e.target.value)}>
                    {purposes.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {A.amount}
                  <input
                    className={`${field} tabular-nums`}
                    inputMode="decimal"
                    value={amount}
                    placeholder={purpose?.expectedCents ? formatChf(purpose.expectedCents) : ""}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  {A.date}
                  <input type="date" className={field} value={paidOn} max={todayZurich()} onChange={(e) => setPaidOn(e.target.value)} />
                </label>
                <label className="text-sm">
                  {A.method}
                  <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {(["CASH", "CARD", "BANK", "TWINT"] as const).map((m) => (
                      <option key={m} value={m}>
                        {A[`method${m}`]}
                      </option>
                    ))}
                  </select>
                </label>
                {method === "TWINT" && (
                  <label className="text-sm sm:col-span-2">
                    {A.transactionId}
                    <input
                      className={`${field} font-mono`}
                      value={transactionId}
                      placeholder="ce21e52e-2354-4f6d-…"
                      onChange={(e) => setTransactionId(e.target.value)}
                    />
                    <span className="mt-1 block text-xs text-[var(--admin-faint)]">{A.transactionHint}</span>
                  </label>
                )}
                <label className="text-sm">
                  {A.note}
                  <input className={field} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button
                    type="button"
                    disabled={busy || !purpose || cents === null || mismatch !== null || !paidOn || !transactionOk}
                    onClick={record}
                    className="inline-flex h-9 items-center rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] disabled:opacity-40"
                  >
                    {A.save}
                  </button>
                  {mismatch && <span className="text-xs text-[var(--admin-crit)]">{mismatch}</span>}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}
