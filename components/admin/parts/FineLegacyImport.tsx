"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import type { Labels } from "@/components/admin/types";
import { useAdmin } from "@/components/admin/shell/AdminContext";

/**
 * Taking over the office's fines list from before the system (see
 * lib/fines/legacy.ts). Two steps on purpose: "Prüfen" shows what the list
 * will become, with every row it cannot read, and only then does the button
 * write anything. Folded away, because it is used once or twice, not daily.
 */

interface Result {
  imported: number;
  already: number;
  problems: { line: number; reason: string; value: string }[];
  preview: { line: number; plate: string; at: string; driver: string; amountCents: number | null; offence: string | null }[];
}

function zurich(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FineLegacyImport({ L, onImported }: { L: Labels; onImported: () => void }) {
  const { writeJson, busy } = useAdmin();
  const F = L.fines;
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [checked, setChecked] = useState<Result | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const send = (dry: boolean) =>
    writeJson<Result>("/api/admin/fines/legacy/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: file!.text, name: file!.name, dry }),
    });

  return (
    <details className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
      <summary className="cursor-pointer text-sm font-semibold tracking-tight">{F.importTitle}</summary>
      <p className="mt-2 text-xs text-[var(--admin-faint)]">{F.importHint}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm hover:bg-[var(--admin-sunk)]">
          <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
          {file ? file.name : F.importChoose}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const chosen = e.target.files?.[0];
              e.target.value = "";
              if (!chosen) return;
              setFile({ name: chosen.name, text: await chosen.text() });
              setChecked(null);
              setDone(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!file || busy}
          onClick={async () => {
            setDone(null);
            setChecked(await send(true));
          }}
          className="h-8 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm hover:bg-[var(--admin-sunk)] disabled:opacity-40"
        >
          {F.importCheck}
        </button>
        {checked && checked.problems.length === 0 && checked.imported > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await send(false);
              if (result) {
                setDone(result.imported);
                setChecked(null);
                onImported();
              }
            }}
            className="h-8 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] hover:opacity-90"
          >
            {F.importDo.replace("{n}", String(checked.imported))}
          </button>
        )}
      </div>

      {done !== null && <p className="mt-3 text-sm text-[var(--admin-good)]">{F.importDone.replace("{n}", String(done))}</p>}

      {checked && (
        <div className="mt-3 space-y-2 text-sm">
          {checked.problems.length > 0 ? (
            <div className="rounded-md bg-[var(--admin-attn-soft)] p-2.5 text-[var(--admin-attn)]">
              <p className="font-semibold">{F.importProblems}</p>
              <ul className="mt-1 list-disc pl-4">
                {checked.problems.map((p) => (
                  <li key={`${p.line}-${p.reason}`}>
                    {F.importLine} {p.line}: {(F as Record<string, string>)[`problem${p.reason}`] ?? p.reason}
                    {p.value && <span className="font-mono"> «{p.value}»</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[var(--admin-muted)]">
              {checked.imported === 0
                ? F.importNothing
                : F.importReady.replace("{n}", String(checked.imported)).replace("{m}", String(checked.already))}
            </p>
          )}
          {checked.preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-xs">
                <tbody>
                  {checked.preview.map((row) => (
                    <tr key={row.line} className="border-t border-[var(--admin-rule)]">
                      <td className="py-1 pr-2 text-[var(--admin-faint)]">{row.line}</td>
                      <td className="py-1 pr-2">{row.plate}</td>
                      <td className="py-1 pr-2">{zurich(row.at)}</td>
                      <td className="py-1 pr-2 font-medium">{row.driver}</td>
                      <td className="py-1 pr-2 text-right">{row.amountCents === null ? "—" : (row.amountCents / 100).toFixed(2)}</td>
                      <td className="py-1">{row.offence ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
