// /components/car-rental/booking/Step4_AdditionalServices.tsx

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/hooks/use-i18n";
import { packages } from "./data";
import { FormData } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  formData: FormData;
  handleInputChange: (field: keyof FormData, value: boolean) => void;
  submissionAttempted: boolean;
}

const Step4_AdditionalServices: React.FC<Props> = ({
  formData,
  handleInputChange,
}) => {
  const { t } = useI18n();
  const selectedPackage = packages.find((p) => p.id === formData.packageId);

  return (
    <div className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider text-center">
        {t("booking:step4:title")}
      </h2>

      <Card className="bg-slate-50 rounded-none border-slate-200">
        <CardHeader>
          <CardTitle className="font-medium text-base sm:text-lg tracking-wider">
            {t("booking:step4:bookingSummary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">
                {t("booking:step4:package")}
              </span>
              <span className="font-medium">
                {selectedPackage?.name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                {t("booking:wizard:total")}
              </span>
              <span className="font-medium">
                {selectedPackage?.price || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                {t("booking:step4:pickup")}
              </span>
              <span>{`${formData.pickupDate} at ${formData.pickupTime}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                {t("booking:step4:dropoff")}
              </span>
              <span>
                {`${formData.dropoffDate} at ${formData.dropoffTime}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                {t("booking:step4:customer")}
              </span>
              <span>{`${formData.firstName} ${formData.lastName}`}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4">
        <div className="flex gap-3">
          <Checkbox
            id="termsAccepted"
            checked={!!formData.termsAccepted}
            onCheckedChange={(checked) =>
              handleInputChange("termsAccepted", !!checked)
            }
            className="mt-0.5 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <Label
              htmlFor="termsAccepted"
              className="text-sm font-medium leading-normal cursor-pointer block peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <span className="inline-block">
                {t("booking:step4:iAgreeToThe")}
                <Link
                  href="/GTC"
                  target="_blank"
                  className="underline hover:text-slate-900 transition-colors ml-1"
                >
                  {t("booking:step4:gtc")}
                </Link>
                <span className="mx-1">{t("booking:step4:and")}</span>
                <Link
                  href="/privacy"
                  target="_blank"
                  className="underline hover:text-slate-900 transition-colors"
                >
                  {t("booking:step4:privacyPolicy")}
                </Link>
              </span>
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4_AdditionalServices;
