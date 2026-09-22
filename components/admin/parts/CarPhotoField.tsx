"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/rental/imageCompress";
import type { Car, Labels } from "@/components/admin/types";

/**
 * A car's photograph, in the dialog that owns the car's identity.
 *
 * It lives beside the model, the plate and the chassis number because that is
 * the category it belongs to: what this car *is*. It began life in the
 * maintenance dialog, which was the wrong box — a photograph is not a service
 * record, and it was there only because that dialog happened to be the new
 * surface being built at the time.
 *
 * The one thing that makes it sit slightly oddly in a form: it writes
 * immediately, while every other field in that dialog waits for Speichern.
 * It has to, because the bytes go to their own endpoint rather than into the
 * JSON patch the form submits. So the section says so in words rather than
 * leaving somebody to discover that closing without saving kept the photo
 * anyway.
 */
export function CarPhotoField({
  car,
  L,
  busy,
  onUpload,
  onRemove,
  saveNote = true,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onUpload: (blob: Blob) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  /** Off when the caller states it once for several controls that all write
   *  immediately — the edit dialog puts this beside the registration, and the
   *  same sentence twice in one row reads as two different warnings. */
  saveNote?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <section className="grid gap-2 border-b border-[var(--admin-rule)] pb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
        {L.fleet.photoHeading}
      </h3>

      <div className="flex items-start gap-3">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]">
          {car.photoUrl ? (
            // A plain <img>, not next/image: the source is an API route whose
            // bytes are already sized to 1600px by the browser that uploaded
            // them, and the optimiser would add a second round trip for a
            // thumbnail this small.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={car.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera
              className="h-6 w-6 text-[var(--admin-faint)]"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs text-[var(--admin-faint)]">{L.fleet.photoHint}</p>

          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              // Reset at once, so choosing the same file twice in a row —
              // after a failure — fires the change event again.
              event.target.value = "";
              if (!file) return;

              setProblem(null);
              setWorking(true);
              try {
                /**
                 * Compressed here, in the browser, exactly as the identity
                 * captures are. A photo straight off a phone is 3-6 MB and
                 * the platform caps a function request at roughly 4.5 MB, so
                 * this is not an optimisation — without it the upload fails
                 * outright on the phone the office actually uses.
                 */
                const { blob } = await compressImage(file, {
                  maxEdge: 1600,
                  quality: 0.75,
                });
                await onUpload(blob);
              } catch {
                setProblem(L.fleet.photoFailed);
              } finally {
                setWorking(false);
              }
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || working}
              onClick={() => input.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-40"
            >
              {working ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {working
                ? L.fleet.photoUploading
                : car.photoUrl
                  ? L.fleet.photoReplace
                  : L.fleet.photoChoose}
            </button>

            {car.photoUrl && (
              <button
                type="button"
                disabled={busy || working}
                onClick={() => void onRemove()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-[var(--admin-faint)] underline transition-colors hover:text-[var(--admin-crit)] disabled:opacity-40"
              >
                {L.fleet.photoRemove}
              </button>
            )}
          </div>

          {/* Said out loud, because this control does not wait for Speichern.
              Somebody who replaces a photo and then closes on Abbrechen has
              still replaced it. */}
          {saveNote && (
            <p className="text-xs text-[var(--admin-faint)]">
              {L.fleet.photoSavesNow}
            </p>
          )}

          {problem && <p className="text-xs text-[var(--admin-crit)]">{problem}</p>}
        </div>
      </div>
    </section>
  );
}
