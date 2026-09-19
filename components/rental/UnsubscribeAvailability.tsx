"use client";

import { useState } from "react";
import { BellOff, CheckCircle2, Loader2 } from "lucide-react";
import type { RentalLanguage } from "@/lib/rental/labels";

/**
 * The confirm button behind an unsubscribe link.
 *
 * A button rather than the link doing the work directly, because mail clients
 * and corporate scanners fetch every link in a message to check it. Without
 * this step some people would be removed from the list by their own
 * antivirus, having never clicked anything — and the symptom, "I asked to be
 * told and never heard from you", is one nobody would ever diagnose.
 */

const TEXT = {
  de: {
    heading: "Benachrichtigungen abbestellen",
    body: "Sie erhalten keine weiteren Nachrichten über verfügbare Fahrzeuge an diese Adresse.",
    confirm: "Abbestellen",
    done: "Abbestellt. Danke — wir schreiben Ihnen nicht mehr.",
    failed: "Das hat nicht geklappt. Bitte versuchen Sie es später erneut.",
  },
  en: {
    heading: "Unsubscribe",
    body: "You will receive no further messages about available cars at this address.",
    confirm: "Unsubscribe",
    done: "Unsubscribed. Thank you — we will not write again.",
    failed: "That did not work. Please try again later.",
  },
} satisfies Record<RentalLanguage, Record<string, string>>;

export default function UnsubscribeAvailability({
  token,
  email,
  language,
}: {
  token: string;
  /** Masked before it ever leaves the server — see the page. */
  email: string;
  language: RentalLanguage;
}) {
  const T = TEXT[language];
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">(
    "idle"
  );

  if (state === "done") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <p className="mt-4 text-slate-700">{T.done}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <BellOff className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{T.heading}</h1>
      <p className="mt-2 text-sm text-slate-600">{T.body}</p>
      <p className="mt-1 font-mono text-sm text-slate-500">{email}</p>

      <button
        type="button"
        disabled={state === "working"}
        onClick={async () => {
          setState("working");
          try {
            const response = await fetch("/api/availability-alerts/unsubscribe/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
            });
            setState(response.ok ? "done" : "failed");
          } catch {
            setState("failed");
          }
        }}
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === "working" && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {T.confirm}
      </button>

      {state === "failed" && (
        <p className="mt-3 text-sm text-red-600">{T.failed}</p>
      )}
    </div>
  );
}
