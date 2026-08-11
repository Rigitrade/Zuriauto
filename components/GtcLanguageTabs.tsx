"use client";

import { GTC_LANGUAGES, type GtcLanguage } from "@/locales/gtc";

/**
 * Three buttons choosing which language version of the terms is displayed.
 *
 * Separate from the site language switcher on purpose. A customer reading the
 * German site may want the terms in French, and the terms are the document they
 * are agreeing to — so which version they read is a decision worth handing them
 * explicitly rather than inferring from the interface language.
 *
 * Shared by the GTC page and the contract form so the two cannot drift.
 */

interface GtcLanguageTabsProps {
  value: GtcLanguage;
  onChange: (language: GtcLanguage) => void;
  /** Shown to screen readers as the group's purpose. */
  label: string;
  className?: string;
}

export default function GtcLanguageTabs({
  value,
  onChange,
  label,
  className = "",
}: GtcLanguageTabsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex rounded-lg border border-slate-300 bg-white p-1 ${className}`}
    >
      {GTC_LANGUAGES.map(({ code, label: name }) => {
        const active = code === value;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            // `aria-pressed` rather than a tab role: these are toggle buttons
            // over one panel, not a tablist with separate panels.
            aria-pressed={active}
            lang={code}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

export type { GtcLanguage };
