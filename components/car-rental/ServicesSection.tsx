"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import { Car, MapPin, Shield } from "lucide-react";
import Image from "next/image";

export default function ServicesSection() {
  const { t } = useI18n();

  const services = [
    {
      icon: <Car className="h-8 w-8 text-slate-700" />,
      title: t("carRental:services:taxiUber:title"),
      description: t("carRental:services:taxiUber:description"),
    },
    {
      icon: <MapPin className="h-8 w-8 text-slate-700" />,
      title: t("carRental:services:tourist:title"),
      description: t("carRental:services:tourist:description"),
    },
    {
      icon: <Shield className="h-8 w-8 text-slate-700" />,
      title: t("carRental:services:allInclusive:title"),
      description: t("carRental:services:allInclusive:description"),
    },
  ];

  return (
    <section className="" id="services">
      <div className="">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 ">
          {/* Image First on Mobile */}
          <div className="bg-slate-100 p-4  flex items-center justify-center order-1 lg:order-1">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/cars/Skoda_Octavia_Combi.webp"
                alt="Car Rental Service"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex items-center justify-center  p-4 sm:p-6 lg:p-8 order-2 lg:order-2 ">
            <div className="flex flex-col justify-center">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-4 sm:mb-6">
                {t("carRental:services:title")}
              </h2>

              <div className="space-y-4 mb-6">
                {services.map((service, index) => (
                  <div key={index} className="flex items-start">
                    <div className="mr-4 mt-1">{service.icon}</div>
                    <div>
                      <h3 className="text-base sm:text-lg font-medium mb-1">
                        {service.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* <Button
                variant="outline"
                className="self-start rounded-none px-6 sm:px-8 py-2 text-[10px] sm:text-xs tracking-widest"
              >
                {t("common:learnMore").toUpperCase()}
              </Button> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
