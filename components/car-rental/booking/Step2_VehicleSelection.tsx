"use client";
// /components/car-booking/Step2_VehicleSelection.tsx

import React, { useState } from "react";
import {
  Users,
  DoorOpen,
  Settings,
  Fuel,
  Wind,
  Navigation,
  Check,
} from "lucide-react";
import { FormData } from "./types";
import { vehicles } from "./data";
import { useI18n } from "@/lib/hooks/use-i18n";
import Image from "next/image";

interface Props {
  formData: FormData;
  handleInputChange: (field: keyof FormData, value: string) => void;
  submissionAttempted: boolean;
}

const Step2_VehicleSelection: React.FC<Props> = ({
  formData,
  handleInputChange,
  submissionAttempted,
}) => {
  const [imageError, setImageError] = useState(false);
  const { t } = useI18n();

  return (
    <div className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider text-center mb-6 sm:mb-8">
        {t("booking:step2:title")}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {vehicles.map((vehicle) => {
          const vehicleTranslations = t(
            `booking:step2:vehicles:${vehicle.id as "skoda-octavia"}`,
            {
              returnObjects: true,
            }
          );

          return (
            <div
              key={vehicle.id}
              onClick={() => handleInputChange("selectedVehicle", vehicle.id)}
              className={`border-2 rounded-none cursor-pointer transition-all hover:shadow-sm ${
                formData.selectedVehicle === vehicle.id
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="bg-slate-100 p-4 sm:p-6 flex items-center justify-center">
                <div className="relative aspect-[4/3] w-full max-w-sm">
                  {!imageError ? (
                    <Image
                      src={vehicle.image}
                      alt={vehicleTranslations?.name || vehicle.name}
                      fill
                      className="object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
                      <div className="text-center">
                        <div className="text-2xl mb-2">🚗</div>
                        <div className="text-sm">
                          {vehicleTranslations?.name || vehicle.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-base sm:text-lg">
                    {vehicleTranslations?.name || vehicle.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium uppercase tracking-wider ${
                      vehicle.category === "Electric"
                        ? "bg-green-100 text-green-800"
                        : vehicle.category === "Hybrid"
                        ? "bg-blue-100 text-blue-800"
                        : vehicle.category === "Luxury"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {t(
                      `booking:step2:categories:${
                        vehicle.category.toLowerCase() as "estate"
                      }`
                    )}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-medium text-slate-800 mb-4">
                  {vehicle.price}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <Users className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {vehicle.seats} {t("booking:step2:labels:seats")}
                    </span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <DoorOpen className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {vehicle.doors} {t("booking:step2:labels:doors")}
                    </span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <Settings className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {t(
                        `booking:step2:transmissions:${
                          vehicle.transmission.toLowerCase() as "automatic"
                        }`
                      )}
                    </span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <Fuel className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {t(
                        `booking:step2:fuels:${
                          vehicle.fuel.toLowerCase() as "hybrid"
                        }`
                      )}
                    </span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <Wind className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {vehicle.airConditioning
                        ? t("booking:step2:labels:hasAc")
                        : t("booking:step2:labels:noAc")}
                    </span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-slate-600">
                    <Navigation className="h-4 w-4 mr-2 text-slate-500" />
                    <span>
                      {vehicle.gps
                        ? t("booking:step2:labels:hasGps")
                        : t("booking:step2:labels:noGps")}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-[10px] sm:text-xs">
                    <span className="text-slate-600">
                      {t("booking:step2:specs:engine")}:
                    </span>
                    <span className="font-medium">{vehicle.specs.engine}</span>
                  </div>
                  <div className="flex justify-between text-[10px] sm:text-xs">
                    <span className="text-slate-600">
                      {t("booking:step2:specs:consumption")}:
                    </span>
                    <span className="font-medium">
                      {vehicle.specs.consumption}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] sm:text-xs">
                    <span className="text-slate-600">
                      {t("booking:step2:specs:luggage")}:
                    </span>
                    <span className="font-medium">{vehicle.specs.luggage}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {vehicleTranslations?.features?.map(
                    (feature: string, index: number) => (
                      <div
                        key={index}
                        className="text-[10px] sm:text-xs text-slate-600 flex items-center"
                      >
                        <Check className="h-3 w-3 mr-2 text-slate-500" />
                        {feature}
                      </div>
                    )
                  ) ||
                    vehicle.features.map((feature, index) => (
                      <div
                        key={index}
                        className="text-[10px] sm:text-xs text-slate-600 flex items-center"
                      >
                        <Check className="h-3 w-3 mr-2 text-slate-500" />
                        {feature}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Step2_VehicleSelection;
