"use client";

import type { AdminLanguage } from "@/lib/admin/labels";

/** DE/EN, shown on the sign-in card and in the shell header alike. */
export function LanguageToggle({
  language,
  onChoose,
}: {
  language: AdminLanguage;
  onChoose: (next: AdminLanguage) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {(["de", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChoose(code)}
          aria-pressed={language === code}
          className={
            language === code
              ? "bg-slate-900 px-3 py-1.5 text-white"
              : "px-3 py-1.5 text-slate-700"
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
