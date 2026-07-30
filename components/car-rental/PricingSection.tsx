"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import Image from "next/image";

export default function PricingSection() {
  const { t } = useI18n();

  // FIX: Handle the 'examples' object for the tourist package
  const touristExamples = t("carRental:pricing:packages:tourist:examples", {
    returnObjects: true,
  }) as Record<string, string>;
  const touristPrice = Object.values(touristExamples).join(" / ");

  const packages = [
    {
      name: t("carRental:pricing:packages:taxiUber:name"),
      bestFor: t("carRental:pricing:packages:taxiUber:bestFor"),
      price: t("carRental:pricing:packages:taxiUber:price"),
      included: t("carRental:pricing:packages:taxiUber:included"),
    },
    {
      name: t("carRental:pricing:packages:tourist:name"),
      bestFor: t("carRental:pricing:packages:tourist:bestFor"),
      price: touristPrice, // Use the correctly formatted price string
      included: t("carRental:pricing:packages:tourist:included"),
    },
    {
      name: t("carRental:pricing:packages:business:name"),
      bestFor: t("carRental:pricing:packages:business:bestFor"),
      price: t("carRental:pricing:packages:business:price"),
      included: t("carRental:pricing:packages:business:included"),
    },
  ];

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-white" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-6 sm:mb-8 lg:mb-10 text-center">
          {t("carRental:pricing:title")}
        </h2>

        <div className="relative aspect-[21/9] sm:aspect-[16/7] lg:aspect-[21/9] w-full mb-8">
          <Image
            src="/images/cars/Mercedes_E_Class.webp"
            alt="Car Rental Collection"
            fill
            className="object-contain"
          />
        </div>

        <div className="overflow-x-auto bg-slate-50 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Package
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Best For
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  Included
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {packages.map((pkg, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] sm:text-xs font-medium text-slate-900">
                    {pkg.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] sm:text-xs text-slate-600">
                    {pkg.bestFor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] sm:text-xs text-slate-600">
                    {pkg.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[10px] sm:text-xs text-slate-600">
                    {pkg.included}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* <div className="py-8 sm:py-12 lg:py-16  mt-8 text-center">
          <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <ReusableButton
              text={t("carRental:contact:cta").toUpperCase()}
              backgroundColor="bg-slate-800"
              hoverBackgroundColor="hover:bg-slate-700"
              textColor="text-white"
              hoverTextColor=""
            />
            <p className="text-[10px] sm:text-xs text-slate-400 mt-3 sm:mt-4 px-4">
              {t("carDetails:creditCheckNotice")}
            </p>
          </div>
        </div> */}
      </div>
    </section>
  );
}
