"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { messageForCode } from "@/lib/admin/labels";
import { DateField } from "@/components/admin/parts/DateField";
import { HistoryPeriod } from "@/components/admin/parts/HistoryPeriod";
import { Panel } from "@/components/admin/parts/Panel";
import {
  dayEnd,
  dayStart,
  matchesCar,
  windowLabel,
} from "@/lib/admin/carHistory";
import type { CarHistory } from "@/components/admin/types";

/**
 * Who had this car, and when.
 *
 * The screen a traffic fine sends somebody to. Every other section of this
 * console is about what is open now — the overview endpoint returns only
 * rentals that are neither COMPLETED nor CANCELLED — and a fine arrives weeks
 * after the car came back, so none of them could answer it.
 *
 * Two halves, and the first costs nothing. Finding the car is a filter over
 * the fleet the shell has already fetched: ten vehicles, matched on plate and
 * model together, with no request and no waiting. Only picking one asks the
 * server anything, which is also what keeps the audit log meaningful — a row
 * per deliberate search rather than one per keystroke.
 *
 * The window is optional and, when given, is read in Zurich rather than UTC:
 * see dayStart in lib/admin/carHistory.ts for why a fine issued at half past
 * midnight would otherwise be attributed to the previous renter.
 */
export function HistorySection() {
  const { L, data } = useAdmin();

  /**
   * A car may be named in the URL, which is how the car profile links here.
   *
   * Read once as the initial state rather than watched, on purpose: somebody
   * who then picks a different car from the search box must not be dragged
   * back to the one in the address bar. The parameter is an opening position,
   * not a binding.
   */
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [carId, setCarId] = useState<string | null>(
    () => params.get("car") || null
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [history, setHistory] = useState<CarHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /**
   * The window the results on screen actually answer, as days.
   *
   * Kept apart from the `from`/`to` inputs so that editing a date does not
   * relabel a result set that still answers the previous one — and held as
   * the typed days rather than the instants they became, so the heading names
   * the day somebody searched. See windowLabel.
   */
  const [applied, setApplied] = useState<string | null>(null);

  const cars = useMemo(() => data?.cars ?? [], [data]);
  const matches = useMemo(
    () => cars.filter((car) => matchesCar(car, query)),
    [cars, query]
  );

  const car = carId ? cars.find((entry) => entry.id === carId) ?? null : null;

  /**
   * Asks the server about the car currently picked.
   *
   * The window is built here rather than in the inputs, and `dayStart`
   * refuses anything that is not a date rather than searching a day nobody
   * meant. Belt and braces since the fields became `DateField`, which only
   * reports a complete date — but the guard is what makes that a detail of the
   * input rather than something this depends on.
   */
  const look = useCallback(
    async (id: string, fromDay: string, toDay: string) => {
      const params = new URLSearchParams();

      const start = fromDay ? dayStart(fromDay) : null;
      const end = toDay ? dayEnd(toDay) : null;
      if (start) params.set("from", start.toISOString());
      if (end) params.set("to", end.toISOString());

      // A lone start day would otherwise reach the endpoint as a single
      // instant — midnight — and match nothing. The office means the day.
      if (start && !end) params.set("to", dayEnd(fromDay)!.toISOString());
      if (end && !start) params.set("from", dayStart(toDay)!.toISOString());

      const search = params.toString();

      setLoading(true);
      setFailed(null);
      try {
        const response = await fetch(
          `/api/admin/cars/${id}/history/${search ? `?${search}` : ""}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setHistory(null);
          setFailed(
            body.code === "window-reversed"
              ? L.errors.windowReversed
              : L.history.failed
          );
          return;
        }
        setHistory((await response.json()) as CarHistory);
        setApplied(windowLabel(fromDay, toDay));
      } catch {
        setHistory(null);
        setFailed(L.history.failed);
      } finally {
        setLoading(false);
      }
    },
    [L]
  );

  // Picking a car is itself the first search: the whole history, which is what
  // somebody wants when they do not yet know the date.
  useEffect(() => {
    if (!carId) {
      setHistory(null);
      setFailed(null);
      return;
    }
    void look(carId, from, to);
    // `from` and `to` are deliberately absent: typing a date must not fire a
    // request per keystroke. The Search button is what applies a window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId, look]);

  /**
   * Writes a corrected period, then re-reads the car.
   *
   * Re-reading rather than patching the row in place, because the list is
   * ordered by `startAt` — a corrected start can move the row, and a screen
   * that showed the new dates in the old position would be lying about the
   * order the car changed hands in.
   *
   * The re-read is another audited lookup. That is the right trade: the log is
   * meant to show who went looking at a renter, and somebody who just edited
   * one was unquestionably looking.
   */
  const savePeriod = useCallback(
    async (rentalId: string, body: { startAt: string; endAt: string }) => {
      setFailed(null);
      try {
        const response = await fetch(`/api/admin/rentals/${rentalId}/period/`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const failure = await response.json().catch(() => ({}));
          setFailed(messageForCode(L, failure.code));
          return false;
        }
        if (carId) await look(carId, from, to);
        return true;
      } catch {
        setFailed(L.history.failed);
        return false;
      }
    },
    [L, carId, from, to, look]
  );

  function pick(id: string) {
    setCarId(id);
    setFrom("");
    setTo("");
  }

  function back() {
    setCarId(null);
    setHistory(null);
    setFailed(null);
  }

  if (!car) {
    return (
      <Panel title={L.history.heading} meta={`${matches.length} ${L.history.matches}`}>
        <div className="border-b border-[var(--admin-rule)] px-4 py-4">
          <p className="text-sm text-[var(--admin-muted)]">{L.history.lead}</p>
          <label className="mt-3 block">
            <span className="sr-only">{L.history.search}</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-faint)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder={L.history.searchPlaceholder}
                className="h-10 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--admin-accent)]"
              />
            </span>
          </label>
        </div>

        {matches.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">
            {L.history.noCars}
          </p>
        ) : (
          <ul>
            {matches.map((entry) => (
              <li
                key={entry.id}
                className="border-t border-[var(--admin-rule)] first:border-t-0"
              >
                <button
                  type="button"
                  onClick={() => pick(entry.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-sunk)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {entry.model}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-[var(--admin-muted)]">
                      {entry.plate}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--admin-faint)]">
                    {L.fleet.statuses[
                      entry.status as keyof typeof L.fleet.statuses
                    ] ?? entry.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  }

  const periods = history?.periods ?? [];
  const windowed = Boolean(history?.window);

  return (
    <Panel
      title={`${car.model} · ${car.plate}`}
      meta={history ? applied ?? L.history.wholeHistory : undefined}
      action={
        <button
          type="button"
          onClick={back}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {L.history.change}
        </button>
      }
    >
      <div className="border-b border-[var(--admin-rule)] px-4 py-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Typed as DD.MM.YYYY, like every other date in the console — a
              native date input would offer MM/DD/YYYY on an English-language
              browser, and a traffic fine is looked up by a date somebody is
              reading off a letter. The fixed widths keep the two boxes from
              stretching the toolbar. */}
          <div className="w-36">
            <DateField
              label={L.history.from}
              value={from}
              onChange={setFrom}
              placeholder={L.fleet.datePlaceholder}
              invalidHint={L.fleet.dateInvalid}
            />
          </div>
          <div className="w-36">
            <DateField
              label={L.history.to}
              value={to}
              onChange={setTo}
              placeholder={L.fleet.datePlaceholder}
              invalidHint={L.fleet.dateInvalid}
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void look(car.id, from, to)}
            className="h-9 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {L.history.apply}
          </button>

          {(from || to) && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setFrom("");
                setTo("");
                void look(car.id, "", "");
              }}
              className="h-9 rounded-md px-2.5 text-sm text-[var(--admin-muted)] underline underline-offset-2 disabled:opacity-40"
            >
              {L.history.clear}
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-[var(--admin-faint)]">
          {L.history.dateHint} {L.history.audited}
        </p>
      </div>

      {failed ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-attn)]">
          {failed}
        </p>
      ) : loading ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">…</p>
      ) : periods.length === 0 ? (
        /* Two different facts, and the office has to be able to tell them
           apart: this car has never been rented, or it was rented plenty but
           not over the days asked about — in which case it sat with the
           office, and nobody who appears elsewhere on this screen is
           answerable for the fine. */
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">
          {windowed ? L.history.noneInWindow : L.history.noneEver}
        </p>
      ) : (
        <>
          {windowed && (
            <p className="border-b border-[var(--admin-rule)] bg-[var(--admin-sunk)] px-4 py-2 text-xs font-medium text-[var(--admin-muted)]">
              {L.history.heldBy}
            </p>
          )}
          <ul>
            {periods.map((period) => (
              <HistoryPeriod
                key={period.id}
                period={period}
                L={L}
                highlight={windowed}
                busy={loading}
                onSavePeriod={(body) => savePeriod(period.id, body)}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
