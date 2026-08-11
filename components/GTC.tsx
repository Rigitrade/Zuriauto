"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/hooks/use-i18n";
import gtc, {
  GTC_DATE,
  GTC_ENTITY,
  type GtcBlock,
  type GtcLanguage,
} from "@/locales/gtc";
import GtcLanguageTabs from "./GtcLanguageTabs";
import GtcPdfFlags from "./GtcPdfFlags";
import LegalNotice from "./LegalNotice";

/**
 * The site UI is German/English only, so a visitor arrives on one of those.
 * All three versions of the terms are readable on the page via the language
 * buttons, with the signed PDFs still linked at the foot.
 */
function asGtcLanguage(lang: string | undefined): GtcLanguage {
  return lang === "en" ? "en" : "de";
}

function Block({ block }: { block: GtcBlock }) {
  switch (block.kind) {
    case "sub":
      return (
        <h5 className="font-semibold mt-5 mb-2 text-slate-900 tracking-[1px]">
          {block.title}
        </h5>
      );

    case "p":
      return <p className="leading-relaxed mb-3">{block.text}</p>;

    case "list":
      return (
        <ul className="list-disc pl-5 mb-3 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-left border-collapse text-sm">
            {block.head && (
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                    {block.head[0]}
                  </th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                    {block.head[1]}
                  </th>
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 px-3 py-2 align-top">
                    {row[0]}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top">
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

export default function GTCPage() {
  const { currentLanguage } = useI18n();

  // Defaults to the site language, then follows the reader's own choice. The
  // French terms were previously reachable only as a PDF via the flags below.
  const [gtcLanguage, setGtcLanguage] = useState<GtcLanguage>(() =>
    asGtcLanguage(currentLanguage)
  );

  // Following the site switcher keeps the two in step for anyone who changes
  // the interface language while on this page, without preventing them from
  // choosing a different version afterwards.
  useEffect(() => {
    setGtcLanguage(asGtcLanguage(currentLanguage));
  }, [currentLanguage]);

  const doc = gtc[gtcLanguage];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      <div className="container mx-auto px-2">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h3 className="font-semibold mb-2 text-slate-900 uppercase tracking-[3px]">
              {doc.title}
            </h3>
            <p className="font-semibold mb-2 text-slate-900 uppercase tracking-[3px]">
              ZURIAUTO ({GTC_ENTITY})
            </p>

            <div className="mt-6 flex justify-center">
              <GtcLanguageTabs
                value={gtcLanguage}
                onChange={setGtcLanguage}
                label={
                  gtcLanguage === "de"
                    ? "Sprache der AGB"
                    : gtcLanguage === "fr"
                    ? "Langue des CGV"
                    : "Language of the terms"
                }
              />
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-slate-200">
            <div className="prose max-w-none text-slate-700">
              {doc.sections.map((section) => (
                <div key={section.num} data-gtc-section={section.num} className="mb-6 px-2">
                  <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                    {section.num}. {section.title}
                  </h4>
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              ))}

              <LegalNotice />

              {/* Document date, at the foot of the terms. Same placement and
                  styling the previous version of this page used for its
                  version stamp. */}
              <p className="text-slate-500 text-xs mt-8 text-center">
                {GTC_DATE}
              </p>
            </div>
          </div>

          {/* The signed terms as PDF, one per language, at the foot of the page */}
          <div className="mt-10">
            <GtcPdfFlags />
          </div>
        </div>
      </div>
    </section>
  );
}
