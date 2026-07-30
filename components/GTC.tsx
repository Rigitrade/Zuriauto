"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import LegalNotice from "./LegalNotice";

export default function GTCPage() {
  const { t } = useI18n();

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      <div className="container mx-auto px-2">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h3 className="font-semibold mb-2 text-slate-900 uppercase tracking-[3px]">
              {t("terms:title")}
            </h3>
            <p className="font-semibold mb-2 text-slate-900 uppercase tracking-[3px]">
              {t("terms:company")}
            </p>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border border-slate-200">
            <div className="prose max-w-none text-slate-700">
              {/* Parties to the Contract */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:parties:title")}
                </h4>
                <p className="leading-relaxed mb-3">
                  <strong>Owner:</strong> {t("terms:sections:parties:owner")}
                </p>
                <p className="leading-relaxed">
                  <strong>Renter / Driver:</strong>{" "}
                  {t("terms:sections:parties:renter")}
                </p>
              </div>

              {/* Subject of the Contract */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:subject:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:subject:content")}
                </p>
              </div>

              {/* Conclusion of Contract */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:conclusion:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:conclusion:content")}
                </p>
              </div>

              {/* Contract Duration */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:duration:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:duration:content")}
                </p>
              </div>

              {/* Rates & Payment */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:rates:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:rates:content")}
                </p>
              </div>

              {/* Security Deposit & Insurance */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:deposit:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:deposit:content")}
                </p>
              </div>

              {/* Use of Vehicle & Lessee's Obligations */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:use:title")}
                </h4>
                <p className="leading-relaxed mb-[4px]">Lessee Obligations:</p>
                <ul className="space-y-1 ">
                  {(
                    t("terms:sections:use:obligations", {
                      returnObjects: true,
                    }) as string[]
                  ).map((obligation, index) => (
                    <li key={index} className="leading-relaxed">
                      {obligation}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Vehicle Handover & Return */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:handover:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:handover:content")}
                </p>
              </div>

              {/* Operating Costs & Maintenance */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:maintenance:title")}
                </h4>
                <p className="leading-relaxed mb-3">
                  <strong>Lessor bears costs for:</strong>{" "}
                  {t("terms:sections:maintenance:lessor")}
                </p>
                <p className="leading-relaxed">
                  <strong>Lessee bears costs for:</strong>{" "}
                  {t("terms:sections:maintenance:lessee")}
                </p>
              </div>

              {/* Cancellation & Refunds */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:cancellation:title")}
                </h4>
                <p className="leading-relaxed mb-[4px]">Cancellation Policy:</p>
                <ul className="space-y-1 ">
                  {(
                    t("terms:sections:cancellation:rules", {
                      returnObjects: true,
                    }) as string[]
                  ).map((rule, index) => (
                    <li key={index} className="leading-relaxed">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Liability */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:liability:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:liability:content")}
                </p>
              </div>

              {/* Data Protection */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:data:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:data:content")}
                </p>
              </div>

              {/* Complaints */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:complaints:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:complaints:content")}
                </p>
              </div>

              {/* Force Majeure */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:force:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:force:content")}
                </p>
              </div>

              {/* Final Provisions */}
              <div className="mb-6 px-2">
                <h4 className="uppercase font-semibold mb-3 text-slate-900 tracking-[2px]">
                  {t("terms:sections:final:title")}
                </h4>
                <p className="leading-relaxed">
                  {t("terms:sections:final:content")}
                </p>
              </div>
            </div>

            {/* Legal Notice */}
            <LegalNotice />

            <p className="text-slate-500 text-xs mt-8 text-center">
              {t("terms:version")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
