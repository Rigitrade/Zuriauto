"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { PaymentDetail } from "@/components/admin/parts/PaymentDetail";
import { RentalAccountDialog, type AccountSubject } from "@/components/admin/parts/RentalAccountDialog";
import { purposeText } from "@/components/admin/parts/paymentText";
import { formatChf } from "@/lib/rental/money";
import { zurichDay, zurichTime } from "@/components/admin/format";
import type { OwedRow } from "@/lib/payments/account";
import type { PaymentMailIssueRow, PaymentRow } from "@/lib/payments/queries";

/**
 * TWINT payments: what booked itself, and what waits for one click — and,
 * on "Offene Beträge", who still owes money (the rental account).
 * Opens on "To review", the one tab that needs anybody.
 */

type Tab = "review" | "booked" | "all" | "owed";
const TABS: Tab[] = ["review", "booked", "all", "owed"];

export function PaymentsSection() {
  const { L, reload, write, busy } = useAdmin();
  const P = L.payments;
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "review") as Tab;
  const paymentId = params.get("payment");
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [owed, setOwed] = useState<OwedRow[] | null>(null);
  const [issues, setIssues] = useState<PaymentMailIssueRow[]>([]);
  const [accountFor, setAccountFor] = useState<AccountSubject | null>(null);

  const load = useCallback(async () => {
    // The issues come with the payments list; "Offene Beträge" asks for them too.
    const response = await fetch(`/api/admin/payments/?tab=${tab === "owed" ? "review" : tab}`);
    if (response.ok) {
      const body = await response.json();
      setRows(body.payments);
      setIssues(body.issues ?? []);
    }
    if (tab === "owed") {
      const owedResponse = await fetch("/api/admin/payments/owed/");
      if (owedResponse.ok) setOwed(((await owedResponse.json()) as { rows: OwedRow[] }).rows);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const go = (next: { tab?: Tab; payment?: string | null }) => {
    const query = new URLSearchParams({ tab: next.tab ?? tab });
    if (next.payment) query.set("payment", next.payment);
    router.push(`/admin/payments/?${query.toString()}`);
  };

  if (paymentId) {
    return (
      <PaymentDetail
        paymentId={paymentId}
        onBack={() => go({ payment: null })}
        onChanged={() => {
          void load();
          void reload();
        }}
      />
    );
  }

  const tabs: [Tab, string][] = [
    ["review", P.tabReview],
    ["booked", P.tabBooked],
    ["all", P.tabAll],
    ["owed", P.tabOwed],
  ];
  const reason = (key: string | null) => (key ? ((P as Record<string, string>)[`reason${key}`] ?? key) : "");
  const chip = "ml-1.5 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium";

  return (
    <div className="space-y-4">
      {accountFor && (
        <RentalAccountDialog
          rental={accountFor}
          L={L}
          open
          onClose={() => {
            setAccountFor(null);
            void load();
          }}
        />
      )}
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{P.heading}</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{P.intro}</p>
      </header>

      {/* Above the payments: a forged notification or a layout TWINT changed
          is the one thing here that can mean money is arriving unseen. */}
      {issues.length > 0 && (
        <Panel title={P.issuesHeading} meta={String(issues.length)}>
          <p className="border-b border-[var(--admin-rule)] px-4 py-3 text-sm text-[var(--admin-muted)]">{P.issuesIntro}</p>
          <ul className="divide-y divide-[var(--admin-rule)]">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="text-[var(--admin-crit)]">
                    {(P as Record<string, string>)[`issue${issue.reason}`] ?? issue.reason}
                  </span>
                  {issue.detail && <span className="text-[var(--admin-muted)]"> · {issue.detail}</span>}
                  <span className="block truncate text-xs text-[var(--admin-faint)]">
                    {[issue.receivedAt ? zurichTime(issue.receivedAt) : null, issue.subject].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (await write(`/api/admin/payments/issues/${issue.id}/resolve/`, { method: "POST" })) await load();
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm hover:bg-[var(--admin-sunk)] disabled:opacity-50"
                >
                  {P.issueResolve}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title={tab === "owed" ? P.tabOwed : P.heading}
        meta={tab === "owed" ? (owed ? String(owed.length) : undefined) : rows ? String(rows.length) : undefined}
        action={
          <nav className="flex flex-wrap gap-1" aria-label={P.heading}>
            {tabs.map(([key, name]) => (
              <button
                key={key}
                type="button"
                onClick={() => go({ tab: key })}
                aria-current={key === tab ? "page" : undefined}
                className={`h-8 rounded-md px-3 text-sm ${
                  key === tab
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-ink)]"
                    : "text-[var(--admin-muted)] hover:bg-[var(--admin-sunk)]"
                }`}
              >
                {name}
              </button>
            ))}
          </nav>
        }
      >
        {tab === "owed" ? (
          <>
            <p className="border-b border-[var(--admin-rule)] px-4 py-3 text-sm text-[var(--admin-muted)]">{P.owedIntro}</p>
            {owed && owed.length === 0 && <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">{P.owedNone}</p>}
            <ul className="divide-y divide-[var(--admin-rule)]">
              {(owed ?? []).map((row) => (
                <li key={row.rentalId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.renterName}</span>
                      <span className="font-mono text-xs tabular-nums text-[var(--admin-muted)]">{row.plate}</span>
                      {row.closed && (
                        <span className="rounded-full bg-[var(--admin-attn-soft)] px-2 py-0.5 text-xs font-medium text-[var(--admin-attn)]">
                          {P.owedReturned}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs tabular-nums">
                      {[
                        row.owedCents > 0 && row.oldestDue ? (
                          <span key="owed" className="text-[var(--admin-crit)]">
                            {P.owedOpenSince.replace("{x}", formatChf(row.owedCents)).replace("{d}", zurichDay(row.oldestDue))}
                          </span>
                        ) : null,
                        row.depositMissingCents > 0 ? (
                          <span key="deposit" className="text-[var(--admin-attn)]">
                            {P.owedDepositMissing.replace("{x}", formatChf(row.depositMissingCents))}
                          </span>
                        ) : null,
                        row.pendingWeeks > 0 ? (
                          <span key="pending" className="text-[var(--admin-attn)]">
                            {P.owedWeeksToDecide.replace("{n}", String(row.pendingWeeks))}
                          </span>
                        ) : null,
                      ]
                        .filter(Boolean)
                        .flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep${i}`} className="text-[var(--admin-faint)]"> · </span>, part]))}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAccountFor({ id: row.rentalId, customerName: row.renterName })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    {L.account.button}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {rows && rows.length === 0 && <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">{P.empty}</p>}
            <ul className="divide-y divide-[var(--admin-rule)]">
              {(rows ?? []).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => go({ payment: row.id })}
                    className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--admin-sunk)]"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">CHF {formatChf(row.amountCents)}</span>
                      {row.method !== "TWINT" && (
                        <span className={`${chip} bg-[var(--admin-sunk)] text-[var(--admin-muted)]`}>
                          {(P as Record<string, string>)[`method${row.method}`] ?? row.method}
                        </span>
                      )}
                      <span className="text-[var(--admin-muted)]"> · {zurichTime(row.paidAt)} · {row.payerName ?? "—"}</span>
                      <span className="block truncate text-xs text-[var(--admin-faint)]">{row.message ?? "—"}</span>
                    </span>
                    <span className="text-sm">
                      {row.status === "NEEDS_REVIEW" ? (
                        <span className="text-[var(--admin-crit)]">{reason(row.reviewReason)}</span>
                      ) : (
                        <span className="text-[var(--admin-muted)]">
                          {[row.renterName, row.plate, purposeText(row, P)].filter(Boolean).join(" · ") ||
                            ((P as Record<string, string>)[`status${row.status}`] ?? row.status)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
