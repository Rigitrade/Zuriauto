"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Share2,
  TriangleAlert,
} from "lucide-react";
import StepIndicator from "@/components/car-rental/booking/StepIndicator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/hooks/use-i18n";
import { GTC_DATE } from "@/locales/gtc";
import {
  availableFleet,
  findVehicle,
  FUEL_LEVELS,
  type FuelLevel,
} from "@/lib/rental/fleet";
import { asRentalLanguage, labelsFor } from "@/lib/rental/labels";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  PRIORITY_COUNT,
} from "@/lib/rental/countries";
import {
  recompress,
  toUint8Array,
  type CompressedImage,
} from "@/lib/rental/imageCompress";
import {
  ageOn,
  buildContractNumber,
  contractDetailsSchema,
  type ContractDetails,
} from "@/lib/rental/schema";
import {
  formatDateInput,
  parseTypedDate,
  toTypedDate,
} from "@/lib/rental/dateInput";
import GtcAcceptance from "./GtcAcceptance";
import PhotoCapture from "./PhotoCapture";
import SignaturePad from "./SignaturePad";

/**
 * The pickup contract flow.
 *
 * Everything up to the PDF happens in the browser; the only server call sends
 * the finished document by email. If that call fails for any reason the
 * customer is still handed the PDF, because losing a completed signature and
 * two document photos to a mail error is the worst outcome available here.
 */

const TOTAL_STEPS = 4;

/** Vercel caps a serverless request body near 4.5 MB; leave room for headers. */
const SOFT_LIMIT = 3.5 * 1024 * 1024;
const HARD_LIMIT = 4.0 * 1024 * 1024;

const MAX_CONDITION_PHOTOS = 4;

type Status =
  | { kind: "editing" }
  | { kind: "building" }
  | { kind: "sending" }
  | { kind: "done"; outcome: "both" | "office" | "offline" | "failed" };

interface FormState {
  vehicleId: string;
  mileageKm: string;
  fuelLevel: FuelLevel;
  existingDamage: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  mobile: string;
  email: string;
  place: string;
}

/**
 * The four identity images, in the order they appear in the PDF.
 *
 * Held as a keyed record rather than four pieces of state so validation and
 * the oversize retry can iterate them instead of repeating themselves.
 */
const DOCUMENT_SLOTS = [
  { key: "idFront", label: "idFront", error: "idFrontPhoto" },
  { key: "idBack", label: "idBack", error: "idBackPhoto" },
  { key: "licenceFront", label: "licenceFront", error: "licenceFrontPhoto" },
  { key: "licenceBack", label: "licenceBack", error: "licenceBackPhoto" },
] as const;

type DocumentKey = (typeof DOCUMENT_SLOTS)[number]["key"];

type DocumentImages = Record<DocumentKey, CompressedImage | null>;

const EMPTY_DOCUMENTS: DocumentImages = {
  idFront: null,
  idBack: null,
  licenceFront: null,
  licenceBack: null,
};

const EMPTY_FORM: FormState = {
  vehicleId: availableFleet.length === 1 ? availableFleet[0].id : "",
  mileageKm: "",
  fuelLevel: "full",
  existingDamage: "",
  lastName: "",
  firstName: "",
  birthDate: "",
  street: "",
  postalCode: "",
  city: "",
  country: DEFAULT_COUNTRY,
  mobile: "",
  email: "",
  place: "Zurich",
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

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function RentalPickupWizard() {
  const { currentLanguage } = useI18n();
  const language = asRentalLanguage(currentLanguage);
  const L = labelsFor(language);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [documents, setDocuments] = useState<DocumentImages>(EMPTY_DOCUMENTS);
  const [conditionPhotos, setConditionPhotos] = useState<
    (CompressedImage | null)[]
  >([null]);
  const [signature, setSignature] = useState<string | null>(null);
  const [gtcAccepted, setGtcAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const [result, setResult] = useState<{
    url: string;
    fileName: string;
    contractNumber: string;
  } | null>(null);

  const vehicle = useMemo(() => findVehicle(form.vehicleId), [form.vehicleId]);

  // The stamp shown next to the place. Ticks so a form left open for ten
  // minutes does not display a time that disagrees with the one the PDF
  // records at submit.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const birthDatePickerRef = useRef<HTMLInputElement | null>(null);

  /**
   * Bounds for the native picker, so it cannot offer a future date or one a
   * century and a half ago.
   *
   * Derived from `now` rather than computed during render: this page is
   * statically prerendered, so a date calculated at build time would not match
   * the one the browser calculates and hydration would complain.
   */
  const birthDateBounds = useMemo(() => {
    if (!now) return undefined;
    const iso = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
      min: iso(new Date(now.getFullYear() - 120, now.getMonth(), now.getDate())),
      max: iso(now),
    };
  }, [now]);

  /**
   * Opens the platform date picker.
   *
   * `showPicker` is the supported route on Chrome, Edge and Safari 16+, but it
   * must come from a user gesture and throws if the browser declines. Older
   * Safari and some Android browsers open the native wheel on a plain click
   * instead, so that is the fallback rather than leaving the button dead.
   */
  function openBirthDatePicker() {
    const el = birthDatePickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
      return;
    } catch {
      // Fall through to the click fallback below.
    }
    el.focus();
    el.click();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function acceptGtc(accepted: boolean) {
    setGtcAccepted(accepted);
    setAcceptedAt(accepted ? new Date().toISOString() : null);
    if (accepted) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.gtc;
        return next;
      });
    }
  }

  function validateStep(target: number): boolean {
    const found: Record<string, string> = {};

    if (target === 1) {
      if (!vehicle) found.vehicleId = L.errors.vehicle;
      if (!/^\d{1,7}$/.test(form.mileageKm.replace(/[\s'.]/g, ""))) {
        found.mileageKm = L.errors.mileage;
      }
    }

    if (target === 2) {
      for (const key of [
        "lastName",
        "firstName",
        "street",
        "postalCode",
        "city",
        "mobile",
      ] as const) {
        if (!form[key].trim()) found[key] = L.errors.required;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
        found.email = L.errors.email;
      }
      // `ageOn` is the schema's own rule rather than a second calculation
      // here. The previous division by 365.25 could disagree with it within a
      // day of a birthday, letting the form advance on an age the schema then
      // rejected at submit — after the customer had signed.
      const birthDateIso = parseTypedDate(form.birthDate);
      if (!birthDateIso) {
        found.birthDate = L.errors.birthDate;
      } else {
        const age = ageOn(birthDateIso);
        if (age < 18) found.birthDate = L.errors.minor;
        else if (age >= 120) found.birthDate = L.errors.birthDate;
      }
    }

    if (target === 2 && !form.country.trim()) {
      found.country = L.errors.country;
    }

    if (target === 3) {
      for (const slot of DOCUMENT_SLOTS) {
        if (!documents[slot.key]) found[slot.key] = L.errors[slot.error];
      }
    }

    if (target === 4) {
      if (!gtcAccepted) found.gtc = L.errors.gtc;
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

  async function assemble(
    details: ContractDetails,
    photos: { docs: DocumentImages; condition: CompressedImage[] },
    contractNumber: string,
    issuedAt: Date
  ): Promise<Blob> {
    // pdf-lib is ~250 kB and is only needed once, at submit. Loading it here
    // keeps it off the critical path for a form opened on mobile data.
    const { buildContractPdf } = await import("@/lib/rental/contractPdf");

    const bytes = await buildContractPdf({
      details,
      vehicle: vehicle!,
      contractNumber,
      issuedAt,
      language,
      idFrontPhoto: await toUint8Array(photos.docs.idFront!.blob),
      idBackPhoto: await toUint8Array(photos.docs.idBack!.blob),
      licenceFrontPhoto: await toUint8Array(photos.docs.licenceFront!.blob),
      licenceBackPhoto: await toUint8Array(photos.docs.licenceBack!.blob),
      conditionPhotos: await Promise.all(
        photos.condition.map((photo) => toUint8Array(photo.blob))
      ),
      signaturePng: dataUrlToBytes(signature!),
    });
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  }

  async function submit() {
    const allDocuments = DOCUMENT_SLOTS.every((slot) => documents[slot.key]);
    if (!validateStep(4) || !vehicle || !signature || !allDocuments) {
      return;
    }

    const parsed = contractDetailsSchema.safeParse({
      vehicleId: form.vehicleId,
      mileageKm: Number(form.mileageKm.replace(/[\s'.]/g, "")),
      fuelLevel: form.fuelLevel,
      existingDamage: form.existingDamage,
      lastName: form.lastName,
      firstName: form.firstName,
      // The field holds DD.MM.YYYY; the schema and the PDF work in ISO.
      birthDate: parseTypedDate(form.birthDate) ?? "",
      street: form.street,
      postalCode: form.postalCode,
      city: form.city,
      country: form.country,
      mobile: form.mobile,
      email: form.email,
      gtcAccepted: gtcAccepted as true,
      gtcVersion: GTC_DATE,
      gtcLanguage: language,
      acceptedAt: acceptedAt ?? new Date().toISOString(),
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
      const ownerOfField: Record<string, number> = {
        vehicleId: 1,
        mileageKm: 1,
        fuelLevel: 1,
      };
      setStep(ownerOfField[Object.keys(found)[0]] ?? 2);
      return;
    }

    setStatus({ kind: "building" });

    try {
      const contractNumber = buildContractNumber(vehicle.plate);
      const issuedAt = new Date();
      let condition = conditionPhotos.filter(Boolean) as CompressedImage[];

      let docs = documents;

      let pdf = await assemble(
        parsed.data,
        { docs, condition },
        contractNumber,
        issuedAt
      );

      // One retry at lower quality before giving up. Six photos of a phone
      // camera's output vary enough that a first pass can still land over the
      // request limit — and with front and back of both documents there are
      // now twice as many as before.
      if (pdf.size > SOFT_LIMIT) {
        const harder = { maxEdge: 1200, quality: 0.55 };

        const shrunkDocuments = await Promise.all(
          DOCUMENT_SLOTS.map(async (slot) => [
            slot.key,
            await recompress(documents[slot.key]!, harder),
          ] as const)
        );
        docs = Object.fromEntries(shrunkDocuments) as DocumentImages;

        condition = await Promise.all(
          condition.map((photo) => recompress(photo, harder))
        );

        setDocuments(docs);
        setConditionPhotos(condition.length ? condition : [null]);

        pdf = await assemble(
          parsed.data,
          { docs, condition },
          contractNumber,
          issuedAt
        );
      }

      const fileName = `${contractNumber}.pdf`;
      const url = URL.createObjectURL(pdf);
      setResult({ url, fileName, contractNumber });

      if (pdf.size > HARD_LIMIT) {
        setErrors({ form: L.errors.tooLarge });
        setStatus({ kind: "done", outcome: "failed" });
        return;
      }

      setStatus({ kind: "sending" });

      const body = new FormData();
      body.append("pdf", pdf, fileName);
      body.append(
        "meta",
        JSON.stringify({
          contractNumber,
          customerName: `${parsed.data.firstName} ${parsed.data.lastName}`,
          customerEmail: parsed.data.email,
          vehicleLabel: vehicle.model,
          plate: vehicle.plate,
          mileageKm: parsed.data.mileageKm,
          language,
        })
      );
      // Honeypot: a real customer never fills a field they cannot see.
      body.append("company", "");

      // Trailing slash is deliberate: `trailingSlash: true` in next.config.ts
      // 308-redirects the unslashed path, and fetch would re-upload the whole
      // multi-megabyte body to follow it.
      const response = await fetch("/api/rental-contract/", {
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
      console.error("Contract submission failed", error);
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
        await navigator.share({ files: [file], title: result.contractNumber });
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
        ? L.result.successTitle
        : outcome === "office"
        ? L.result.partialTitle
        : outcome === "offline"
        ? L.result.offlineTitle
        : L.errors.sendFailed;

    const body =
      outcome === "both"
        ? L.result.successBody
        : outcome === "office"
        ? L.result.partialBody
        : outcome === "offline"
        ? L.result.offlineBody
        : (errors.form ?? L.result.offlineBody);

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
              {L.result.contractNumber}:{" "}
              <span className="font-mono font-medium text-slate-800">
                {result.contractNumber}
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
            {L.pageTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {L.pageIntro}
          </p>
        </header>

        <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
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

              {vehicle && (
                <dl className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">{L.vehicle.plate}</dt>
                    <dd className="font-medium text-slate-900">
                      {vehicle.plate}
                    </dd>
                  </div>
                  {/* Hidden when unknown, matching the PDF: an empty chassis
                      row looks like a fault rather than missing reference
                      data. */}
                  {vehicle.vin && (
                    <div>
                      <dt className="text-slate-500">{L.vehicle.vin}</dt>
                      <dd className="font-medium text-slate-900">
                        {vehicle.vin}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              <Field
                label={L.vehicle.mileage}
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

              <Field label={L.vehicle.fuel} required>
                {/* Five positions, low to high, mirroring the dashboard gauge.
                    Tighter gap and smaller text than the four-way version so
                    "Leer" and "Voll" still fit on a narrow phone. */}
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

              <Field label={L.vehicle.damage} hint={L.vehicle.damageHint}>
                <Textarea
                  value={form.existingDamage}
                  onChange={(e) => set("existingDamage", e.target.value)}
                  placeholder={L.vehicle.damageNone}
                  rows={3}
                />
              </Field>

              <div className="space-y-3">
                <span className="block text-sm font-medium text-slate-700">
                  {L.vehicle.conditionPhotos}
                </span>
                <p className="-mt-2 text-xs text-slate-500">
                  {L.vehicle.conditionPhotosHint}
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {conditionPhotos.map((photo, index) => (
                    <PhotoCapture
                      key={index}
                      label={`${L.pdf.conditionPhoto} ${index + 1}`}
                      language={language}
                      value={photo}
                      onChange={(image) => {
                        setConditionPhotos((prev) => {
                          const next = [...prev];
                          next[index] = image;
                          const filled = next.filter(Boolean).length;
                          if (
                            image &&
                            filled === next.length &&
                            next.length < MAX_CONDITION_PHOTOS
                          ) {
                            next.push(null);
                          }
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {L.details.heading}
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={L.details.lastName} error={errors.lastName} required>
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
                label={L.details.birthDate}
                hint={L.details.birthDateHint}
                error={errors.birthDate}
                required
              >
                {/* Both routes to the same value. Typing is primary — eight
                    digits beats scrolling a calendar back five decades for a
                    birth year — with the platform picker a tap away for
                    anyone who would rather not type. */}
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={form.birthDate}
                    onChange={(e) =>
                      set("birthDate", formatDateInput(e.target.value))
                    }
                    placeholder={L.details.birthDatePlaceholder}
                    maxLength={10}
                    autoComplete="bday"
                    className="min-w-0 flex-1"
                  />

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={openBirthDatePicker}
                      aria-label={L.details.birthDatePick}
                      title={L.details.birthDatePick}
                      // w-11 is 44px — a comfortable touch target next to a
                      // 40px-tall field, rather than a 40px one that gets
                      // mistapped on a phone.
                      className="flex h-10 w-11 items-center justify-center rounded-md border border-input bg-white text-slate-500 transition-colors hover:bg-slate-50 active:bg-slate-100"
                    >
                      <CalendarDays className="h-4 w-4" />
                    </button>

                    {/* The native control, rendered but invisible behind the
                        button. It cannot be `display: none` — showPicker()
                        throws on an element that is not rendered — and
                        pointer-events-none stops the transparent field
                        swallowing the tap, which on desktop would focus an
                        invisible input instead of opening the calendar.
                        tabIndex -1 keeps it out of the tab order so keyboard
                        users meet one date field, not two. */}
                    <input
                      ref={birthDatePickerRef}
                      type="date"
                      tabIndex={-1}
                      aria-hidden="true"
                      value={parseTypedDate(form.birthDate) ?? ""}
                      min={birthDateBounds?.min}
                      max={birthDateBounds?.max}
                      onChange={(e) =>
                        set("birthDate", toTypedDate(e.target.value))
                      }
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                    />
                  </div>
                </div>
              </Field>

              <Field label={L.details.street} error={errors.street} required>
                <Input
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                  autoComplete="street-address"
                />
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field
                  label={L.details.postalCode}
                  error={errors.postalCode}
                  required
                >
                  <Input
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                    autoComplete="postal-code"
                    inputMode="numeric"
                  />
                </Field>

                <div className="col-span-2">
                  <Field label={L.details.city} error={errors.city} required>
                    <Input
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                      autoComplete="address-level2"
                    />
                  </Field>
                </div>
              </div>

              <Field label={L.details.country} error={errors.country} required>
                <select
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                >
                  {COUNTRIES.map((name, index) => (
                    <option
                      key={name}
                      value={name}
                      // A rule after the priority block, so Switzerland and its
                      // neighbours read as a shortlist rather than a jumbled
                      // alphabet.
                      className={
                        index === PRIORITY_COUNT
                          ? "border-t border-slate-200"
                          : undefined
                      }
                    >
                      {name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={L.details.mobile} error={errors.mobile} required>
                <Input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  placeholder="+41 79 222 22 22"
                  autoComplete="tel"
                />
              </Field>

              <Field
                label={L.details.email}
                hint={L.details.emailHint}
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
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {L.documents.heading}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {L.documents.intro}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {DOCUMENT_SLOTS.map((slot) => (
                  <PhotoCapture
                    key={slot.key}
                    label={L.documents[slot.label]}
                    language={language}
                    value={documents[slot.key]}
                    onChange={(image) => {
                      setDocuments((prev) => ({ ...prev, [slot.key]: image }));
                      setErrors((prev) => ({ ...prev, [slot.key]: "" }));
                    }}
                    required
                    error={errors[slot.key] || undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <GtcAcceptance
                language={language}
                accepted={gtcAccepted}
                onAcceptedChange={acceptGtc}
                error={errors.gtc}
              />

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {L.signature.heading}
                </h3>
                <SignaturePad
                  language={language}
                  disabled={!gtcAccepted}
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

              {/* Three separate cells rather than a place field with the
                  timestamp squeezed into an auto-sized box beside it. Each
                  part of "Ort, Datum, Uhrzeit" gets its own labelled column,
                  which is both roomier and clearer about which value is which. */}
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

                  {/* Read-only: the authoritative timestamp is taken at submit,
                      so letting anyone edit it here would be misleading.
                      Values render only after mount — formatting on the server
                      would produce a different clock and hydration would
                      complain. */}
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
                  : L.submit.button}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
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
