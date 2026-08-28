"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Loader2,
  Share2,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import StepIndicator from "@/components/car-rental/booking/StepIndicator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/hooks/use-i18n";
import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";
import {
  availableFleet,
  findVehicle,
  FUEL_LEVELS,
  type FuelLevel,
} from "@/lib/rental/fleet";
import { asRentalLanguage, labelsFor } from "@/lib/rental/labels";
import {
  buildReturnNumber,
  PAYMENT_METHODS,
  returnDetailsSchema,
  todayIso,
  type PaymentMethod,
} from "@/lib/rental/returnSchema";
import SignaturePad from "./SignaturePad";

/**
 * The vehicle return flow, the pickup contract's counterpart.
 *
 * Stepped like /pickup — vehicle, condition, payment, signature — so the two
 * flows feel like one product and each screen stays short enough to fill in
 * while standing next to the car.
 *
 * The same offline posture as pickup: the PDF is built in the browser, the
 * only server call emails it, and a failed send still hands the customer
 * their signed document.
 */

const TOTAL_STEPS = 4;

type Status =
  | { kind: "editing" }
  | { kind: "building" }
  | { kind: "sending" }
  | { kind: "done"; outcome: "both" | "office" | "offline" | "failed" };

/** "" is unanswered; the schema rejects it, so nothing defaults on paper. */
type YesNo = "" | "yes" | "no";

interface FormState {
  vehicleId: string;
  mileageKm: string;
  mileagePickupKm: string;
  papersInside: YesNo;
  keyReturned: YesNo;
  fuelLevel: FuelLevel;
  cleanliness: "" | "clean" | "needsWash";
  damages: string;
  tickets: YesNo;
  ticketsNote: string;
  fullyPaid: YesNo;
  paymentMethods: PaymentMethod[];
  paidAmountChf: string;
  paidOn: string;
  hasDuePayment: YesNo;
  dueAmountChf: string;
  dueDate: string;
  dueMethod: "" | PaymentMethod;
  depositBack: YesNo;
  lastName: string;
  firstName: string;
  email: string;
  place: string;
}

const EMPTY_FORM: FormState = {
  vehicleId: availableFleet.length === 1 ? availableFleet[0].id : "",
  mileageKm: "",
  mileagePickupKm: "",
  papersInside: "",
  keyReturned: "",
  fuelLevel: "full",
  cleanliness: "",
  damages: "",
  tickets: "",
  ticketsNote: "",
  fullyPaid: "",
  paymentMethods: [],
  paidAmountChf: "",
  paidOn: "",
  hasDuePayment: "",
  dueAmountChf: "",
  dueDate: "",
  dueMethod: "",
  depositBack: "",
  lastName: "",
  firstName: "",
  email: "",
  place: "Zurich",
};

/**
 * Which step owns each field, so a schema error found at submit can send the
 * customer back to the screen where the bad value lives.
 */
const OWNER_OF_FIELD: Record<string, number> = {
  vehicleId: 1,
  mileageKm: 1,
  mileagePickupKm: 1,
  fuelLevel: 1,
  papersInside: 2,
  keyReturned: 2,
  cleanliness: 2,
  damages: 2,
  tickets: 3,
  ticketsNote: 3,
  fullyPaid: 3,
  paymentMethods: 3,
  paidAmountChf: 3,
  paidOn: 3,
  hasDuePayment: 3,
  dueAmountChf: 3,
  dueDate: 3,
  dueMethod: 3,
  depositBack: 3,
  lastName: 4,
  firstName: 4,
  email: 4,
  place: 4,
  signature: 4,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** `DD.MM.YYYY` — the same shape the PDF prints. */
function formatDatePart(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** `HH:MM`, 24-hour, as Switzerland writes it. */
function formatTimePart(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * "350", "350.50" and "1'350,50" all become francs; empty stays undefined.
 * NaN falls through to the schema, which reports it as a bad amount.
 */
function parseAmount(text: string): number | undefined {
  const cleaned = text.trim().replace(/[\s']/g, "").replace(",", ".");
  return cleaned === "" ? undefined : Number(cleaned);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function RentalReturnWizard() {
  const { currentLanguage } = useI18n();
  const language = asRentalLanguage(currentLanguage);
  const L = labelsFor(language);
  const R = L.ret;

  const methodName: Record<PaymentMethod, string> = {
    cash: R.methodCash,
    twint: R.methodTwint,
    card: R.methodCard,
    bank: R.methodBank,
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [signature, setSignature] = useState<string | null>(null);
  // The counter-signature; optional, for when staff is present at the return.
  const [ownerSignature, setOwnerSignature] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [result, setResult] = useState<{
    url: string;
    fileName: string;
    returnNumber: string;
  } | null>(null);
  // Whether "Pay now" has been clicked and the method choice is showing.
  const [payChoiceOpen, setPayChoiceOpen] = useState(false);

  const vehicle = useMemo(() => findVehicle(form.vehicleId), [form.vehicleId]);

  // Ticks so a form left open does not show a stamp that disagrees with the
  // one the PDF records at submit. Set after mount for hydration's sake.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Same viewport reset as the pickup flow: the result panel is far shorter
  // than the form it replaces.
  useEffect(() => {
    if (status.kind === "done") window.scrollTo({ top: 0, behavior: "auto" });
  }, [status.kind]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function toggleMethod(method: PaymentMethod) {
    set(
      "paymentMethods",
      form.paymentMethods.includes(method)
        ? form.paymentMethods.filter((entry) => entry !== method)
        : [...form.paymentMethods, method]
    );
  }

  function validateStep(target: number): boolean {
    const found: Record<string, string> = {};

    if (target === 1) {
      if (!vehicle) found.vehicleId = L.errors.vehicle;
      if (!/^\d{1,7}$/.test(form.mileageKm.replace(/[\s'.]/g, ""))) {
        found.mileageKm = L.errors.mileage;
      }
      // Optional, so only a non-empty value is checked.
      if (
        form.mileagePickupKm.trim() &&
        !/^\d{1,7}$/.test(form.mileagePickupKm.replace(/[\s'.]/g, ""))
      ) {
        found.mileagePickupKm = L.errors.mileage;
      }
      // A car cannot return with fewer kilometres than it left with. Checked
      // only once both readings parse, so the message is about the comparison
      // rather than about a half-typed number.
      if (!found.mileageKm && !found.mileagePickupKm && form.mileagePickupKm.trim()) {
        const returned = Number(form.mileageKm.replace(/[\s'.]/g, ""));
        const collected = Number(form.mileagePickupKm.replace(/[\s'.]/g, ""));
        if (returned < collected) {
          found.mileageKm = L.errors.mileageBelowPickup;
        }
      }
    }

    if (target === 2) {
      if (!form.papersInside) found.papersInside = L.errors.required;
      if (!form.keyReturned) found.keyReturned = L.errors.required;
      if (!form.cleanliness) found.cleanliness = L.errors.required;
    }

    if (target === 3) {
      if (!form.tickets) found.tickets = L.errors.required;
      if (!form.fullyPaid) found.fullyPaid = L.errors.required;
      // The same cross-field rules the schema enforces at submit, checked
      // here so the customer is stopped on the screen that owns the field.
      if (form.fullyPaid === "yes" && form.paymentMethods.length === 0) {
        found.paymentMethods = L.errors.paymentMethod;
      }
      // The amounts are optional; a filled value must still be a number.
      const paid = parseAmount(form.paidAmountChf);
      if (paid !== undefined && !(paid >= 0 && paid <= 1_000_000)) {
        found.paidAmountChf = L.errors.amount;
      }
      // Money cannot have been paid on a day that has not happened.
      if (form.paidOn && form.paidOn > todayIso()) {
        found.paidOn = L.errors.dateNotFuture;
      }
      if (!form.hasDuePayment) found.hasDuePayment = L.errors.required;
      if (form.hasDuePayment === "yes") {
        const due = parseAmount(form.dueAmountChf);
        if (due !== undefined && !(due >= 0 && due <= 1_000_000)) {
          found.dueAmountChf = L.errors.amount;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
          found.dueDate = L.errors.dueDate;
        } else if (form.dueDate < todayIso()) {
          // "Will be paid on" a past date gives the office nothing to chase.
          found.dueDate = L.errors.dateNotPast;
        }
        if (!form.dueMethod) found.dueMethod = L.errors.required;
      }
      if (!form.depositBack) found.depositBack = L.errors.required;
    }

    if (target === 4) {
      if (!form.lastName.trim()) found.lastName = L.errors.required;
      if (!form.firstName.trim()) found.firstName = L.errors.required;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
        found.email = L.errors.email;
      }
      if (!signature) found.signature = L.errors.signature;
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!validateStep(4) || !vehicle || !signature) return;

    const parsed = returnDetailsSchema.safeParse({
      vehicleId: form.vehicleId,
      mileageKm: Number(form.mileageKm.replace(/[\s'.]/g, "")),
      mileagePickupKm: form.mileagePickupKm.trim()
        ? Number(form.mileagePickupKm.replace(/[\s'.]/g, ""))
        : undefined,
      papersInside: form.papersInside,
      keyReturned: form.keyReturned,
      fuelLevel: form.fuelLevel,
      cleanliness: form.cleanliness,
      damages: form.damages,
      tickets: form.tickets,
      ticketsNote: form.ticketsNote,
      fullyPaid: form.fullyPaid,
      paymentMethods: form.paymentMethods,
      paidAmountChf: parseAmount(form.paidAmountChf),
      paidOn: form.paidOn,
      hasDuePayment: form.hasDuePayment,
      dueAmountChf: parseAmount(form.dueAmountChf),
      dueDate: form.dueDate,
      dueMethod: form.dueMethod || undefined,
      depositBack: form.depositBack,
      lastName: form.lastName,
      firstName: form.firstName,
      email: form.email,
      place: form.place,
    });

    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        const message = issue.message as keyof typeof L.errors;
        found[key] = L.errors[message] ?? L.errors.required;
      }
      setErrors(found);
      // Send them back to the step that owns the first bad field.
      setStep(OWNER_OF_FIELD[Object.keys(found)[0]] ?? 1);
      return;
    }

    setStatus({ kind: "building" });

    try {
      const returnNumber = buildReturnNumber(vehicle.plate);
      const issuedAt = new Date();

      // pdf-lib arrives here the same way it does at pickup submit: loaded
      // when needed, off the critical path of a form opened on mobile data.
      const { buildReturnPdf } = await import("@/lib/rental/returnPdf");
      const bytes = await buildReturnPdf({
        details: parsed.data,
        vehicle,
        returnNumber,
        issuedAt,
        language,
        signaturePng: dataUrlToBytes(signature),
        ownerSignaturePng: ownerSignature
          ? dataUrlToBytes(ownerSignature)
          : undefined,
      });
      const pdf = new Blob([bytes as unknown as BlobPart], {
        type: "application/pdf",
      });

      const fileName = `${returnNumber}.pdf`;
      const url = URL.createObjectURL(pdf);
      setResult({ url, fileName, returnNumber });

      setStatus({ kind: "sending" });

      const body = new FormData();
      body.append("pdf", pdf, fileName);
      body.append(
        "meta",
        JSON.stringify({
          returnNumber,
          vehicleId: vehicle.id,
          customerName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          customerEmail: parsed.data.email,
          vehicleLabel: vehicle.model,
          plate: vehicle.plate,
          mileageKm: parsed.data.mileageKm,
          language,
        })
      );
      // The full answers, so the return can be recorded rather than only read
      // off a PDF. Validated again server-side; see the route.
      body.append("details", JSON.stringify(parsed.data));
      // The signature travels beside the PDF for the same reason the pickup's
      // images do: it is inside the document, but a document is not a place to
      // look one up from.
      body.append(
        "asset:SIGNATURE",
        new Blob([dataUrlToBytes(signature) as unknown as BlobPart], {
          type: "image/png",
        }),
        "signature.png"
      );
      // Honeypot: a real customer never fills a field they cannot see.
      body.append("company", "");

      // Trailing slash, as at pickup: next.config.ts 308s the unslashed path
      // and fetch would re-upload the body to follow it.
      const response = await fetch("/api/rental-return/", {
        method: "POST",
        body,
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          delivered?: "both" | "office";
        };
        setStatus({
          kind: "done",
          outcome: payload.delivered === "office" ? "office" : "both",
        });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      setStatus({
        kind: "done",
        outcome: payload?.code === "mail-not-configured" ? "offline" : "failed",
      });
    } catch (error) {
      console.error("Return submission failed", error);
      setStatus({ kind: "done", outcome: "failed" });
    }
  }

  async function share() {
    if (!result) return;
    try {
      const blob = await (await fetch(result.url)).blob();
      const file = new File([blob], result.fileName, {
        type: "application/pdf",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: result.returnNumber });
      }
    } catch {
      // A cancelled share throws; nothing to recover from.
    }
  }

  // --- Result screen ---------------------------------------------------
  if (status.kind === "done" && result) {
    const { outcome } = status;
    const good = outcome === "both" || outcome === "office";

    const title =
      outcome === "both"
        ? R.result.successTitle
        : outcome === "office"
        ? R.result.partialTitle
        : outcome === "offline"
        ? R.result.offlineTitle
        : L.errors.sendFailed;

    const body =
      outcome === "both"
        ? R.result.successBody
        : outcome === "office"
        ? R.result.partialBody
        : R.result.offlineBody;

    return (
      <section className="bg-gradient-to-b from-slate-50 to-white py-16">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
            {good ? (
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            ) : (
              <TriangleAlert className="mx-auto h-14 w-14 text-amber-500" />
            )}

            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-slate-600">{body}</p>

            <p className="mt-4 text-sm text-slate-500">
              {R.result.referenceNumber}:{" "}
              <span className="font-mono font-medium text-slate-800">
                {result.returnNumber}
              </span>
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={result.url}
                download={result.fileName}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
              >
                <Download className="h-4 w-4" />
                {L.result.download}
              </a>

              <button
                type="button"
                onClick={share}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Share2 className="h-4 w-4" />
                {L.result.share}
              </button>
            </div>

            {/* An open balance noted on the report can be settled here and
                now; shown on every outcome, as at pickup. */}
            <div className="mt-7 border-t border-slate-100 pt-6">
              <p className="text-sm text-slate-600">{L.result.payHint}</p>

              {payChoiceOpen ? (
                <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
                  <a
                    href={PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    {L.result.payWithCard}
                  </a>
                  <a
                    href={TWINT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                  >
                    <Smartphone className="h-4 w-4" />
                    {L.result.payWithTwint}
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPayChoiceOpen(true)}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <CreditCard className="h-4 w-4" />
                  {L.result.payNow}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const busy = status.kind === "building" || status.kind === "sending";

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-12 sm:py-16">
      <div className="container mx-auto max-w-2xl px-4">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {R.pageTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {R.pageIntro}
          </p>
        </header>

        <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {/* --- Step 1: Vehicle ---------------------------------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {L.vehicle.heading}
              </h2>

              <Field label={L.vehicle.select} error={errors.vehicleId} required>
                <select
                  value={form.vehicleId}
                  onChange={(e) => set("vehicleId", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                >
                  <option value="">{L.vehicle.selectPlaceholder}</option>
                  {availableFleet.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.model} — {entry.plate}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={R.mileageReturn}
                hint={L.vehicle.mileageHint}
                error={errors.mileageKm}
                required
              >
                <Input
                  inputMode="numeric"
                  value={form.mileageKm}
                  onChange={(e) => set("mileageKm", e.target.value)}
                  placeholder="66000"
                />
              </Field>

              <Field
                label={R.mileagePickup}
                hint={R.mileagePickupHint}
                error={errors.mileagePickupKm}
              >
                <Input
                  inputMode="numeric"
                  value={form.mileagePickupKm}
                  onChange={(e) => set("mileagePickupKm", e.target.value)}
                  placeholder="65500"
                />
              </Field>

              <Field label={L.vehicle.fuel} required>
                <div className="grid grid-cols-5 gap-1.5">
                  {FUEL_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => set("fuelLevel", level)}
                      className={`rounded-md border px-1 py-2 text-xs transition-colors sm:text-sm ${
                        form.fuelLevel === level
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {level === "empty"
                        ? L.vehicle.fuelEmpty
                        : level === "full"
                        ? L.vehicle.fuelFull
                        : level}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {/* --- Step 2: Condition -------------------------------------- */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {R.conditionHeading}
              </h2>

              <ChoiceField
                label={R.papers}
                value={form.papersInside}
                onChange={(value) => set("papersInside", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.papersInside}
                required
              />

              <ChoiceField
                label={R.key}
                value={form.keyReturned}
                onChange={(value) => set("keyReturned", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.keyReturned}
                required
              />

              <ChoiceField
                label={R.clean}
                value={form.cleanliness}
                onChange={(value) => set("cleanliness", value)}
                options={[
                  { value: "clean", label: R.cleanYes },
                  { value: "needsWash", label: R.cleanNeedsWash },
                ]}
                error={errors.cleanliness}
                required
              />

              <Field label={R.damages} hint={R.damagesHint}>
                <Textarea
                  value={form.damages}
                  onChange={(e) => set("damages", e.target.value)}
                  placeholder={R.damagesNone}
                  rows={3}
                />
              </Field>
            </div>
          )}

          {/* --- Step 3: Payment ---------------------------------------- */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {R.paymentHeading}
              </h2>

              <ChoiceField
                label={R.tickets}
                value={form.tickets}
                onChange={(value) => set("tickets", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.tickets}
                required
              />

              {form.tickets === "yes" && (
                <Field label={R.ticketsNote}>
                  <Textarea
                    value={form.ticketsNote}
                    onChange={(e) => set("ticketsNote", e.target.value)}
                    rows={2}
                  />
                </Field>
              )}

              <ChoiceField
                label={R.fullyPaid}
                value={form.fullyPaid}
                onChange={(value) => set("fullyPaid", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.fullyPaid}
                required
              />

              <Field label={R.methods} error={errors.paymentMethods}>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                        form.paymentMethods.includes(method)
                          ? "border-slate-800 bg-slate-50 text-slate-900"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.paymentMethods.includes(method)}
                        onChange={() => toggleMethod(method)}
                        className="h-4 w-4 accent-slate-800"
                      />
                      {methodName[method]}
                    </label>
                  ))}
                </div>
              </Field>

              {/* The Abrechnung figures from the paper protocol. Optional:
                  the office holds the invoice, so a customer without the
                  numbers to hand is not blocked. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={R.paidAmount} error={errors.paidAmountChf}>
                  <Input
                    inputMode="decimal"
                    value={form.paidAmountChf}
                    onChange={(e) => set("paidAmountChf", e.target.value)}
                    placeholder="350"
                  />
                </Field>

                <Field label={R.paidOn} error={errors.paidOn}>
                  {/* Bounded at today, so the picker itself cannot offer a
                      date on which nothing can have been paid yet. Set only
                      after mount: this page is prerendered, and a date
                      computed at build time would not match the browser's. */}
                  <Input
                    type="date"
                    value={form.paidOn}
                    max={now ? todayIso(now) : undefined}
                    onChange={(e) => set("paidOn", e.target.value)}
                  />
                </Field>
              </div>

              <ChoiceField
                label={R.duePayment}
                value={form.hasDuePayment}
                onChange={(value) => set("hasDuePayment", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.hasDuePayment}
                required
              />

              {form.hasDuePayment === "yes" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={R.dueAmount} error={errors.dueAmountChf}>
                    <Input
                      inputMode="decimal"
                      value={form.dueAmountChf}
                      onChange={(e) => set("dueAmountChf", e.target.value)}
                      placeholder="500"
                    />
                  </Field>

                  <Field label={R.dueDate} error={errors.dueDate} required>
                    {/* Today or later: a promise to pay cannot point back. */}
                    <Input
                      type="date"
                      value={form.dueDate}
                      min={now ? todayIso(now) : undefined}
                      onChange={(e) => set("dueDate", e.target.value)}
                    />
                  </Field>

                  <Field label={R.dueMethod} error={errors.dueMethod} required>
                    <select
                      value={form.dueMethod}
                      onChange={(e) =>
                        set(
                          "dueMethod",
                          e.target.value as FormState["dueMethod"]
                        )
                      }
                      className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                    >
                      <option value="">{L.vehicle.selectPlaceholder}</option>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {methodName[method]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              <ChoiceField
                label={R.deposit}
                value={form.depositBack}
                onChange={(value) => set("depositBack", value)}
                options={[
                  { value: "yes", label: R.yes },
                  { value: "no", label: R.no },
                ]}
                error={errors.depositBack}
                required
              />
            </div>
          )}

          {/* --- Step 4: Renter and signature ---------------------------- */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {R.renterHeading}
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label={L.details.lastName}
                    error={errors.lastName}
                    required
                  >
                    <Input
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      autoComplete="family-name"
                    />
                  </Field>

                  <Field
                    label={L.details.firstName}
                    error={errors.firstName}
                    required
                  >
                    <Input
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      autoComplete="given-name"
                    />
                  </Field>
                </div>

                <Field
                  label={L.details.email}
                  hint={R.emailHint}
                  error={errors.email}
                  required
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {R.renterSignature}
                </h3>
                <SignaturePad
                  language={language}
                  onChange={(dataUrl) => {
                    setSignature(dataUrl);
                    if (dataUrl) {
                      setErrors((prev) => ({ ...prev, signature: "" }));
                    }
                  }}
                />
                {errors.signature && (
                  <p className="text-sm text-rose-600">{errors.signature}</p>
                )}
              </div>

              {/* Optional counter-signature for when a ZURIAUTO person is
                  present at the return; a key-drop return skips it and the
                  PDF prints an empty signature line instead. */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {R.ownerSignature}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    {R.optional}
                  </span>
                </h3>
                <SignaturePad language={language} onChange={setOwnerSignature} />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">{L.signature.place}</Label>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <span className="block text-xs text-slate-500">
                      {L.signature.placeOnly}
                    </span>
                    <Input
                      className="h-10"
                      value={form.place}
                      onChange={(e) => set("place", e.target.value)}
                      placeholder={L.signature.placeOnly}
                      aria-label={L.signature.placeOnly}
                    />
                  </div>

                  {/* Read-only, as at pickup: the authoritative timestamp is
                      taken at submit. */}
                  <Stamp
                    caption={L.signature.dateOnly}
                    icon={<CalendarDays className="h-4 w-4 text-slate-400" />}
                    value={now ? formatDatePart(now) : "—"}
                  />
                  <Stamp
                    caption={L.signature.timeOnly}
                    icon={<Clock className="h-4 w-4 text-slate-400" />}
                    value={now ? formatTimePart(now) : "—"}
                  />
                </div>

                <p className="text-xs text-slate-500">
                  {L.signature.stampedNote}
                </p>
              </div>
            </div>
          )}

          {/* --- Navigation --- */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || busy}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:invisible"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "de" ? "Zurück" : "Back"}
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
              >
                {language === "de" ? "Weiter" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {status.kind === "building"
                  ? L.submit.working
                  : status.kind === "sending"
                  ? L.submit.sending
                  : R.submit}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A question answered by picking exactly one of a few options — the return
 * form's yes/no rows and the clean/needs-wash row. Buttons rather than radio
 * dots, matching the fuel gauge control the pickup flow established.
 */
function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label: string;
  value: "" | T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-700">
        {label}
        {required && <span className="-ml-1 text-rose-500">*</span>}
      </Label>
      <div
        className={`grid gap-2 ${
          options.length === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              value === option.value
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/** A read-only value cell, for figures the form records rather than collects. */
function Stamp({
  caption,
  icon,
  value,
}: {
  caption: string;
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-slate-500">{caption}</span>
      <div
        className="flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-slate-50 px-3"
        aria-label={caption}
      >
        {icon}
        <span className="text-sm tabular-nums text-slate-700">{value}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-700">
        {label}
        {required && <span className="-ml-1 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
