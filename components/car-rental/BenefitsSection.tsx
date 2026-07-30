"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import { Check } from "lucide-react";
import Image from "next/image";

export default function BenefitsSection() {
  const { t } = useI18n();
  // Get benefits points from translations
  const benefitsPoints = t("carRental:benefits:points", {
    returnObjects: true,
  }) as string[];

  return (
    <section className=" bg-slate-100" id="benefits">
      <div className="">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Content First on Mobile */}
          <div className="bg-white flex items-center justify-center  p-4 sm:p-6 lg:p-8 order-1 lg:order-1 ">
            <div className="flex flex-col justify-center">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-4 sm:mb-6">
                {t("carRental:benefits:title")}
              </h2>

              <ul className="space-y-3 mb-6">
                {benefitsPoints.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 mr-3 mt-1">
                      <Check className="h-4 w-4 text-slate-700" />
                    </div>
                    <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed">
                      {point}
                    </p>
                  </li>
                ))}
              </ul>

              {/* <Button
                    variant="outline"
                    className="rounded-none px-6 sm:px-8 py-2 text-[10px] sm:text-xs tracking-widest"
                  >
                    {t("carRental:benefits:cta").toUpperCase()}
                  </Button> */}
            </div>
          </div>
          {/* Image Second on Mobile */}
          <div className="bg-slate-100 p-4 flex items-center justify-center order-2 lg:order-2">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/cars/Tesla_Model_3.webp"
                alt="Car Rental Benefits"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
