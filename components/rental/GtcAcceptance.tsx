"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import gtc, { GTC_DATE, type GtcBlock, type GtcLanguage } from "@/locales/gtc";
import GtcLanguageTabs from "@/components/GtcLanguageTabs";
import {
  GTC_CONFIRMATIONS,
  type GtcConfirmationKey,
} from "@/lib/rental/gtcConfirmations";
import { labelsFor, type RentalLanguage } from "@/lib/rental/labels";

/**
 * The terms, rendered in the form, gating the signature.
 *
 * The customer reads the GTC here rather than being sent to another page: no
 * signature is possible and no PDF is generated until the boxes are ticked. The
 * boxes in turn only unlock once the panel has been scrolled to the end, so
 * "had the opportunity to read" is something the flow enforces rather than
 * something we assert afterwards.
 */

interface GtcAcceptanceProps {
  /** Site language, used for the surrounding copy. */
  language: RentalLanguage;
  /**
   * Language of the terms themselves, chosen by the customer.
   *
   * Held by the parent rather than here, because it is recorded on the contract
   * — the PDF must state which version was actually read, not which interface
   * language happened to be active.
   */
  gtcLanguage: GtcLanguage;
  onGtcLanguageChange: (language: GtcLanguage) => void;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  /** The GTC Art. 11 boxes, each ticked on its own (`gtcConfirmations.ts`). */
  confirmed: Record<GtcConfirmationKey, boolean>;
  onConfirmedChange: (key: GtcConfirmationKey, confirmed: boolean) => void;
  error?: string;
  confirmError?: string;
}

function Block({ block }: { block: GtcBlock }) {
  switch (block.kind) {
    case "sub":
      return (
        <h5
          // "11.1 Wahrheitsgemässe Angaben" → "11.1", so a confirmation can
          // scroll the panel to the article it names.
          data-gtc-ref={block.title.split(" ")[0]}
          className="mt-4 mb-1.5 scroll-mt-2 font-semibold text-slate-900"
        >
          {block.title}
        </h5>
      );
    case "p":
      return <p className="mb-2 leading-relaxed">{block.text}</p>;
    case "list":
      return (
        <ul className="mb-2 list-disc space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            {block.head && (
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1.5 font-semibold">
                    {block.head[0]}
                  </th>
                  <th className="border border-slate-200 px-2 py-1.5 font-semibold whitespace-nowrap">
                    {block.head[1]}
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 px-2 py-1.5 align-top">
                    {row[0]}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 align-top">
                    {row[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function GtcAcceptance({
  language,
  gtcLanguage,
  onGtcLanguageChange,
  accepted,
  onAcceptedChange,
  confirmed,
  onConfirmedChange,
  error,
  confirmError,
}: GtcAcceptanceProps) {
  const L = labelsFor(language).gtc;
  const doc = gtc[gtcLanguage] ?? gtc.de;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [read, setRead] = useState(false);

  /**
   * Marks the terms as read at the end of the scroll — or immediately if they
   * fit without scrolling, since a panel that never scrolls would otherwise
   * never unlock the checkbox.
   */
  const checkScrolled = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atEnd) setRead(true);
  }, []);

  useEffect(() => {
    checkScrolled();
  }, [checkScrolled]);

  /** Scrolls the terms panel, not the page, to the sub-article `ref`. */
  function showArticle(ref: string) {
    const panel = scrollRef.current;
    const heading = panel?.querySelector<HTMLElement>(
      `[data-gtc-ref="${ref}"]`
    );
    if (!panel || !heading) return;
    panel.scrollTo({
      top:
        heading.getBoundingClientRect().top -
        panel.getBoundingClientRect().top +
        panel.scrollTop -
        8,
      behavior: "smooth",
    });
  }

  // Changing language swaps the document, so the previous read-through and
  // acceptance no longer apply to what is on screen. This matters legally as
  // much as visually: a tick recorded against the German terms cannot stand as
  // acceptance of the French ones.
  useEffect(() => {
    setRead(false);
    onAcceptedChange(false);
    for (const { key } of GTC_CONFIRMATIONS) onConfirmedChange(key, false);
    scrollRef.current?.scrollTo({ top: 0 });
    // The callbacks come from the parent; including them would reset
    // acceptance on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gtcLanguage]);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{L.heading}</h3>
          <p className="text-sm text-slate-500">{L.intro}</p>
        </div>

        <GtcLanguageTabs
          value={gtcLanguage}
          onChange={onGtcLanguageChange}
          label={L.languageLabel}
          className="w-full justify-between sm:w-auto sm:justify-start"
        />
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScrolled}
        className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700"
      >
        <p className="mb-1 font-semibold text-slate-900">{doc.title}</p>
        <p className="mb-4 text-xs text-slate-500">
          {L.version} {doc.updated || GTC_DATE}
        </p>

        {doc.sections.map((section) => (
          <section key={section.num} className="mb-4">
            <h4 className="mb-1.5 font-semibold text-slate-900">
              {section.num} {section.title}
            </h4>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>
        ))}
      </div>

      <TickBox
        checked={accepted}
        enabled={read}
        onChange={onAcceptedChange}
      >
        {L.accept}
      </TickBox>

      {GTC_CONFIRMATIONS.map(({ key, ref }) => (
        <TickBox
          key={key}
          checked={confirmed[key]}
          enabled={read}
          onChange={(checked) => onConfirmedChange(key, checked)}
        >
          {L.confirmations[key].statement}
          <span className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-slate-500">
            <span>
              {L.article} {ref} {L.short} – {L.confirmations[key].title}
            </span>
            <button
              type="button"
              // Inside the label, so stop the click from also ticking the box.
              onClick={(e) => {
                e.preventDefault();
                showArticle(ref);
              }}
              className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              {L.readArticle} ↑
            </button>
          </span>
        </TickBox>
      ))}

      {!read && (
        <p className="text-xs text-slate-500">
          {language === "de"
            ? "Bitte scrollen Sie die AGB bis zum Ende."
            : "Please scroll the GTC to the end."}
        </p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {confirmError && (
        <p className="text-sm text-rose-600">{confirmError}</p>
      )}
    </div>
  );
}

/**
 * One box in the acceptance list. A visual box over a screen-reader-only input,
 * locked (and dimmed) until the terms have been scrolled to the end.
 */
function TickBox({
  checked,
  enabled,
  onChange,
  children,
}: {
  checked: boolean;
  enabled: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        enabled
          ? "cursor-pointer border-slate-300 bg-white hover:bg-slate-50"
          : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-slate-800 bg-slate-800 text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>

      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={!enabled}
        onChange={(e) => onChange(e.target.checked)}
      />

      <span className="text-sm text-slate-700">{children}</span>
    </label>
  );
}
