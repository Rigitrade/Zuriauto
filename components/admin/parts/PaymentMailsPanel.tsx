"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Mail, Send, Wallet } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import type { AccountSubject } from "@/components/admin/parts/RentalAccountDialog";
import { formatChf } from "@/lib/rental/money";
import { zurichDay, zurichTime } from "@/components/admin/format";
import type { SentPaymentMailRow } from "@/lib/payments/mails";

/**
 * "E-Mails" on the payments page.
 *
 * Top: what the next daily run will write about payments — live, so the
 * office can record a cash payment *before* the email goes. When the safety
 * stop holds the run back, the banner and "Jetzt senden" are here.
 *
 * Below: every payment email sent in the last 60 days, next to what the week
 * is now. A wrong one (paid before, settled, waived, undelivered) is a
 * problem until the office answers it: a please-ignore correction, or done.
 */

interface NextRow {
  chargeId: string;
  rentalId: string;
  kind: "request" | "reminder";
  officeOnly: "returned" | "stale" | "noEmail" | null;
  renterName: string;
  email: string;
  plate: string;
  weekNumber: number;
  amountCents: number;
  dueDate: string;
}

interface MailsData {
  next: NextRow[];
  held: boolean;
  cap: number;
  sent: SentPaymentMailRow[];
}

type Confirming =
  { kind: "release" } | { kind: "correction"; id: string } | null;

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-50";
const strong =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] disabled:opacity-50";

export function PaymentMailsPanel({
  onOpenAccount,
}: {
  onOpenAccount: (subject: AccountSubject) => void;
}) {
  const { L, write, busy } = useAdmin();
  const P = L.payments;
  const t = (key: string) => (P as Record<string, string>)[key] ?? key;
  const [data, setData] = useState<MailsData | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(true);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/payments/mails/");
    if (response.ok) setData((await response.json()) as MailsData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (url: string, body: unknown) => {
    const ok = await write(url, { method: "POST", body: JSON.stringify(body) });
    setConfirming(null);
    if (ok) await load();
  };

  const openProblems = (data?.sent ?? []).filter(
    (r) => r.problem && !r.reviewedAt,
  );
  const sentRows = problemsOnly ? openProblems : (data?.sent ?? []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-muted)]">{P.mailsIntro}</p>

      <Panel
        title={P.nextHeading}
        meta={data ? String(data.next.length) : undefined}
      >
        {data?.held && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-crit)] bg-[var(--admin-crit-soft)] px-4 py-3 text-sm text-[var(--admin-crit)]">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {P.heldBanner
                .replace("{n}", String(data.next.length))
                .replace("{cap}", String(data.cap))}
            </span>
            {confirming?.kind === "release" ? (
              <span className="flex items-center gap-2">
                {P.releaseConfirm.replace("{n}", String(data.next.length))}
                <button
                  type="button"
                  disabled={busy}
                  className={strong}
                  onClick={() => post("/api/admin/payments/mails/release/", {})}
                >
                  {P.release}
                </button>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setConfirming(null)}
                >
                  {L.account.cancel}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={strong}
                onClick={() => setConfirming({ kind: "release" })}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {P.release}
              </button>
            )}
          </div>
        )}
        <p className="border-b border-[var(--admin-rule)] px-4 py-3 text-sm text-[var(--admin-muted)]">
          {P.nextIntro}
        </p>
        {data && data.next.length === 0 && (
          <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">
            {P.nextNone}
          </p>
        )}
        <ul className="divide-y divide-[var(--admin-rule)]">
          {(data?.next ?? []).map((row) => (
            <li
              key={`${row.chargeId}:${row.kind}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.renterName}</span>
                  <span className="font-mono text-xs tabular-nums text-[var(--admin-muted)]">
                    {row.plate}
                  </span>
                  {row.officeOnly && (
                    <span className="rounded-full bg-[var(--admin-attn-soft)] px-2 py-0.5 text-xs font-medium text-[var(--admin-attn)]">
                      {t(`officeOnly${row.officeOnly}`)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-[var(--admin-muted)]">
                  {row.kind === "request" ? P.kindRequest : P.kindReminder} ·{" "}
                  {P.week} {row.weekNumber} · CHF {formatChf(row.amountCents)} ·{" "}
                  {L.account.due} {zurichDay(row.dueDate)}
                </span>
              </span>
              <button
                type="button"
                className={button}
                onClick={() =>
                  onOpenAccount({
                    id: row.rentalId,
                    customerName: row.renterName,
                  })
                }
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                {L.account.button}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={P.sentHeading}
        meta={
          data
            ? problemsOnly
              ? String(openProblems.length)
              : String(data.sent.length)
            : undefined
        }
        action={
          <nav className="flex gap-1" aria-label={P.sentHeading}>
            {([true, false] as const).map((only) => (
              <button
                key={String(only)}
                type="button"
                onClick={() => setProblemsOnly(only)}
                aria-current={only === problemsOnly ? "page" : undefined}
                className={`h-8 rounded-md px-3 text-sm ${
                  only === problemsOnly
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-ink)]"
                    : "text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)]"
                }`}
              >
                {only
                  ? `${P.filterProblems}${data ? ` (${openProblems.length})` : ""}`
                  : P.filterAll}
              </button>
            ))}
          </nav>
        }
      >
        {data && sentRows.length === 0 && (
          <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">
            {problemsOnly ? P.problemsNone : P.sentNone}
          </p>
        )}
        <ul className="divide-y divide-[var(--admin-rule)]">
          {sentRows.map((row) => {
            const correcting =
              confirming?.kind === "correction" &&
              confirming.id === row.notificationId;
            const kind =
              row.kind === "CHARGE_REQUESTED"
                ? P.kindRequest
                : row.kind === "CHARGE_REMINDER"
                  ? P.kindReminder
                  : P.kindCorrection;
            return (
              <li
                key={row.notificationId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <Mail
                      className="h-4 w-4 text-[var(--admin-faint)]"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{row.renterName}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--admin-muted)]">
                      {row.plate}
                    </span>
                    {row.problem && !row.reviewedAt && (
                      <span className="rounded-full bg-[var(--admin-crit-soft)] px-2 py-0.5 text-xs font-medium text-[var(--admin-crit)]">
                        {t(`problem${row.problem}`)}
                      </span>
                    )}
                    {row.reviewedAt && (
                      <span className="rounded-full bg-[var(--admin-sunk)] px-2 py-0.5 text-xs text-[var(--admin-muted)]">
                        {t(`reviewed${row.reviewOutcome}`)} ·{" "}
                        {zurichDay(row.reviewedAt)} {P.by} {row.reviewedByName}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-[var(--admin-muted)]">
                    {kind}
                    {row.weekNumber !== null &&
                      ` · ${P.week} ${row.weekNumber}`}
                    {row.amountCents !== null &&
                      ` · CHF ${formatChf(row.amountCents)}`}
                    {" · "}
                    {row.sentAt
                      ? `${P.sentAtLabel} ${zurichTime(row.sentAt)}`
                      : P.notSent}
                    {row.chargeStatus &&
                      ` · ${P.weekNow}: ${t(`charge${row.chargeStatus}`)}`}
                  </span>
                  <span className="block truncate text-xs text-[var(--admin-faint)]">
                    {row.to}
                  </span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      onOpenAccount({
                        id: row.rentalId,
                        customerName: row.renterName,
                      })
                    }
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {L.account.button}
                  </button>
                  {row.problem &&
                    !row.reviewedAt &&
                    row.correctable &&
                    !row.correctionSentAt &&
                    (correcting ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        {P.correctionConfirm}
                        <button
                          type="button"
                          disabled={busy}
                          className={strong}
                          onClick={() =>
                            post(
                              `/api/admin/payments/mails/${row.notificationId}/review/`,
                              { action: "correction" },
                            )
                          }
                        >
                          {P.sendCorrection}
                        </button>
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => setConfirming(null)}
                        >
                          {L.account.cancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={button}
                        onClick={() =>
                          setConfirming({
                            kind: "correction",
                            id: row.notificationId,
                          })
                        }
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {P.sendCorrection}
                      </button>
                    ))}
                  {row.problem && !row.reviewedAt && (
                    <button
                      type="button"
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        post(
                          `/api/admin/payments/mails/${row.notificationId}/review/`,
                          { action: "dismiss" },
                        )
                      }
                    >
                      {P.dismiss}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
