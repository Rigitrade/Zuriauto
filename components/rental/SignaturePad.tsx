"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Eraser } from "lucide-react";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";

/**
 * Touch signature field.
 *
 * Wraps `signature_pad` directly rather than `react-signature-canvas`: the
 * React wrapper's peer dependencies still lag React 19, which this project
 * runs, and the wrapper adds nothing this component needs.
 *
 * The signature is reported to the parent as a PNG data URL on every stroke
 * end, so the parent never has to reach into the canvas.
 */

interface SignaturePadProps {
  language: RentalLanguage;
  /** While true the canvas ignores input — used to gate on GTC acceptance. */
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
}

export default function SignaturePad({
  language,
  disabled = false,
  onChange,
}: SignaturePadProps) {
  const L = labelsFor(language).signature;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Kept in a ref so resizing does not need `onChange` in its dependencies,
  // which would re-run the whole setup on every parent render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /**
   * Matches the backing store to the CSS size times the device pixel ratio.
   * Without this the signature is blurry on every phone, and on a redraw the
   * stored strokes would be scaled wrongly — so the pad is cleared here and
   * the parent told the signature is gone rather than silently distorted.
   */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    pad.clear();
    setHasInk(false);
    onChangeRef.current(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      penColor: "#0f172a",
      // Transparent, so the strokes sit on the PDF's white page rather than a
      // grey block.
      backgroundColor: "rgba(255,255,255,0)",
      minWidth: 0.7,
      maxWidth: 2.4,
    });
    padRef.current = pad;

    const handleEnd = () => {
      setHasInk(!pad.isEmpty());
      onChangeRef.current(pad.isEmpty() ? null : pad.toDataURL("image/png"));
    };
    pad.addEventListener("endStroke", handleEnd);

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    return () => {
      pad.removeEventListener("endStroke", handleEnd);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      pad.off();
      padRef.current = null;
    };
  }, [resize]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) {
      pad.clear();
      pad.off();
      setHasInk(false);
      onChangeRef.current(null);
    } else {
      pad.on();
    }
  }, [disabled]);

  const clear = () => {
    padRef.current?.clear();
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          disabled
            ? "border-slate-200 bg-slate-50"
            : "border-slate-300 bg-white"
        }`}
      >
        <canvas
          ref={canvasRef}
          // `touch-none` stops the browser scrolling the page while signing.
          className={`h-40 w-full touch-none rounded-lg sm:h-48 ${
            disabled ? "pointer-events-none opacity-40" : ""
          }`}
        />

        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-400">
            {disabled ? labelsFor(language).gtc.locked : L.hint}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={clear}
        disabled={disabled || !hasInk}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eraser className="h-4 w-4" />
        {L.clear}
      </button>
    </div>
  );
}
