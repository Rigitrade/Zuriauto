"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";
import { formatChf } from "@/lib/rental/money";

/**
 * What a renter does with a manage link.
 *
 * The token comes from the URL and goes back in the request body. Every price
 * shown here is recomputed on the server before anything is written — this
 * component is a display of the quote, not the source of it.
 */

export interface ManageRentalProps {
  token: string;
  language: RentalLanguage;
  carModel: string;
  carPlate: string;
  endAt: string;
  /** Null for a fixed-term rental, which cannot be extended online. */
  weeklyAmountCents: number | null;
  maxWeeks: number;
}

type State =
  | { kind: "choosing" }
  | { kind: "working" }
  | { kind: "returned" }
  | { kind: "extended"; paymentUrl: string; amountCents: number; newEndAt: string }
  | { kind: "failed"; message: string };

function formatZurich(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}

export default function ManageRental(props: ManageRentalProps) {
  const L = labelsFor(props.language);
  const [state, setState] = useState<State>({ kind: "choosing" });
  const [weeks, setWeeks] = useState(1);

  const busy = state.kind === "working";
  const extendable = props.weeklyAmountCents !== null;
  const quoteCents = (props.weeklyAmountCents ?? 0) * weeks;

  async function post(path: string, body: object) {
    setState({ kind: "working" });
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: props.token, ...body }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload?.code === "not-extendable"
            ? L.manage.notExtendable
            : payload?.code === "too-many-weeks"
              ? L.manage.tooManyWeeks
              : payload?.code === "link-unusable"
                ? L.manage.unusableBody
                : L.manage.failed;
        setState({ kind: "failed", message });
        return null;
      }
      return payload;
    } catch {
      setState({ kind: "failed", message: L.manage.failed });
      return null;
    }
  }

  async function confirmReturn() {
    const payload = await post("/api/rental/return-intent/", {});
    if (payload) setState({ kind: "returned" });
  }

  async function extend() {
    const payload = await post("/api/rental/extend/", { weeks });
    if (payload) {
      setState({
        kind: "extended",
        paymentUrl: payload.paymentUrl,
        amountCents: payload.amountCents,
        newEndAt: payload.newEndAt,
      });
    }
  }

  // --- Outcomes ------------------------------------------------------

  if (state.kind === "returned") {
    return (
      <Panel>
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          {L.manage.returnHeading}
        </h2>
        <p className="mt-2 text-slate-600">{L.manage.returnDone}</p>
      </Panel>
    );
  }

  if (state.kind === "extended") {
    return (
      <Panel>
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          {L.manage.extendHeading}
        </h2>
        <p className="mt-2 text-slate-600">{L.manage.extendDone}</p>

        <dl className="mt-6 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 text-left text-sm">
          <Row label={L.manage.extendNewEnd} value={formatZurich(state.newEndAt)} />
          <Row
            label={L.manage.extendPrice}
            value={`CHF ${formatChf(state.amountCents)}`}
          />
        </dl>

        <a
          href={state.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
        >
          <CreditCard className="h-4 w-4" />
          {L.manage.payNow}
        </a>
      </Panel>
    );
  }

  // --- The choice ----------------------------------------------------

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {L.manage.heading}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{L.manage.intro}</p>
      </header>

      <dl className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Row label={L.manage.vehicle} value={props.carModel} />
        <Row label={L.manage.plate} value={props.carPlate} />
        <div className="sm:col-span-2">
          <Row
            label={L.manage.endsAt}
            value={formatZurich(props.endAt)}
            icon={<CalendarDays className="h-4 w-4 text-slate-400" />}
          />
        </div>
      </dl>

      {state.kind === "failed" && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {state.message}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">
          {L.manage.returnHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{L.manage.returnBody}</p>
        <button
          type="button"
          onClick={confirmReturn}
          disabled={busy}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? L.manage.working : L.manage.returnCta}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">
          {L.manage.extendHeading}
        </h2>

        {!extendable ? (
          <p className="mt-1 text-sm text-slate-600">{L.manage.notExtendable}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">{L.manage.extendBody}</p>

            <label className="mt-3 block space-y-1">
              <span className="text-sm text-slate-700">
                {L.manage.extendWeeks}
              </span>
              <select
                value={weeks}
                onChange={(event) => setWeeks(Number(event.target.value))}
                disabled={busy}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
              >
                {Array.from({ length: props.maxWeeks }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Shown before committing, so nobody agrees to a price they have
                not seen. The server recomputes it regardless. */}
            <dl className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <Row
                label={L.manage.extendPrice}
                value={`CHF ${formatChf(quoteCents)}`}
              />
            </dl>

            <button
              type="button"
              onClick={extend}
              disabled={busy}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? L.manage.working : L.manage.extendCta}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="flex items-center gap-2 font-medium text-slate-900">
        {icon}
        {value}
      </dd>
    </div>
  );
}
