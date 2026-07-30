"use client";

import { useI18n } from "@/lib/hooks/use-i18n";

export default function LegalNotice() {
  const { t } = useI18n();

  return (
    <div className="mt-8 pt-6 border-t border-slate-200">
      <h4 className="uppercase font-semibold mb-4 text-slate-900 tracking-[2px]">
        Legal Notice
      </h4>

      <div className="space-y-3 text-sm text-slate-600">
        <div>
          <strong>Brand Name:</strong> {t("legalNotice:brandName")}
        </div>

        <div>
          <strong>Owned by:</strong> {t("legalNotice:ownedBy")}
        </div>

        <div>
          <strong>Trading Register:</strong> {t("legalNotice:tradingRegister")}
        </div>

        <div>
          <strong>Address:</strong> {t("legalNotice:address")}
        </div>

        <div>
          <strong>Head Office:</strong> {t("legalNotice:headOffice")}
        </div>

        <div>
          <strong>Represented by:</strong> {t("legalNotice:representedBy")}
        </div>

        <div>
          <strong>Email:</strong> {t("legalNotice:email")}
        </div>
      </div>
    </div>
  );
}
