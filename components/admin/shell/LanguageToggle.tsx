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
    <div className="flex overflow-hidden rounded-md border border-[var(--admin-rule-strong)] text-sm">
      {(["de", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChoose(code)}
          aria-pressed={language === code}
          className={
            language === code
              ? "bg-[var(--admin-accent)] px-3 py-1.5 font-medium text-[var(--admin-accent-ink)]"
              : "px-3 py-1.5 text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)]"
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
