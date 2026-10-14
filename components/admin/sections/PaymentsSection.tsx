"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { PaymentDetail } from "@/components/admin/parts/PaymentDetail";
import { formatChf } from "@/lib/rental/money";
import { zurichTime } from "@/components/admin/format";
import type { PaymentRow } from "@/lib/payments/queries";

/**
 * TWINT payments: what booked itself, and what waits for one click.
 * Opens on "To review", the one tab that needs anybody.
 */

type Tab = "review" | "booked" | "all";

export function PaymentsSection() {
  const { L, reload } = useAdmin();
  const P = L.payments;
  const params = useSearchParams();
  const router = useRouter();
  const tab = (["review", "booked", "all"].includes(params.get("tab") ?? "") ? params.get("tab") : "review") as Tab;
  const paymentId = params.get("payment");
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/payments/?tab=${tab}`);
    if (response.ok) setRows((await response.json()).payments);
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
  ];
  const reason = (key: string | null) => (key ? ((P as Record<string, string>)[`reason${key}`] ?? key) : "");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{P.heading}</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{P.intro}</p>
      </header>

      <Panel
        title={P.heading}
        meta={rows ? String(rows.length) : undefined}
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
                  <span className="text-[var(--admin-muted)]"> · {zurichTime(row.paidAt)} · {row.payerName ?? "—"}</span>
                  <span className="block truncate text-xs text-[var(--admin-faint)]">{row.message ?? "—"}</span>
                </span>
                <span className="text-sm">
                  {row.status === "NEEDS_REVIEW" ? (
                    <span className="text-[var(--admin-crit)]">{reason(row.reviewReason)}</span>
                  ) : (
                    <span className="text-[var(--admin-muted)]">
                      {[row.renterName, row.plate, row.weekNumber ? `${P.week} ${row.weekNumber}` : null]
                        .filter(Boolean)
                        .join(" · ") || ((P as Record<string, string>)[`status${row.status}`] ?? row.status)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
