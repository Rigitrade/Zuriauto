import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/hooks/use-i18n";
import { Calendar as CalendarIcon, Check, MapPin } from "lucide-react";
import React, { useMemo, useState } from "react";
import Calendar from "./Calendar";
import { packages } from "./data";

// Time slots from 9:00 to 21:00
const timeSlots = Array.from({ length: 13 }, (_, i) => {
  const hour = 9 + i;
  return `${hour.toString().padStart(2, "0")}:00`;
});

interface FormData {
  packageId?: string;
  packageType?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  [key: string]: string | boolean | undefined;
}

interface Step1Props {
  formData: FormData;
  handleInputChange: (field: keyof FormData, value: string | boolean) => void;
  submissionAttempted: boolean;
}

const Step1_BookingDetails: React.FC<Step1Props> = ({
  formData,
  handleInputChange,
  submissionAttempted,
}) => {
  const { t } = useI18n();
  const [currentSelection, setCurrentSelection] = useState<"start" | "end">(
    "start"
  );

  const handleDateSelect = (date: string, type: "start" | "end") => {
    if (type === "start") {
      handleInputChange("pickupDate", date);
      // Auto-set same day for dropoff if not selected
      if (!formData.dropoffDate) {
        handleInputChange("dropoffDate", date);
      }
      // If end date is before start date, update it
      if (
        formData.dropoffDate &&
        new Date(date) > new Date(formData.dropoffDate)
      ) {
        handleInputChange("dropoffDate", date);
      }
    } else {
      // Only allow end date if start date is selected and end date is after start date
      if (
        formData.pickupDate &&
        new Date(date) >= new Date(formData.pickupDate)
      ) {
        handleInputChange("dropoffDate", date);
      }
    }
  };

  const duration = useMemo(() => {
    if (formData.pickupDate && formData.dropoffDate) {
      const start = new Date(formData.pickupDate);
      const end = new Date(formData.dropoffDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 0 ? 1 : diffDays; // Minimum 1 day
    }
    return 0;
  }, [formData.pickupDate, formData.dropoffDate]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider text-center mb-6 sm:mb-8">
        {t("booking:step1:title")}
      </h2>

      {/* Package Selection */}
      <div className="space-y-4">
        <Label className="text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
          {t("booking:step1:selectPackage")}
        </Label>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`cursor-pointer transition-all hover:shadow-md border-2 rounded-none ${
                formData.packageId === pkg.id
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => {
                handleInputChange("packageId", pkg.id);
                handleInputChange("packageType", pkg.name);
              }}
            >
              <CardContent className="p-4 sm:p-6">
                <h3 className="font-medium text-sm sm:text-base mb-2">
                  {t(
                    `booking:packages:${
                      pkg.id as "taxi" | "tourist" | "business"
                    }:name`
                  )}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">
                  {t(
                    `booking:packages:${
                      pkg.id as "taxi" | "tourist" | "business"
                    }:description`
                  )}
                </p>
                <p className="text-sm sm:text-base font-medium text-slate-800 mb-3">
                  {t(`booking:packages:${pkg.id as "taxi"}:price`)}
                </p>
                <ul className="space-y-1">
                  {(
                    t(
                      `booking:packages:${
                        pkg.id as "taxi" | "tourist" | "business"
                      }:features`,
                      {
                        returnObjects: true,
                      }
                    ) as string[]
                  ).map((feature, index) => (
                    <li
                      key={index}
                      className="text-[10px] sm:text-xs text-slate-600 flex items-center"
                    >
                      <Check className="h-3 w-3 mr-1 text-slate-700" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {pkg.id === "taxi" && (
                  <div className="mt-4">
                    <p className=" text-sm  mb-2">
                      {t(`booking:packages:${pkg.id as "taxi"}:extra`)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Location Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-4">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <MapPin className="h-4 w-4 mr-2" />
            {t("booking:step1:pickupLocation")}
          </Label>
          <RadioGroup
            value={formData.pickupLocation}
            onValueChange={(value: string) =>
              handleInputChange("pickupLocation", value)
            }
            className="space-y-3"
          >
            <div
              className={`border rounded-none p-4 cursor-pointer transition-all ${
                formData.pickupLocation === "office"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => handleInputChange("pickupLocation", "office")}
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value={"office"}
                  id={`pickup-office`}
                  className="mt-1"
                />
                <div className="space-y-1 flex-1">
                  <Label
                    htmlFor={`pickup-office`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("booking:office")}
                  </Label>
                  <p className="text-xs text-slate-600">
                    Schaffhauserstrasse 550, 8052 Zürich
                  </p>
                </div>
              </div>
            </div>

            <div
              key={`pickup-delivery`}
              className={`border rounded-none p-4 cursor-pointer transition-all ${
                formData.pickupLocation === "delivery"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => handleInputChange("pickupLocation", "delivery")}
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value={"delivery"}
                  id={`pickup-delivery`}
                  className="mt-1"
                />
                <div className="space-y-1 flex-1">
                  <Label
                    htmlFor={`pickup-delivery`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("booking:deliveryPickup")} ***
                  </Label>
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <MapPin className="h-4 w-4 mr-2" />
            {t("booking:step1:dropoffLocation")}
          </Label>
          <RadioGroup
            value={formData.dropoffLocation}
            onValueChange={(value: string) =>
              handleInputChange("dropoffLocation", value)
            }
            className="space-y-3"
          >
            <div
              className={`border rounded-none p-4 cursor-pointer transition-all ${
                formData.dropoffLocation === "office"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => handleInputChange("dropoffLocation", "office")}
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value={"office"}
                  id={`dropoff-office`}
                  className="mt-1"
                />
                <div className="space-y-1 flex-1">
                  <Label
                    htmlFor={`dropoff-office`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("booking:office")}
                  </Label>
                  <p className="text-xs text-slate-600">
                    Schaffhauserstrasse 550, 8052 Zürich
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`border rounded-none p-4 cursor-pointer transition-all ${
                formData.dropoffLocation === "delivery"
                  ? "border-slate-800 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => handleInputChange("dropoffLocation", "delivery")}
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value={"delivery"}
                  id={`dropoff-delivery`}
                  className="mt-1"
                />
                <div className="space-y-1 flex-1">
                  <Label
                    htmlFor={`dropoff-delivery`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t("booking:deliveryDropoff")} ***
                  </Label>
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Date Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <CalendarIcon className="h-4 w-4 mr-2" />
            {t("booking:step1:chooseDates")}
          </h3>
        </div>

        {/* Date and Time Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card className="rounded-none border-0 shadow-none p-0 m-0">
            <CardContent className="p-4 space-y-3">
              {/* Date and Time in one row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] sm:text-xs text-slate-600 uppercase tracking-wider">
                    {t("booking:date")}
                  </Label>
                  <Calendar
                    selectedStartDate={formData.pickupDate}
                    selectedEndDate={formData.dropoffDate}
                    onDateSelect={handleDateSelect}
                    currentSelection={currentSelection}
                    setCurrentSelection={setCurrentSelection}
                    text={
                      formData.pickupDate
                        ? new Date(formData.pickupDate).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : t("booking:step1:noPickupDateSelected") ||
                          "Select pickup date"
                    }
                    dateType="pickup"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] sm:text-xs text-slate-600 uppercase tracking-wider">
                    {t("booking:time")}
                  </Label>
                  <Select
                    value={formData.pickupTime}
                    onValueChange={(value) =>
                      handleInputChange("pickupTime", value)
                    }
                  >
                    <SelectTrigger className="w-full rounded-none p-[22px]">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent defaultValue={formData.pickupTime}>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-0 shadow-none p-0 m-0">
            <CardContent className="p-4 space-y-3">
              {/* Date and Time in one row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] sm:text-xs text-slate-600 uppercase tracking-wider">
                    {t("booking:date")}
                  </Label>
                  <Calendar
                    selectedStartDate={formData.pickupDate}
                    selectedEndDate={formData.dropoffDate}
                    onDateSelect={handleDateSelect}
                    currentSelection={currentSelection}
                    setCurrentSelection={setCurrentSelection}
                    text={
                      formData.dropoffDate
                        ? new Date(formData.dropoffDate).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : !formData.pickupDate
                        ? t("booking:step1:noDropoffDateSelected")
                        : "Select return date"
                    }
                    dateType="dropoff"
                    disabled={!formData.pickupDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] sm:text-xs text-slate-600 uppercase tracking-wider">
                    {t("booking:time")}
                  </Label>
                  <Select
                    value={formData.dropoffTime}
                    onValueChange={(value) =>
                      handleInputChange("dropoffTime", value)
                    }
                    disabled={!formData.dropoffDate}
                  >
                    <SelectTrigger className="w-full rounded-none p-[22px]">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Updated Date Range Display - Each on separate line */}
        <div className="text-center space-y-1">
          {formData.pickupDate ? (
            <>
              <p className="text-sm text-slate-600">
                <span className="font-medium">{t("booking:step1:from")}</span>{" "}
                {new Date(formData.pickupDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {formData.pickupTime && (
                  <span className="text-slate-500">
                    {" "}
                    {t("booking:at")} {formData.pickupTime}
                  </span>
                )}
              </p>
              {formData.dropoffDate && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{t("booking:step1:to")}</span>{" "}
                  {new Date(formData.dropoffDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {formData.dropoffTime && (
                    <span className="text-slate-500">
                      {" "}
                      {t("booking:at")} {formData.dropoffTime}
                    </span>
                  )}
                </p>
              )}
              {duration > 0 && (
                <p className="text-sm text-slate-500">
                  {duration} {t("booking:step1:day", { count: duration })}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {t("booking:step1:noDateSelected")}
            </p>
          )}
        </div>
      </div>
      <Card className="rounded-none p-0 m-0 border-0 shadow-none">
        <CardContent className="p-4 sm:p-6 ">
          <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
            *** {t("booking:deliveryNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step1_BookingDetails;
