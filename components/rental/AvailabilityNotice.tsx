"use client";

import { useState } from "react";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import type { labelsFor, RentalLanguage } from "@/lib/rental/labels";

/**
 * What the page says when the whole fleet is out.
 *
 * Ten cars and a good week is all it takes, and the honest answer then is
 * "nothing today". A visitor who reads that and closes the tab is lost to a
 * page that could have taken their address in one field — so the notice and
 * the form are the same component, and the offer is made in the same breath as
 * the bad news rather than as a second thing to find.
 *
 * One field, and no others. A name and a phone number would each be something
 * more held about somebody who is not yet a customer, and the only thing
 * needed to write to them is the address.
 *
 * Deliberately not rendered by this component's own decision. The caller
 * already knows whether the fleet is empty — it has just fetched the list —
 * and a component that fetched again would show the notice a beat after the
 * picker it replaces had already disappeared.
 */

type Labels = ReturnType<typeof labelsFor>;

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string };

export default function AvailabilityNotice({
  L,
  language,
}: {
  L: Labels;
  language: RentalLanguage;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  if (state.kind === "done") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2
          className="mx-auto h-9 w-9 text-emerald-600"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium text-emerald-900">
          {state.message}
        </p>
      </div>
    );
  }

  const busy = state.kind === "sending";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <BellRing
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">
            {L.availability.heading}
          </h3>
          <p className="mt-1 text-sm text-amber-800">{L.availability.body}</p>
        </div>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setState({ kind: "sending" });
          try {
            const response = await fetch("/api/availability-alerts/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, language }),
            });
            const payload = await response.json().catch(() => ({}));
            setState(
              response.ok
                ? { kind: "done", message: payload.message ?? L.availability.queued }
                : {
                    kind: "failed",
                    // The endpoint writes its refusals in the page's language,
                    // so its message is preferred over a generic one here.
                    message: payload.message ?? L.availability.failed,
                  }
            );
          } catch {
            setState({ kind: "failed", message: L.availability.failed });
          }
        }}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <label className="sr-only" htmlFor="availability-email">
          {L.availability.emailLabel}
        </label>
        <input
          id="availability-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={L.availability.emailPlaceholder}
          disabled={busy}
          className="h-11 w-full flex-1 rounded-lg border border-amber-300 bg-white px-3 text-base outline-none focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:opacity-60 md:text-sm"
        />
        <button
          type="submit"
          disabled={busy || email.trim() === ""}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {L.availability.submit}
        </button>
      </form>

      {state.kind === "failed" && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}

      <p className="mt-2 text-xs text-amber-700">{L.availability.privacy}</p>
    </div>
  );
}
