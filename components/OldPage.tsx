"use client";

import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import Image from "next/image";

const Page = () => {
  const { t } = useI18n();

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative min-h-screen bg-slate-200 overflow-hidden">
        {/* Background Text - Hidden on very small screens */}
        <div className="absolute inset-0 hidden sm:flex items-center justify-center z-0 opacity-20 text-[8rem] sm:text-[12rem] lg:text-[20rem] font-bold tracking-widest text-slate-300">
          ZURIAUTO
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col justify-center relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-wider mb-3 sm:mb-4 px-4">
              {t("common:testDrive").toUpperCase()}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed tracking-wide px-4">
              {t("common:welcome")} - {t("common:contactUs")}
            </p>
          </div>

          <div className="relative h-[200px] sm:h-[300px] md:h-[400px] lg:h-[500px] w-full px-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full max-w-5xl">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src="/images/cars/car_1.png"
                    alt="ZURIAUTO Luxury Car"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Section - Responsive Layout */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-800 text-white">
          <div className="container mx-auto grid grid-cols-2 divide-x divide-slate-700">
            <div className="py-8 sm:py-16 lg:py-28 px-4 sm:px-8 lg:px-12 text-center">
              <div className="text-4xl sm:text-6xl lg:text-9xl font-light mb-1 sm:mb-2">
                634
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-widest">
                {t("carDetails:countdown:peopleAhead")}
              </div>
            </div>
            <div className="py-8 sm:py-16 lg:py-28 px-4 sm:px-8 lg:px-12 text-center">
              <div className="text-4xl sm:text-6xl lg:text-9xl font-light mb-1 sm:mb-2">
                12
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-widest">
                {t("carDetails:countdown:daysLeft")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Image First on Mobile */}
            <div className="bg-slate-100 p-4 sm:p-6 lg:p-8 rounded-lg flex items-center justify-center order-1 lg:order-1">
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src="/images/cars/car_2.webp"
                  alt="ZURIAUTO Front View"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-8 order-2 lg:order-2">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-4 sm:mb-6">
                {t("carDetails:blissTitle")}
              </h2>
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed mb-4 sm:mb-6">
                {t("carDetails:blissDescription")}
              </p>
              <Button
                variant="outline"
                className="self-start rounded-none px-6 sm:px-8 py-2 text-[10px] sm:text-xs tracking-widest"
              >
                {t("common:learnMore").toUpperCase()}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Interior Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-slate-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Content First on Mobile */}
            <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-8 order-1 lg:order-1">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-4 sm:mb-6">
                {t("carDetails:jetLifeTitle")}
              </h2>
              <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed mb-4 sm:mb-6">
                {t("carDetails:jetLifeDescription")}
              </p>
              <Button
                variant="outline"
                className="self-start rounded-none px-6 sm:px-8 py-2 text-[10px] sm:text-xs tracking-widest"
              >
                {t("carDetails:exploreInterior")}
              </Button>
            </div>

            {/* Image Second on Mobile */}
            <div className="bg-slate-200 p-4 sm:p-6 lg:p-8 rounded-lg flex items-center justify-center order-2 lg:order-2">
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src="/images/cars/car_3.webp"
                  alt="ZURIAUTO Interior View"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-6 sm:mb-8 lg:mb-10 text-center">
            {t("carDetails:collectionTitle")}
          </h2>
          <div className="relative aspect-[21/9] sm:aspect-[16/7] lg:aspect-[21/9] w-full">
            <Image
              src="/images/cars/car_4.webp"
              alt="ZURIAUTO Collection"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-slate-100">
        <div className="container mx-auto max-w-2xl text-center px-4 sm:px-6 lg:px-8">
          <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-none px-8 sm:px-12 py-4 sm:py-6 text-xs sm:text-sm tracking-widest w-full sm:w-auto">
            {t("carDetails:signUpTestDrive")}
          </Button>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-3 sm:mt-4 px-4">
            {t("carDetails:creditCheckNotice")}
          </p>
        </div>
      </section>
    </MainLayout>
  );
};

export default Page;
