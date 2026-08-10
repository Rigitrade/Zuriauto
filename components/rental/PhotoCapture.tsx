"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import {
  compressImage,
  type CompressedImage,
} from "@/lib/rental/imageCompress";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";

/**
 * A single photo slot: opens the camera on mobile, downscales immediately.
 *
 * Compression runs on selection rather than at submit so the wait happens
 * while the customer is still filling the form, and so an oversized set of
 * photos is caught before they have signed.
 */

interface PhotoCaptureProps {
  label: string;
  language: RentalLanguage;
  value: CompressedImage | null;
  onChange: (image: CompressedImage | null) => void;
  required?: boolean;
  error?: string;
}

export default function PhotoCapture({
  label,
  language,
  value,
  onChange,
  required = false,
  error,
}: PhotoCaptureProps) {
  const L = labelsFor(language).documents;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The object URL is owned by whoever created it; release it when this slot
  // stops showing that image, or the blob leaks for the life of the tab.
  useEffect(() => {
    return () => {
      if (value) URL.revokeObjectURL(value.previewUrl);
    };
    // Intentionally keyed on the URL: a new image means the old one is gone.
  }, [value?.previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allows re-picking the same file, which otherwise fires no change event.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setFailed(false);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      setFailed(true);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    onChange(null);
    setFailed(false);
  }

  const message = failed ? labelsFor(language).errors.imageRead : error;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="sr-only"
      />

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* Local blob preview; next/image would add no value over a URL the
              browser already holds in memory. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.previewUrl}
            alt={label}
            className="max-h-56 w-full object-contain"
          />

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              {L.retake}
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
            message
              ? "border-rose-300 bg-rose-50 text-rose-600"
              : "border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400 hover:text-slate-700"
          }`}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
          <span className="text-sm">{L.take}</span>
        </button>
      )}

      {message && <p className="text-sm text-rose-600">{message}</p>}
    </div>
  );
}
