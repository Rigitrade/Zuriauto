"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Loader2, Upload, X } from "lucide-react";
import {
  compressImage,
  type CapturedDocument,
} from "@/lib/rental/imageCompress";
import { acceptPdfFile, looksLikePdf } from "@/lib/rental/pdfUpload";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";
import CameraCapture from "./CameraCapture";

/**
 * A single photo slot, filled from a live camera or from a file.
 *
 * The camera is primary: it works on a phone and on a laptop webcam alike,
 * which a file input with `capture` does not — on a desktop that only ever
 * produces a file picker. The file route stays available because camera access
 * can be refused, absent, or blocked by an insecure origin, and none of those
 * should stop the customer finishing.
 *
 * Compression runs the moment an image arrives rather than at submit, so the
 * wait happens while they are still filling the form and an oversized set is
 * caught before they have signed.
 */

/** Which pick-time failure to explain; each maps to its own message. */
type Failure = "image-read" | "file-read" | "file-too-large" | null;

interface PhotoCaptureProps {
  label: string;
  language: RentalLanguage;
  value: CapturedDocument | null;
  onChange: (document: CapturedDocument | null) => void;
  required?: boolean;
  error?: string;
  /** Front camera for a portrait, rear for documents. */
  facing?: "environment" | "user";
  /**
   * Also accept an uploaded PDF in this slot, for customers who hold their
   * document as a scan rather than a photo. Off for slots that are by nature
   * photographs (the portrait, the condition photos).
   */
  allowPdf?: boolean;
}

export default function PhotoCapture({
  label,
  language,
  value,
  onChange,
  required = false,
  error,
  facing = "environment",
  allowPdf = false,
}: PhotoCaptureProps) {
  const L = labelsFor(language).documents;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Failure>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // The object URL is owned by whoever created it; release it when this slot
  // stops showing that image, or the blob leaks for the life of the tab.
  // PDFs never get one: their preview is a file card, not a rendered blob.
  useEffect(() => {
    return () => {
      if (value?.kind === "image") URL.revokeObjectURL(value.previewUrl);
    };
    // Intentionally keyed on the URL: a new image means the old one is gone.
  }, [value?.kind === "image" ? value.previewUrl : null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accept(source: Blob) {
    setBusy(true);
    setFailed(null);
    try {
      onChange(await compressImage(source));
    } catch {
      setFailed("image-read");
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  async function acceptPdf(file: File) {
    setBusy(true);
    setFailed(null);
    try {
      onChange(await acceptPdfFile(file));
    } catch (cause) {
      setFailed(
        cause instanceof Error && cause.message === "file-too-large"
          ? "file-too-large"
          : "file-read"
      );
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allows re-picking the same file, which otherwise fires no change event.
    event.target.value = "";
    if (!file) return;
    if (allowPdf && looksLikePdf(file)) await acceptPdf(file);
    else await accept(file);
  }

  function remove() {
    onChange(null);
    setFailed(null);
  }

  const E = labelsFor(language).errors;
  const message = failed
    ? {
        "image-read": E.imageRead,
        "file-read": E.fileRead,
        "file-too-large": E.fileTooLarge,
      }[failed]
    : error;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>

      {/* `capture` is a hint for mobile; on desktop this is a plain file
          picker, which is exactly its role here — the fallback. It is dropped
          when PDFs are allowed: on Android it sends the input straight to the
          camera, which would make a stored PDF unreachable. */}
      <input
        ref={inputRef}
        type="file"
        accept={allowPdf ? "image/*,application/pdf,.pdf" : "image/*"}
        capture={allowPdf ? undefined : facing}
        onChange={handleFile}
        className="sr-only"
      />

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value.kind === "image" ? (
            /* Local blob preview; next/image would add no value over a URL the
               browser already holds in memory. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={value.previewUrl}
              alt={label}
              className="max-h-56 w-full object-contain"
            />
          ) : (
            /* A file card rather than a rendered page: inline PDF rendering is
               unreliable on mobile, and the name is what confirms the pick. */
            <div className="flex items-center gap-3 px-4 py-6">
              <FileText className="h-8 w-8 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {value.fileName}
                </p>
                <p className="text-xs uppercase text-slate-500">PDF</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
            {/* Replacing a PDF means picking another file; replacing a photo
                means the camera. Each card leads with its own route back. */}
            <button
              type="button"
              onClick={() =>
                value.kind === "pdf"
                  ? inputRef.current?.click()
                  : setCameraOpen(true)
              }
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              {value.kind === "pdf" ? L.chooseFile : L.retake}
            </button>
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1 text-sm text-rose-600 transition-colors hover:text-rose-700"
            >
              <X className="h-4 w-4" />
              {L.remove}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-lg border-2 border-dashed ${
            message
              ? "border-rose-300 bg-rose-50"
              : "border-slate-300 bg-slate-50"
          }`}
        >
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={busy}
            className={`flex h-28 w-full flex-col items-center justify-center gap-2 transition-colors ${
              message
                ? "text-rose-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
            <span className="text-sm">{L.openCamera}</span>
          </button>

          <div className="border-t border-slate-200/70 px-3 py-2 text-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
            >
              <Upload className="h-3.5 w-3.5" />
              {L.chooseFile}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-rose-600">{message}</p>}

      {cameraOpen && (
        <CameraCapture
          language={language}
          title={label}
          facing={facing}
          onCapture={async (photo) => {
            setCameraOpen(false);
            await accept(photo);
          }}
          onClose={() => setCameraOpen(false)}
          onChooseFile={() => {
            setCameraOpen(false);
            inputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
