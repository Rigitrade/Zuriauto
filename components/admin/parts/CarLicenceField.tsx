"use client";

import { useRef, useState } from "react";
import { FileText, IdCard, Loader2 } from "lucide-react";
import {
  CAR_LICENCE_MAX_BYTES,
  normaliseCarLicenceType,
  refuseCarLicence,
} from "@/lib/admin/carLicence";
import { compressImage } from "@/lib/rental/imageCompress";
import { day } from "@/components/admin/format";
import type { Car, Labels } from "@/components/admin/types";

/**
 * A car's vehicle registration document (Fahrzeugausweis).
 *
 * Beside the photograph, because both answer "what is this car" — but it is
 * deliberately not the same control, and the difference is who may see it. The
 * photograph is public: the pickup form shows it to a customer at the kerb who
 * is signed into nothing. This document names the holder, the first
 * registration and the weights, so it is served only to a signed-in office
 * account, and the note under it says so rather than leaving somebody to
 * assume it travels like the picture above it.
 *
 * It accepts a PDF as well as an image, which the photograph does not. The
 * office already scans these; asking somebody to photograph a document they
 * hold in a better form would be a rule invented for the convenience of the
 * code. A PDF is shown as a document link, an image as a thumbnail — a page
 * one of a scanned Fahrzeugausweis makes a poor thumbnail anyway.
 *
 * Like the photograph, it writes immediately rather than waiting for Speichern,
 * because the bytes go to their own endpoint rather than into the dialog's JSON
 * patch. And like the photograph, it says so out loud.
 */
export function CarLicenceField({
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
  onUpload: (file: Blob) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
  /** Off when the caller says it once for both documents. See the
   *  photograph's. */
  saveNote?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const isPdf = car.licenceIsPdf === true;

  return (
    <section className="grid gap-2 border-b border-[var(--admin-rule)] pb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
        {L.fleet.licenceHeading}
      </h3>

      <div className="flex items-start gap-3">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]">
          {car.licenceUrl ? (
            isPdf ? (
              <FileText
                className="h-6 w-6 text-[var(--admin-muted)]"
                aria-hidden="true"
              />
            ) : (
              // A plain <img> for the reason the photograph uses one: the
              // source is an API route, and the optimiser would add a second
              // round trip for a thumbnail this small. This one is also
              // `no-store`, so there would be nothing for it to cache.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={car.licenceUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <IdCard
              className="h-6 w-6 text-[var(--admin-faint)]"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs text-[var(--admin-faint)]">
            {L.fleet.licenceHint}
          </p>

          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              // Reset at once, so choosing the same file again after a
              // failure fires the change event.
              event.target.value = "";
              if (!file) return;

              setProblem(null);
              setWorking(true);
              try {
                /**
                 * An image is recompressed; a PDF is sent as it is.
                 *
                 * A PDF cannot go through a canvas, and re-encoding one in the
                 * browser would mean shipping a PDF library to flatten a
                 * document that is already small. So the size check is done
                 * here for that branch — the endpoint refuses an oversized
                 * body too, but only after it has been uploaded over the
                 * office's connection, and telling somebody at that point is
                 * a minute of waiting for a no.
                 */
                let blob: Blob = file;
                if (normaliseCarLicenceType(file.type) !== "application/pdf") {
                  blob = (await compressImage(file, {
                    maxEdge: 2000,
                    quality: 0.8,
                  })).blob;
                }

                const refusal = refuseCarLicence({
                  contentType: blob.type || file.type,
                  bytes: blob.size,
                });
                if (refusal) {
                  setProblem(
                    refusal === "too-large"
                      ? L.fleet.licenceTooLarge
                      : L.fleet.licenceWrongType
                  );
                  return;
                }

                await onUpload(blob);
              } catch {
                setProblem(L.fleet.licenceFailed);
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
                <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {working
                ? L.fleet.licenceUploading
                : car.licenceUrl
                  ? L.fleet.licenceReplace
                  : L.fleet.licenceChoose}
            </button>

            {car.licenceUrl && (
              <>
                {/* A new tab rather than an inline viewer. The endpoint serves
                    it `inline`, so the browser's own PDF and image viewers do
                    the job — and the office keeps the fleet list where it
                    was. */}
                <a
                  href={car.licenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {L.fleet.licenceOpen}
                </a>

                <button
                  type="button"
                  disabled={busy || working}
                  onClick={() => void onRemove()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-[var(--admin-faint)] underline transition-colors hover:text-[var(--admin-crit)] disabled:opacity-40"
                >
                  {L.fleet.licenceRemove}
                </button>
              </>
            )}
          </div>

          {car.licenceUrl && car.licenceUpdatedAt && (
            <p className="text-xs text-[var(--admin-faint)]">
              {L.fleet.licenceUpdated} {day(car.licenceUpdatedAt)}
              {isPdf && ` · ${L.fleet.licencePdf}`}
            </p>
          )}

          {/* Said out loud, for the reason the photograph's note is: this is
              the other control that does not wait for Speichern. */}
          {saveNote && (
            <p className="text-xs text-[var(--admin-faint)]">
              {L.fleet.licenceSavesNow}
            </p>
          )}

          {problem && <p className="text-xs text-[var(--admin-crit)]">{problem}</p>}
        </div>
      </div>
    </section>
  );
}

/** Re-exported so a caller can state the ceiling without reaching past this
 *  component into the rules module. */
export { CAR_LICENCE_MAX_BYTES };
