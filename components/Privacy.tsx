"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import LegalNotice from "./LegalNotice";

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      <div className="container mx-auto px-2">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h3 className="font-semibold mb-2 text-slate-900 uppercase tracking-[3px]">
              {t("privacy:title")}
            </h3>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-slate-200">
            <div className="prose max-w-none text-slate-700">
              {/* Introduction & Data Controller */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:introduction:title")}
                </h4>
                <p className="leading-relaxed mb-[4px]">
                  {t("privacy:sections:introduction:content")}
                </p>
                <p className="leading-relaxed mb-[4px]">
                  <strong>Data Controller:</strong>{" "}
                  {t("privacy:sections:introduction:controller")}
                </p>
                <p className="leading-relaxed mb-[4px]">
                  <strong>Email:</strong>{" "}
                  {t("privacy:sections:introduction:email")}
                </p>
                <p className="leading-relaxed">
                  <strong>Data Protection Contact:</strong>{" "}
                  {t("privacy:sections:introduction:dataProtectionContact")}
                </p>
              </div>

              {/* Child Protection */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:childProtection:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:childProtection:content")}
                </p>
              </div>

              {/* Data We Collect */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:dataCollected:title")}
                </h4>
                <ul className="space-y-1">
                  {(
                    t("privacy:sections:dataCollected:items", {
                      returnObjects: true,
                    }) as string[]
                  ).map((item, index) => (
                    <li key={index} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Purpose and Legal Basis */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:purpose:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:purpose:content")}
                </p>
              </div>

              {/* Disclosure to Third Parties */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:disclosure:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:disclosure:content")}
                </p>
              </div>

              {/* International Data Transfers */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:transfers:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:transfers:content")}
                </p>
              </div>

              {/* Data Retention */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:retention:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:retention:content")}
                </p>
              </div>

              {/* Data Security */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:security:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:security:content")}
                </p>
              </div>

              {/* Your Rights */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:rights:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:rights:content")}
                </p>
              </div>

              {/* Cookies */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:cookies:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:cookies:content")}
                </p>
              </div>

              {/* Changes & Versioning */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("privacy:sections:changes:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("privacy:sections:changes:content")}
                </p>
              </div>
            </div>

            {/* Legal Notice */}
            <LegalNotice />

            <p className="text-slate-500 text-xs mt-8 text-center">
              {t("privacy:version")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
