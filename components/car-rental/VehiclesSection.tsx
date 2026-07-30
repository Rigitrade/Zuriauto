"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import { Car, Users, Zap } from "lucide-react";
import VehicleCarousel from "../VehicleCarousel";

export default function VehiclesSection() {
  const { t } = useI18n();

  const professionalVehicles = [
    {
      icon: <Car className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:professionals:skodaOctavia"),
    },
    {
      icon: <Users className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:professionals:mercedesE"),
    },
    {
      icon: <Zap className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:professionals:toyotaPrius"),
    },
  ];

  const touristVehicles = [
    {
      icon: <Car className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:tourists:vwGolf"),
    },
    {
      icon: <Users className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:tourists:skodaKodiaq"),
    },
    {
      icon: <Zap className="h-5 w-5 text-slate-700" />,
      name: t("carRental:vehicles:tourists:teslaModel3"),
    },
  ];

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-slate-100" id="vehicles">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-4">
            {t("carRental:vehicles:title")}
          </h2>
          <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed max-w-3xl mx-auto">
            {t("carRental:vehicles:subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8">
          {/* Professional Vehicles */}
          <div className="bg-white p-6 sm:p-8 rounded-lg">
            <h3 className="text-lg sm:text-xl font-medium tracking-wide mb-4 sm:mb-6">
              {t("carRental:vehicles:professionals:title")}
            </h3>
            <div className="space-y-4">
              {professionalVehicles.map((vehicle, index) => (
                <div key={index} className="flex items-center">
                  <div className="mr-3">{vehicle.icon}</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {vehicle.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tourist Vehicles */}
          <div className="bg-white p-6 sm:p-8 rounded-lg">
            <h3 className="text-lg sm:text-xl font-medium tracking-wide mb-4 sm:mb-6">
              {t("carRental:vehicles:tourists:title")}
            </h3>
            <div className="space-y-4">
              {touristVehicles.map((vehicle, index) => (
                <div key={index} className="flex items-center">
                  <div className="mr-3">{vehicle.icon}</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {vehicle.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <VehicleCarousel />
        {/* CTA */}
        {/* <div className="text-center">
          <Button
            variant="outline"
            className="rounded-none px-8 sm:px-12 py-4 sm:py-6 text-xs sm:text-sm tracking-widest"
          >
            {t("common:viewDetails").toUpperCase()}
          </Button>
        </div> */}
      </div>
    </section>
  );
}
