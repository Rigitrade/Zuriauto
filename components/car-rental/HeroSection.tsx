"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import Image from "next/image";

export default function HeroSection() {
  const { t } = useI18n();
  const titles = t("carRental:hero:title", { returnObjects: true });

  return (
    <section className="relative min-h-screen bg-slate-200 overflow-hidden flex flex-col">
      {/* Background Text - Hidden on very small screens */}
      <div className="absolute inset-0 hidden sm:flex items-center justify-center z-0 opacity-20 text-[6rem] sm:text-[8rem] md:text-[12rem] lg:text-[16rem] xl:text-[20rem] font-bold tracking-widest text-slate-300">
        ZURIAUTO
      </div>

      {/* Main Content Area - Takes remaining space after CTA */}
      <div className="flex-1 flex flex-col justify-center relative z-10 pb-4 sm:pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center mt-5">
          {/* Title and Subtitle */}
          <div className="max-w-3xl mx-auto text-center mb-3 sm:mb-5 lg:mb-7">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold tracking-wider mb-2 sm:mb-3 lg:mb-4 px-2">
              {titles.map((line: string, index: number) => (
                <div key={index}>{line.toUpperCase()}</div>
              ))}
            </h1>
            {/* <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed tracking-wide px-2 max-w-2xl mx-auto">
              {t("carRental:hero:subtitle")}
            </p> */}
          </div>

          {/* Car Image Container - Responsive sizing */}
          <div className="flex-1 flex items-center justify-center px-4 min-h-[180px] sm:min-h-[250px] md:min-h-[300px] lg:min-h-[350px] xl:min-h-[400px]">
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-2xl 2xl:max-w-4xl">
              <div className="relative w-full h-auto">
                <Image
                  src="/images/cars/Skoda_Kodiaq_SUV.png"
                  alt="Luxury Car Rental"
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain"
                  priority
                  sizes="(max-width: 640px) 320px, (max-width: 768px) 448px, (max-width: 1024px) 512px, (max-width: 1280px) 576px, (max-width: 1536px) 672px, 896px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section - Fixed at bottom */}
      {/* <div className="bg-slate-800 text-white mt-auto">
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-700">
          <div className="py-6 sm:py-8 md:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 text-center">
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light mb-1 sm:mb-2">
              24/7
            </div>
            <div className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest">
              {t("carRental:hero:availability")}
            </div>
          </div>
          <div className="py-6 sm:py-8 md:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
            <div className="w-full max-w-xs sm:max-w-sm">
              <div className="block md:hidden">
                <ReusableButton
                  text={t("carRental:hero:ctaShort").toUpperCase()}
                />
              </div>

              <div className="hidden md:block">
                <ReusableButton text={t("carRental:hero:cta").toUpperCase()} />
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </section>
  );
}
