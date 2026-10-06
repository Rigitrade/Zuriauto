"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCw } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { FineDetail } from "@/components/admin/parts/FineDetail";
import { FineUpload } from "@/components/admin/parts/FineUpload";
import { Panel } from "@/components/admin/parts/Panel";
import { formatChf } from "@/lib/rental/money";

/**
 * Traffic fines: drop the scans in, deal with what the system would not.
 *
 * All opens first, so a letter is in front of the office wherever it went:
 * with Review first, one that went out on its own was out of sight under
 * Open. The alerts and the morning digest still link straight to Review,
 * the one tab that needs anybody. Everything that went out on its own sits
 * under Open until the renter confirms payment. The share of last month's letters that went out with
 * nobody looking is on the header: it is the number that decides whether
 * reading letters with AI would be worth paying for.
 */

type Tab = "review" | "open" | "paid" | "all";

interface Row {
  id: string;
  status: string;
  reviewReason: string | null;
  violationAt: string | null;
  violationTimeKnown: boolean;
  amountCents: number | null;
  issuerName: string | null;
  dueDate: string | null;
  plate: string | null;
  renterName: string | null;
}

interface Pending {
  id: string;
  status: string;
  attempts: number;
  error: string | null;
  uploadedAt: string;
  uploadedByName: string;
  claimedAt: string | null;
}

/** A reading this old died with its function; see STALE_CLAIM_MS. */
const STALE_MS = 10 * 60 * 1000;

function canRetry(d: Pending): boolean {
  return (
    d.status === "FAILED" ||
    (d.status === "PROCESSING" && !!d.claimedAt && Date.now() - Date.parse(d.claimedAt) > STALE_MS)
  );
}

interface Listing {
  fines: Row[];
  documents: Pending[];
  stats: { last30: number; auto: number };
}

function zurich(iso: string, withTime: boolean): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function FinesSection() {
  const { L, reload, write, busy } = useAdmin();
  const F = L.fines;
  const params = useSearchParams();
  const router = useRouter();

  const tab = (["review", "open", "paid", "all"].includes(params.get("tab") ?? "") ? params.get("tab") : "all") as Tab;
  const fineId = params.get("fine");

  const [listing, setListing] = useState<Listing | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/fines/?tab=${tab}`);
    if (response.ok) setListing(await response.json());
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // While letters are being read, look again every few seconds: the office
  // dropped them in and is watching for the result.
  const reading = (listing?.documents ?? []).some((d) => d.status === "UPLOADED" || d.status === "PROCESSING");
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [reading, load]);

  const go = (next: { tab?: Tab; fine?: string | null }) => {
    const query = new URLSearchParams();
    query.set("tab", next.tab ?? tab);
    if (next.fine) query.set("fine", next.fine);
    router.push(`/admin/fines/?${query.toString()}`);
  };

  const label = (prefix: string, key: string | null) =>
    key ? ((F as Record<string, string>)[`${prefix}${key}`] ?? key) : "";

  if (fineId) {
    return (
      <FineDetail
        fineId={fineId}
        onBack={() => go({ fine: null })}
        onChanged={() => {
          void load();
          void reload();
        }}
      />
    );
  }

  const tabs: [Tab, string][] = [
    ["all", F.tabAll],
    ["review", F.tabReview],
    ["open", F.tabOpen],
    ["paid", F.tabPaid],
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{F.heading}</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{F.intro}</p>
        {listing && listing.stats.last30 > 0 && (
          <p className="mt-1 text-xs text-[var(--admin-faint)]">
            {listing.stats.auto} / {listing.stats.last30} {F.autoShare}
          </p>
        )}
      </header>

      <FineUpload
        L={L}
        onUploaded={() => {
          void load();
          void reload();
        }}
      />

      <Panel
        title={F.heading}
        meta={listing ? String(listing.fines.length) : undefined}
        action={
          <nav className="flex flex-wrap gap-1" aria-label={F.heading}>
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
        {listing && listing.documents.length > 0 && (
          <div className="border-b border-[var(--admin-rule)] px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
              {F.lettersInProgress}
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {listing.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {zurich(d.uploadedAt, true)} · {d.uploadedByName} ·{" "}
                    <span className={d.status === "FAILED" ? "text-[var(--admin-crit)]" : "text-[var(--admin-muted)]"}>
                      {label("doc", d.status)}
                    </span>
                    {d.error && <span className="block text-xs text-[var(--admin-faint)]">{d.error}</span>}
                  </span>
                  {canRetry(d) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (await write(`/api/admin/fines/documents/${d.id}/process/`, { method: "POST" })) await load();
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm hover:bg-[var(--admin-sunk)]"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                      {F.processAgain}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {listing && listing.fines.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-faint)]">{F.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">{F.colDate}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{F.colCar}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{F.colRenter}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{F.colAmount}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{F.colStatus}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{F.colDue}</th>
                </tr>
              </thead>
              <tbody>
                {(listing?.fines ?? []).map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => go({ fine: row.id })}
                    className="cursor-pointer border-t border-[var(--admin-rule)] transition-colors hover:bg-[var(--admin-sunk)]/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      <a
                        href={`/admin/fines/?tab=${tab}&fine=${row.id}`}
                        onClick={(e) => e.preventDefault()}
                        className="font-medium"
                      >
                        {row.violationAt ? zurich(row.violationAt, row.violationTimeKnown) : "—"}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{row.plate ?? "—"}</td>
                    <td className="px-4 py-3">{row.renterName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {row.amountCents !== null ? `CHF ${formatChf(row.amountCents)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {label("status", row.status)}
                      {row.reviewReason && (
                        <span className="block text-xs text-[var(--admin-attn)]">{label("reason", row.reviewReason)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--admin-faint)]">
                      {row.dueDate ? zurich(row.dueDate, false) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
