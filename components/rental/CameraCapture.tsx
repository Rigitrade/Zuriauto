"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";

/**
 * Live camera capture, for a phone camera or a laptop webcam.
 *
 * A file input with `capture` only opens the camera app on mobile; on a desktop
 * it produces a file picker and no webcam at all. This takes the frame directly,
 * so the same flow works at the counter on a laptop and on a customer's phone.
 *
 * The caller keeps the file-picker path as a fallback: camera access can be
 * denied, absent, or blocked by an insecure origin, and none of those should
 * leave the customer unable to continue.
 */

type Facing = "environment" | "user";

interface CameraCaptureProps {
  language: RentalLanguage;
  title: string;
  /** Rear camera for documents, front for a portrait. */
  facing?: Facing;
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  /** Offered when the camera cannot be used. */
  onChooseFile: () => void;
}

type Status =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "failed"; reason: "denied" | "unavailable" | "insecure" };

export default function CameraCapture({
  language,
  title,
  facing = "environment",
  onCapture,
  onClose,
  onChooseFile,
}: CameraCaptureProps) {
  const L = labelsFor(language).documents;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [currentFacing, setCurrentFacing] = useState<Facing>(facing);
  const [busy, setBusy] = useState(false);

  /** Releases the camera. Without this the device's indicator light stays on. */
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (wanted: Facing) => {
      stop();
      setStatus({ kind: "starting" });

      // `mediaDevices` is absent entirely on an insecure origin, which is a
      // different problem from a refused permission and needs a different
      // message.
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "failed",
          reason: window.isSecureContext ? "unavailable" : "insecure",
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `ideal` rather than `exact`: a laptop with only a front camera
          // throws OverconstrainedError on an exact "environment" request
          // instead of falling back to the camera it does have.
          video: {
            facingMode: { ideal: wanted },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // Safari does not always autoplay from the attribute alone, and a
          // rejected play() here is not fatal — the frame still arrives.
          try {
            await video.play();
          } catch {
            /* ignored */
          }
        }
        setStatus({ kind: "live" });
      } catch (error) {
        const name = (error as DOMException)?.name;
        setStatus({
          kind: "failed",
          reason:
            name === "NotAllowedError" || name === "SecurityError"
              ? "denied"
              : "unavailable",
        });
      }
    },
    [stop]
  );

  useEffect(() => {
    void start(currentFacing);
    return stop;
  }, [start, stop, currentFacing]);

  // Escape closes, matching every other dialog on the web.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function capture() {
    const video = videoRef.current;
    if (!video || status.kind !== "live" || busy) return;

    setBusy(true);
    try {
      // The intrinsic video size, not the element's CSS size, so the capture
      // keeps the sensor's resolution rather than the on-screen preview's.
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;

      if (currentFacing === "user") {
        // The preview is mirrored so it feels like a mirror; without matching
        // that here, the saved portrait comes out flipped from what was shown.
        context.translate(width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (blob) {
        stop();
        onCapture(blob);
      }
    } finally {
      setBusy(false);
    }
  }

  const message =
    status.kind === "failed"
      ? status.reason === "denied"
        ? L.cameraDenied
        : status.reason === "insecure"
        ? L.cameraInsecure
        : L.cameraUnavailable
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={L.cancel}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          // playsInline is essential on iOS: without it the video takes over
          // the screen in the native player and the shutter is unreachable.
          playsInline
          muted
          autoPlay
          className={`max-h-full max-w-full ${
            currentFacing === "user" ? "-scale-x-100" : ""
          }`}
        />

        {status.kind === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm">{L.cameraStarting}</span>
          </div>
        )}

        {message && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-sm text-white">{message}</p>
            <button
              type="button"
              onClick={onChooseFile}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900"
            >
              {L.chooseFile}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 px-4 py-6">
        <button
          type="button"
          onClick={() =>
            setCurrentFacing((f) => (f === "user" ? "environment" : "user"))
          }
          aria-label={L.switchCamera}
          disabled={status.kind === "failed"}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-30"
        >
          <RefreshCw className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={capture}
          disabled={status.kind !== "live" || busy}
          aria-label={L.shutter}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Camera className="h-6 w-6" />
          )}
        </button>

        {/* Balances the switch button so the shutter sits centred. */}
        <span className="h-12 w-12" aria-hidden="true" />
      </div>
    </div>
  );
}
