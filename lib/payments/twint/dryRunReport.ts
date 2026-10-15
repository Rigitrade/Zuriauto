/**
 * The dry run's rows as text for a terminal (scripts/twint-dry-run.ts).
 *
 * Whoever paid is masked: the dry run checks what the site would do with an
 * email, not who sent the money, and its output ends up in chats and logs.
 * Renters appear as the labels rentalLabels makes: first name and initial.
 */

import { formatChf } from "@/lib/rental/money";
import type { DryRunRow } from "./dryRun";

const zurich = new Intl.DateTimeFormat("de-CH", {
  timeZone: "Europe/Zurich",
  dateStyle: "short",
  timeStyle: "short",
});
const when = (date: Date | null) => (date ? zurich.format(date) : "?");

const mask = (s: string | null) =>
  s ? s.split(" ").map((word) => (word.length <= 2 ? word : `${word[0]}***`)).join(" ") : "—";

function rowLines(row: DryRunRow, labels: Map<string, string>): string[] {
  if (!("notification" in row)) {
    return [
      `uid ${row.uid} · ${when(row.receivedAt)} · ${row.outcome.toUpperCase()}${row.detail ? ` (${row.detail})` : ""}`,
      `  subject: ${row.subject ?? "—"}`,
    ];
  }

  const n = row.notification;
  const lines = [
    `uid ${row.uid} · ${when(n.paidAt)} · CHF ${formatChf(n.amountCents)} · ${n.externalId}`,
    `  payer:     ${mask(n.payerName)} · ${mask(n.payerEmail)} · ${mask(n.payerPhone)}`,
    `  Nachricht: ${n.message ? JSON.stringify(n.message) : "—"}`,
  ];
  if (row.outcome === "stored") {
    return [...lines, `  -> already stored (${row.status}); the cron counts it as a duplicate`];
  }

  const label = (id: string) => labels.get(id) ?? id;
  const d = row.decision;
  if (d.status === "BOOKED") {
    return [...lines, `  -> would BOOK, by ${d.matchedBy}: ${label(d.rentalId)} (charge ${d.chargeId})`];
  }
  return [
    ...lines,
    `  -> would WAIT for the office: ${d.reason}`,
    ...(d.rentalId ? [`     proposed:  ${label(d.rentalId)}`] : []),
    ...d.candidates.filter((id) => id !== d.rentalId).map((id) => `     candidate: ${label(id)}`),
  ];
}

export function formatDryRun(rows: DryRunRow[], labels: Map<string, string>): string {
  const outcomes: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  for (const row of rows) {
    outcomes[row.outcome] = (outcomes[row.outcome] ?? 0) + 1;
    if (row.outcome === "review" && row.decision.status === "NEEDS_REVIEW") {
      reasons[row.decision.reason] = (reasons[row.decision.reason] ?? 0) + 1;
    }
  }

  return [
    ...rows.flatMap((row) => [...rowLines(row, labels), ""]),
    `Would happen: ${JSON.stringify(outcomes)}`,
    ...(Object.keys(reasons).length > 0 ? [`Why the rest would wait: ${JSON.stringify(reasons)}`] : []),
    "",
    "Dry run: nothing was stored, booked or sent.",
  ].join("\n");
}
