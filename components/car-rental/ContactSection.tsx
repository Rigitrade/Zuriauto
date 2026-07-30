"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import { Mail, MapPin, Phone } from "lucide-react";
import ReusableButton from "../ReusableButton";

export default function ContactSection() {
  const { t } = useI18n();

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-slate-100" id="contact">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-6 sm:mb-8 text-center">
          {t("carRental:contact:title")}
        </h2>

        <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 shadow-sm">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-slate-700 mr-4 flex-shrink-0 mt-1" />
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed">
                {t("carRental:contact:location")}
              </p>
            </div>

            <div className="flex items-start">
              <Mail className="h-5 w-5 text-slate-700 mr-4 flex-shrink-0 mt-1" />
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed">
                {t("carRental:contact:email")}
              </p>
            </div>

            <div className="flex items-start">
              <Phone className="h-5 w-5 text-slate-700 mr-4 flex-shrink-0 mt-1" />
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed">
                {t("carRental:contact:phone")}
              </p>
            </div>
          </div>
        </div>

        <div className="py-8 sm:py-12 lg:py-16  mt-8 text-center">
          <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <ReusableButton
              text={t("carRental:contact:cta").toUpperCase()}
              backgroundColor="bg-slate-800"
              hoverBackgroundColor="hover:bg-slate-700"
              textColor="text-white"
              hoverTextColor=""
            />
            <p className="text-[10px] sm:text-xs text-slate-400 mt-3 sm:mt-4 px-4">
              {t("carRental:contact:response")} 24h
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
