"use client";

import { useRef, useState } from "react";
import { Check, Loader2, TriangleAlert, Upload } from "lucide-react";
import type { Labels } from "@/components/admin/types";
import {
  LETTER_ACCEPT,
  PHOTO_MAX_EDGE,
  PHOTO_QUALITY,
  imageLetterPdf,
  isLetterImage,
  letterPageSize,
} from "@/lib/fines/imageLetter";
import { compressImage } from "@/lib/rental/imageCompress";

/**
 * Dropping scanned letters in.
 *
 * Several at once — the pile — each with its own line and state. Every file
 * goes in three steps: ask for a slot (refused if this exact scan is already
 * in), PUT it straight to storage, register it. The server reads it after
 * answering; the list above shows the result when it lands.
 *
 * A photo of a letter is turned into a one-page PDF first, here in the
 * browser (see lib/fines/imageLetter.ts), and from then on is a scan like
 * any other.
 */

type Line = {
  key: string;
  name: string;
  state:
    | "hashing"
    | "uploading"
    | "done"
    | "duplicate"
    | "failed"
    | "notPdf"
    | "unreadable"
    | "tooLarge";
};

const MAX_BYTES = 20 * 1024 * 1024;

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Throws when the browser cannot decode the image — HEIC outside Safari. */
async function photoAsPdf(file: File): Promise<Blob> {
  const photo = await compressImage(file, { maxEdge: PHOTO_MAX_EDGE, quality: PHOTO_QUALITY });
  URL.revokeObjectURL(photo.previewUrl);
  const pdf = await imageLetterPdf(
    new Uint8Array(await photo.blob.arrayBuffer()),
    letterPageSize(photo.width, photo.height)
  );
  return new Blob([pdf.slice()], { type: "application/pdf" });
}

export function FineUpload({ L, onUploaded }: { L: Labels; onUploaded: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const set = (key: string, state: Line["state"]) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, state } : line)));

  async function uploadOne(file: File, key: string) {
    let letter: Blob = file;
    if (isLetterImage(file)) {
      try {
        letter = await photoAsPdf(file);
      } catch {
        return set(key, "unreadable");
      }
    } else if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return set(key, "notPdf");
    }
    if (letter.size > MAX_BYTES) return set(key, "tooLarge");

    try {
      const hash = await sha256(letter);
      set(key, "uploading");
      const slot = await fetch("/api/admin/fines/uploads/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sha256: hash, bytes: letter.size }),
      });
      if (slot.status === 409) return set(key, "duplicate");
      if (slot.status === 413) return set(key, "tooLarge");
      if (!slot.ok) return set(key, "failed");
      const { documentId, key: storageKey, url, headers } = await slot.json();

      const put = await fetch(url, { method: "PUT", headers, body: letter });
      if (!put.ok) return set(key, "failed");

      const registered = await fetch("/api/admin/fines/documents/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, key: storageKey, sha256: hash }),
      });
      if (registered.status === 409) return set(key, "duplicate");
      if (registered.status === 415) return set(key, "notPdf");
      if (!registered.ok) return set(key, "failed");
      set(key, "done");
    } catch {
      set(key, "failed");
    }
  }

  async function take(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    const added = list.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      state: "hashing" as const,
    }));
    setLines((current) => [...added, ...current]);
    await Promise.all(list.map((file, index) => uploadOne(file, added[index].key)));
    onUploaded();
  }

  const words: Record<Line["state"], string> = {
    hashing: L.fines.uploading,
    uploading: L.fines.uploading,
    done: L.fines.uploaded,
    duplicate: L.fines.duplicate,
    failed: L.fines.uploadFailed,
    notPdf: L.fines.notPdf,
    unreadable: L.fines.imageUnreadable,
    tooLarge: L.fines.tooLarge,
  };

  return (
    <section className="rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-semibold tracking-tight">{L.fines.uploadTitle}</h2>
      <p className="mt-1 text-xs text-[var(--admin-faint)]">{L.fines.uploadHint}</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void take(e.dataTransfer.files);
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-sm transition-colors ${
          dragging
            ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
            : "border-[var(--admin-rule-strong)] hover:bg-[var(--admin-sunk)]"
        }`}
      >
        <Upload className="h-5 w-5 text-[var(--admin-muted)]" aria-hidden="true" />
        <span className="font-medium">{L.fines.choose}</span>
        <span className="text-xs text-[var(--admin-faint)]">{L.fines.dropHere}</span>
        <input
          ref={input}
          type="file"
          accept={LETTER_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void take(e.target.files);
            if (input.current) input.current.value = "";
          }}
        />
      </label>

      {lines.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{line.name}</span>
              <span
                className={`flex shrink-0 items-center gap-1.5 text-xs ${
                  line.state === "done"
                    ? "text-[var(--admin-good)]"
                    : line.state === "hashing" || line.state === "uploading"
                      ? "text-[var(--admin-muted)]"
                      : "text-[var(--admin-crit)]"
                }`}
              >
                {line.state === "done" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : line.state === "hashing" || line.state === "uploading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {words[line.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
