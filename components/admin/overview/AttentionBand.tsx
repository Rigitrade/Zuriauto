"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { AttentionItem } from "@/lib/admin/attention";
import type { Labels } from "@/components/admin/types";
import { day } from "@/components/admin/format";

/**
 * What needs a person, at the top of the console.
 *
 * The empty state is rendered explicitly and never as absence. A band that
 * simply disappears when there is nothing to do is indistinguishable from a
 * band that failed to render, and the difference between those two is a car
 * nobody knows is blocked.
 *
 * Every row carries its reason and its action side by side, because the cost
 * of the old screen was not that the information was missing — it was that
 * the number and the thing you do about it lived in different places.
 */
export function AttentionBand({
  items,
  L,
  now,
  onResend,
}: {
  items: AttentionItem[];
  L: Labels;
  now: Date;
  /** Resolves true when the contract went out. The row reports the outcome
   *  itself rather than only through the shell's message strip, because by
   *  then the row may have vanished from a refetch. */
  onResend: (contractId: string) => Promise<boolean>;
}) {
  if (items.length === 0) {
    return (
      <section className="flex items-start gap-3 rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] px-4 py-3.5">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--admin-good-soft)] text-[var(--admin-good)]"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
        <span>
          <p className="text-sm font-medium">{L.overview.nothingWaiting}</p>
          <p className="mt-0.5 text-xs text-[var(--admin-faint)]">
            {L.overview.nothingWaitingHint}
          </p>
        </span>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-attn-rule)] border-l-[3px] border-l-[var(--admin-attn)] bg-[var(--admin-attn-soft)]">
      <h2 className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--admin-attn)]">
        {L.overview.needsYou} · {items.length}
      </h2>
      <ul className="divide-y divide-[var(--admin-rule)] border-t border-[var(--admin-attn-rule)]">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[var(--admin-surface)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {title(item, L)} — {item.customerName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--admin-faint)]">{detail(item, L, now)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.kind === "return" && (
                <span className="rounded-full bg-[var(--admin-attn-soft)] px-2.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--admin-attn)] ring-1 ring-inset ring-[var(--admin-attn)]/25">
                  {L.overview.carStaysBlocked}
                </span>
              )}
              {item.kind === "mail" && item.contractId ? (
                <ResendButton
                  L={L}
                  onResend={() => onResend(item.contractId as string)}
                />
              ) : (
                <Link
                  href="/admin/rentals"
                  className="h-9 shrink-0 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm leading-[2.125rem] text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
                >
                  {item.kind === "return" ? L.rentals.close : L.overview.open}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function title(item: AttentionItem, L: Labels): string {
  if (item.kind === "return") return L.overview.confirmReturn;
  if (item.kind === "ending") return L.overview.endsToday;
  return L.overview.mailNotDelivered;
}

function detail(item: AttentionItem, L: Labels, now: Date): string {
  if (item.kind === "mail") {
    return [item.contractNumber, item.at ? day(item.at) : null]
      .filter(Boolean)
      .join(" · ");
  }

  const parts = [item.carModel, item.carPlate].filter(Boolean);
  if (item.at) {
    const overdue =
      item.kind === "ending" && Date.parse(item.at) < now.getTime();
    parts.push(
      `${item.kind === "return" ? L.overview.returnsOn : ""} ${day(item.at)}${
        overdue ? ` · ${L.overview.overdue}` : ""
      }`.trim()
    );
  }
  return parts.join(" · ");
}

/**
 * Its own component so the pending and sent states are per row.
 *
 * Three unsent contracts is one click each, and a single shared `busy` flag
 * would grey out all three while one is in flight — which reads as though the
 * click landed on the wrong row.
 */
function ResendButton({
  L,
  onResend,
}: {
  L: Labels;
  onResend: () => Promise<boolean>;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (state === "sent") {
    return (
      <span className="rounded-full bg-[var(--admin-good-soft)] px-2.5 py-1 text-xs font-medium text-[var(--admin-good)]">
        {L.overview.sent}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        // Back to idle on failure, never stuck: the shell's message strip
        // says what went wrong, and the office should be able to try again
        // once it is fixed.
        setState((await onResend()) ? "sent" : "idle");
      }}
      className="h-9 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-40"
    >
      {state === "sending" ? "…" : L.overview.sendAgain}
    </button>
  );
}
