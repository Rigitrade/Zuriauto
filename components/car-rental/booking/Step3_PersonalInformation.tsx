// /components/car-rental/booking/Step3_PersonalInformation.tsx

"use client";

import CountrySelectComponent from "@/components/createCountryOptions";
import PhoneInputComponent from "@/components/PhoneInputComponent";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useI18n } from "@/lib/hooks/use-i18n";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertCircle,
  Building2,
  Cake,
  Calendar as CalendarIcon,
  CreditCard,
  Globe,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from "lucide-react";
import React, { useState } from "react";
import { FormData } from "./types";
import { getStepValidationErrors, isFieldValid } from "./utils";
// CORRECTED IMPORT PATHS

interface Props {
  formData: FormData;
  handleInputChange: (field: keyof FormData, value: string | boolean) => void;
  submissionAttempted?: boolean;
}

const Step3_PersonalInformation: React.FC<Props> = ({
  formData,
  handleInputChange,
  submissionAttempted = false,
}) => {
  const { t } = useI18n();
  const [dateOfBirthOpen, setDateOfBirthOpen] = useState(false);
  const [licenseSinceOpen, setLicenseSinceOpen] = useState(false);

  const validationErrors = submissionAttempted
    ? getStepValidationErrors(2, formData) // VALIDATION FOR NEW STEP 2
    : [];

  const parseDate = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    return new Date(dateString);
  };

  const hasFieldError = (fieldName: keyof FormData): boolean => {
    if (!submissionAttempted) return false;
    return !isFieldValid(fieldName, formData);
  };

  const getFieldError = (fieldName: keyof FormData): string => {
    if (!hasFieldError(fieldName)) return "";
    // Simplified error messages, actual messages come from validationErrors array now
    switch (fieldName) {
      case "email":
        return "Invalid email format";
      case "phone":
        return "Invalid phone number";
      case "dateOfBirth":
        return "You must be over 18";
      case "licenseSince":
        return "Invalid license date";
      default:
        return "This field is required";
    }
  };

  // The rest of the component remains the same as your provided code...
  // ... (Full component code from your request)
  return (
    <div className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider text-center mb-6 sm:mb-8">
        {t("booking:step3:title")}
      </h2>

      <div className="bg-slate-50 p-4 sm:p-6 rounded-sm">
        <Label className="text-xs sm:text-sm font-medium text-slate-700 mb-4 block uppercase tracking-wider">
          {t("booking:step3:bookingType")}
        </Label>
        <RadioGroup
          value={formData.bookingType}
          onValueChange={(value) => handleInputChange("bookingType", value)}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="person" id="person" />
            <Label
              htmlFor="person"
              className="flex items-center cursor-pointer"
            >
              <User className="h-4 w-4 mr-2 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {t("booking:step3:person")}
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="company" id="company" />
            <Label
              htmlFor="company"
              className="flex items-center cursor-pointer"
            >
              <Building2 className="h-4 w-4 mr-2 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {t("booking:step3:company")}
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {formData.bookingType === "company" && (
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <Building2 className="h-4 w-4 mr-2" />
            {t("booking:step3:companyName")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            placeholder={t("booking:step3:companyNamePlaceholder")}
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              hasFieldError("companyName") &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <User className="h-4 w-4 mr-2" />
            {t("booking:step3:familyName")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
            placeholder={t("booking:step3:familyNamePlaceholder")}
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              hasFieldError("lastName") &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <User className="h-4 w-4 mr-2" />
            {t("booking:step3:firstName")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
            placeholder={t("booking:step3:firstNamePlaceholder")}
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              hasFieldError("firstName") &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <Phone className="h-4 w-4 mr-2" />
            {t("booking:step3:mobileNumber")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <PhoneInputComponent
            value={formData.phone as string}
            onChange={(value) => handleInputChange("phone", value)}
            hasError={hasFieldError("phone")}
            errorMessage={getFieldError("phone")}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <Mail className="h-4 w-4 mr-2" />
            {t("booking:step3:email")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="email"
            value={formData.email as string}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder={t("booking:step3:emailPlaceholder")}
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              hasFieldError("email") &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
          <Cake className="h-4 w-4 mr-2" />
          {t("booking:step3:dateOfBirth")}
          <span className="text-red-500 ml-1">*</span>
        </Label>
        <Popover open={dateOfBirthOpen} onOpenChange={setDateOfBirthOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal rounded-none",
                !formData.dateOfBirth && "text-muted-foreground",
                hasFieldError("dateOfBirth") &&
                  "border-red-300 hover:border-red-400"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.dateOfBirth ? (
                format(parseDate(formData.dateOfBirth as string)!, "PPP")
              ) : (
                <span>{t("booking:step3:selectDateOfBirth")}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDate(formData.dateOfBirth as string)}
              onSelect={(date) => {
                handleInputChange("dateOfBirth", format(date!, "yyyy-MM-dd"));
                setDateOfBirthOpen(false);
              }}
              captionLayout="dropdown"
              defaultMonth={new Date(2000, 0)}
              fromYear={1920}
              toYear={new Date().getFullYear() - 18}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <MapPin className="h-4 w-4 mr-2" />
            {t("booking:step3:street")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.street as string}
            onChange={(e) => handleInputChange("street", e.target.value)}
            placeholder="e.g. Main Street 123"
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              submissionAttempted &&
                !(formData.street as string).trim() &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <MapPin className="h-4 w-4 mr-2" />
            {t("booking:step3:postal")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.postalCode as string}
            onChange={(e) => handleInputChange("postalCode", e.target.value)}
            placeholder="e.g. 8001 Zurich"
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              submissionAttempted &&
                !(formData.postalCode as string).trim() &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
          <Globe className="h-4 w-4 mr-2" />
          {t("booking:step3:country")}
          <span className="text-red-500 ml-1">*</span>
        </Label>
        <CountrySelectComponent
          value={formData.country as string}
          onChange={(value) => handleInputChange("country", value)}
          hasError={submissionAttempted && !(formData.country as string).trim()}
          errorMessage="Country is required"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <CalendarIcon className="h-4 w-4 mr-2" />
            {t("booking:step3:licenseSince")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Popover open={licenseSinceOpen} onOpenChange={setLicenseSinceOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal rounded-none",
                  !formData.licenseSince && "text-muted-foreground",
                  hasFieldError("licenseSince") &&
                    "border-red-300 hover:border-red-400"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.licenseSince ? (
                  format(parseDate(formData.licenseSince as string)!, "PPP")
                ) : (
                  <span>{t("booking:step3:selectLicenseSince")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDate(formData.licenseSince as string)}
                onSelect={(date) => {
                  handleInputChange(
                    "licenseSince",
                    format(date!, "yyyy-MM-dd")
                  );
                  setLicenseSinceOpen(false);
                }}
                captionLayout="dropdown"
                defaultMonth={new Date(2010, 0)}
                fromYear={1980}
                toYear={new Date().getFullYear()}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <CreditCard className="h-4 w-4 mr-2" />
            {t("booking:step3:licenseNumber")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.licenseNumber as string}
            onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
            placeholder={t("booking:step3:licenseNumberPlaceholder")}
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              submissionAttempted &&
                !(formData.licenseNumber as string).trim() &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <Globe className="h-4 w-4 mr-2" />
            {t("booking:step3:issuingCountry")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <CountrySelectComponent
            value={formData.issuingCountry as string}
            onChange={(value) => handleInputChange("issuingCountry", value)}
            hasError={
              submissionAttempted && !(formData.issuingCountry as string).trim()
            }
            errorMessage="Issuing country is required"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center text-xs sm:text-sm font-medium text-slate-700 uppercase tracking-wider">
            <MapPin className="h-4 w-4 mr-2" />
            {t("booking:step3:issuingCity")}
            <span className="text-red-500 ml-1">*</span>
          </Label>
          <Input
            type="text"
            value={formData.issuingCity as string}
            onChange={(e) => handleInputChange("issuingCity", e.target.value)}
            placeholder="e.g. Zurich"
            className={cn(
              "rounded-none focus:ring-slate-800 focus:border-slate-800",
              submissionAttempted &&
                !(formData.issuingCity as string).trim() &&
                "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
      </div>
      <Card className="rounded-none p-0 m-0">
        <CardContent className="p-4 sm:p-6 ">
          <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
            <Shield className="h-4 w-4 inline mr-2 text-slate-500" />
            {t("booking:step3:privacyNotice")}
          </p>
        </CardContent>
      </Card>
      {validationErrors.length > 0 && (
        <Card className="rounded-none border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Please correct the following errors:
                </h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Step3_PersonalInformation;
