"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/rental/imageCompress";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Labels } from "@/components/admin/types";
import { ColourField } from "./ColourField";
import { DateField } from "./DateField";

/**
 * Add a vehicle: what the car is, before anything has happened to it.
 *
 * The photograph is taken here rather than only in the edit dialog, because
 * the office adds a car while standing next to it. Sending somebody back
 * through Edit to attach the picture they had in hand thirty seconds ago is
 * the kind of step that simply does not get done — which is how a fleet ends
 * up with photographs for three cars out of nine.
 *
 * It cannot upload as it is chosen, though, and that is the one thing that
 * makes this form more than four fields. The photo endpoint is
 * `PUT /api/admin/cars/[id]/photo/`, and until the car is created there is no
 * id to put it to. So the compressed bytes are held here and sent immediately
 * after the car comes back — see `onAdd`, which hands the caller both halves.
 * The alternative was an endpoint that accepts a photograph for a car that
 * does not exist yet, which would need somewhere to park orphaned bytes and a
 * sweep to collect them.
 *
 * Compression still happens at choose-time rather than at submit-time: it
 * takes a second or two on a phone, and doing it while somebody is still
 * typing the plate is free, whereas doing it after they press Add is a form
 * that appears to hang.
 */
export function AddCar({
  L,
  language,
  busy,
  onAdd,
}: {
  L: Labels;
  language: AdminLanguage;
  busy: boolean;
  /** Given the car's fields and, when one was chosen, its photograph.
   *  Returns true when the car was created. */
  onAdd: (
    body: Record<string, string>,
    photo: Blob | null
  ) => Promise<boolean>;
}) {
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [colour, setColour] = useState("");
  const [mfkDate, setMfkDate] = useState("");
  const [mfkLastDate, setMfkLastDate] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  /** An object URL for the thumbnail. Held separately so it can be revoked —
   *  a blob URL left behind pins the bytes in memory for the life of the tab. */
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function dropPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhoto(null);
  }

  function reset() {
    setModel("");
    setPlate("");
    setVin("");
    setColour("");
    setMfkDate("");
    setMfkLastDate("");
    dropPhoto();
    setProblem(null);
  }

  // Advisory rather than blocking, like the field itself: a last inspection
  // dated after the next one is almost always a typo in one of the two, but
  // the office is looking at the paperwork and this screen is not.
  const mfkReversed =
    mfkDate !== "" && mfkLastDate !== "" && mfkLastDate > mfkDate;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const created = await onAdd(
          { model, plate, vin, colour, mfkDate, mfkLastDate },
          photo
        );
        if (created) reset();
      }}
      // A vertical stack: this lives in a dialog, not across the top of the
      // page, and labelled fields in a 32rem panel read better as rows than as
      // a squeezed four-column grid.
      className="grid gap-3"
    >
      <Input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={L.fleet.model}
        autoFocus
      />
      <Input
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder={L.fleet.platePlaceholder}
      />
      <Input
        value={vin}
        onChange={(e) => setVin(e.target.value)}
        placeholder={L.fleet.vinOptional}
      />

      <ColourField
        value={colour}
        onChange={setColour}
        L={L}
        language={language}
      />

      {/* Two inspection dates, side by side because they are read off one
          certificate. Typed as DD.MM.YYYY rather than left to the browser's
          own date control — see the note on DateField. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField
          label={L.fleet.mfkOptional}
          value={mfkDate}
          onChange={setMfkDate}
          placeholder={L.fleet.datePlaceholder}
          invalidHint={L.fleet.dateInvalid}
        />
        <DateField
          label={L.fleet.mfkLastOptional}
          value={mfkLastDate}
          onChange={setMfkLastDate}
          placeholder={L.fleet.datePlaceholder}
          invalidHint={L.fleet.dateInvalid}
        />
      </div>

      {mfkReversed && (
        <p className="text-xs text-[var(--admin-attn)]">
          {L.fleet.mfkLastAfterNext}
        </p>
      )}

      {/* The photograph. Unlike in the edit dialog it does not write straight
          away — it cannot, since the car has no id yet — so the note under it
          says the opposite of the one there. */}
      <section className="grid gap-2 rounded-md border border-[var(--admin-rule)] p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
          {L.fleet.photoHeading}
        </span>

        <div className="flex items-start gap-3">
          <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera
                className="h-6 w-6 text-[var(--admin-faint)]"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="grid gap-1.5">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                // Reset at once, so choosing the same file again after a
                // failure fires the change event.
                event.target.value = "";
                if (!file) return;

                setProblem(null);
                setCompressing(true);
                try {
                  // The same 1600px / 0.75 the edit dialog uses. A photo
                  // straight off a phone is 3-6 MB and the platform caps a
                  // function request at roughly 4.5 MB, so this is not an
                  // optimisation — without it the upload fails outright.
                  const { blob } = await compressImage(file, {
                    maxEdge: 1600,
                    quality: 0.75,
                  });
                  dropPhoto();
                  setPhoto(blob);
                  setPreview(URL.createObjectURL(blob));
                } catch {
                  setProblem(L.fleet.photoFailed);
                } finally {
                  setCompressing(false);
                }
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || compressing}
                onClick={() => fileInput.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-40"
              >
                {compressing ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {photo ? L.fleet.photoReplace : L.fleet.photoChoose}
              </button>

              {photo && (
                <button
                  type="button"
                  disabled={busy || compressing}
                  onClick={dropPhoto}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-[var(--admin-faint)] underline transition-colors hover:text-[var(--admin-crit)] disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {L.fleet.photoRemove}
                </button>
              )}
            </div>

            <p className="text-xs text-[var(--admin-faint)]">
              {L.fleet.photoAfterAdd}
            </p>
            {problem && (
              <p className="text-xs text-[var(--admin-crit)]">{problem}</p>
            )}
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={busy || compressing || !model.trim() || !plate.trim()}
        className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {L.fleet.add}
      </button>
    </form>
  );
}
