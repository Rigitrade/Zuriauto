"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, Upload } from "lucide-react";
import { compressImage } from "@/lib/rental/imageCompress";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";

/**
 * The renter confirming a fine was paid.
 *
 * One file and an optional date. Images are compressed in the browser, as at
 * pickup — but gently: the digits of a reference number must survive.
 * Whatever the screen says, the server decides; this is only the form.
 */

export interface FinePaymentProps {
  token: string;
  language: RentalLanguage;
  plate: string;
  carModel: string;
  when: string;
  amount: string;
  issuer: string | null;
  number: string | null;
}

const MAX_BYTES = 4 * 1024 * 1024;

type State =
  | { kind: "editing"; error?: string }
  | { kind: "working" }
  | { kind: "verified" }
  | { kind: "pending" };

export default function FinePayment(props: FinePaymentProps) {
  const L = labelsFor(props.language).fines;
  const [file, setFile] = useState<File | null>(null);
  const [paidOn, setPaidOn] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(file.type)) {
      setState({ kind: "editing", error: L.wrongType });
      return;
    }
    setState({ kind: "working" });

    let upload: Blob = file;
    let name = file.name;
    if (file.type.startsWith("image/")) {
      try {
        upload = (await compressImage(file, { maxEdge: 2000, quality: 0.85 })).blob;
        name = "zahlung.jpg";
      } catch {
        // Undecodable here is not undecodable on the server; send it as is.
      }
    }
    if (upload.size > MAX_BYTES) {
      setState({ kind: "editing", error: L.tooLarge });
      return;
    }

    const body = new FormData();
    body.append("token", props.token);
    body.append("file", upload, name);
    if (paidOn) body.append("paidOn", paidOn);
    body.append("company", "");

    try {
      // Trailing slash: next.config.ts 308s the unslashed path, and fetch
      // would re-upload the file to follow it.
      const response = await fetch("/api/fines/proof/", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { verdict?: string; code?: string };
      if (response.ok && payload.verdict === "MATCH") return setState({ kind: "verified" });
      if (response.ok && payload.verdict === "UNREADABLE") {
        return setState({ kind: "editing", error: L.unreadable });
      }
      if (response.ok) return setState({ kind: "pending" });
      if (response.status === 413) return setState({ kind: "editing", error: L.tooLarge });
      if (response.status === 415) return setState({ kind: "editing", error: L.wrongType });
      if (response.status === 410) return setState({ kind: "editing", error: L.unusableBody });
      setState({ kind: "editing", error: L.failed });
    } catch {
      setState({ kind: "editing", error: L.failed });
    }
  }

  if (state.kind === "verified" || state.kind === "pending") {
    const done = state.kind === "verified";
    return (
      <div className="text-center">
        {done ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        ) : (
          <Clock className="mx-auto h-14 w-14 text-slate-400" />
        )}
        <p className="mt-4 text-slate-700">{done ? L.verified : L.pending}</p>
      </div>
    );
  }

  const working = state.kind === "working";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{L.heading}</h1>
        <p className="mt-2 text-sm text-slate-600">{L.intro}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-slate-50 p-4 text-sm">
        <dt className="text-slate-500">{L.vehicle}</dt>
        <dd className="text-slate-900">
          {props.carModel} ({props.plate})
        </dd>
        <dt className="text-slate-500">{L.when}</dt>
        <dd className="text-slate-900">{props.when}</dd>
        <dt className="text-slate-500">{L.amount}</dt>
        <dd className="font-medium text-slate-900">{props.amount}</dd>
        {props.issuer && (
          <>
            <dt className="text-slate-500">{L.issuer}</dt>
            <dd className="text-slate-900">{props.issuer}</dd>
          </>
        )}
        {props.number && (
          <>
            <dt className="text-slate-500">{L.number}</dt>
            <dd className="font-mono text-slate-900">{props.number}</dd>
          </>
        )}
      </dl>

      <div className="space-y-1.5">
        <label htmlFor="proof" className="block text-sm font-medium text-slate-700">
          {L.file}
        </label>
        <label
          htmlFor="proof"
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" />
          <span className="truncate">{file ? file.name : L.file}</span>
        </label>
        <input
          id="proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState({ kind: "editing" });
          }}
        />
        <p className="text-xs text-slate-500">{L.fileHint}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="paidOn" className="block text-sm font-medium text-slate-700">
          {L.paidOn}
        </label>
        <input
          id="paidOn"
          type="date"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-base md:text-sm"
        />
      </div>

      {/* Honeypot: hidden from people, so only a bot fills it. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {state.kind === "editing" && state.error && (
        <p className="text-sm text-rose-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file || working}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
      >
        {working && <Loader2 className="h-4 w-4 animate-spin" />}
        {working ? L.working : L.submit}
      </button>
    </form>
  );
}
