// /components/car-rental/booking/CarBookingWizard.tsx

"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormData } from "./types";
import { calculateTotal, calculateTotalDays, isStepValid } from "./utils";

import { submitBooking } from "@/app/_actions/booking";

import Step1_BookingDetails from "./Step1_BookingDetails";
import Step3_PersonalInformation from "./Step3_PersonalInformation";
import Step4_AdditionalServices from "./Step4_AdditionalServices";
import StepIndicator from "./StepIndicator";
import { packages } from "./data";

const initialFormData: FormData = {
  pickupLocation: "office",
  dropoffLocation: "office",
  pickupDate: "",
  pickupTime: "09:00",
  dropoffDate: "",
  dropoffTime: "09:00",
  packageId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  licenseNumber: "",
  termsAccepted: false,
  bookingType: "person",
  companyName: "",
  licenseSince: "",
  street: "",
  postalCode: "",
  country: "Switzerland",
  issuingCountry: "Switzerland",
  issuingCity: "",
};

const CarBookingWizard: React.FC = () => {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [stepSubmissionAttempted, setStepSubmissionAttempted] = useState<{
    [key: number]: boolean;
  }>({});
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const totalSteps = 3;

  const isInitialMount = useRef(true);

  const scrollToTop = () => {
    document
      .getElementById("booking-wizard")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      scrollToTop();
    }
  }, [currentStep]);

  const resetForm = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setSubmissionAttempted(false);
    setStepSubmissionAttempted({});
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (stepSubmissionAttempted[currentStep]) {
      setStepSubmissionAttempted((prev) => ({ ...prev, [currentStep]: false }));
    }
  };

  const nextStep = () => {
    setStepSubmissionAttempted((prev) => ({ ...prev, [currentStep]: true }));
    if (isStepValid(currentStep, formData) && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBookingAttempt = () => {
    setSubmissionAttempted(true);
    setStepSubmissionAttempted((prev) => ({ ...prev, [currentStep]: true }));
    if (isStepValid(currentStep, formData)) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const submissionPromise = async () => {
      const totalDays = calculateTotalDays(formData);
      const totalCost = calculateTotal(formData);
      const selectedPackage = packages.find((p) => p.id === formData.packageId);

      // Sends both the customer confirmation and the admin notification.
      const result = await submitBooking({
        formData,
        selectedPackage,
        days: totalDays,
        totalPrice: totalCost,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send emails");
      }

      return result;
    };

    toast.promise(submissionPromise(), {
      loading: t("booking:wizard:toast:loading"),
      success: () => {
        resetForm();
        setIsSubmitting(false);
        return t("booking:wizard:toast:success");
      },
      error: (err: unknown) => {
        console.error("Submission Error:", err);
        setIsSubmitting(false);
        return t("booking:wizard:toast:error");
      },
    });
  };

  const renderCurrentStep = () => {
    const currentStepAttempted =
      stepSubmissionAttempted[currentStep] || submissionAttempted;

    switch (currentStep) {
      case 1:
        return (
          <Step1_BookingDetails
            formData={formData}
            handleInputChange={handleInputChange}
            submissionAttempted={currentStepAttempted}
          />
        );
      case 2:
        return (
          <Step3_PersonalInformation
            formData={formData}
            handleInputChange={handleInputChange}
            submissionAttempted={currentStepAttempted}
          />
        );
      case 3:
        return (
          <Step4_AdditionalServices
            formData={formData}
            handleInputChange={handleInputChange}
            submissionAttempted={currentStepAttempted}
          />
        );
      default:
        return null;
    }
  };

  const canProceed = isStepValid(currentStep, formData);
  const totalCost = calculateTotal(formData);

  return (
    <section id="booking-wizard">
      <div className="min-h-screen bg-slate-200 py-4 sm:py-8 lg:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="bg-white shadow-sm p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-wider mb-2">
                {t("booking:wizard:title").toUpperCase()}
              </h1>
            </div>

            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

            <div className="mb-8">{renderCurrentStep()}</div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 sm:pt-8 border-t border-slate-200 gap-4 sm:gap-0">
              <div className="w-full sm:w-auto order-1 sm:order-3">
                {currentStep < totalSteps ? (
                  <div className="w-full sm:w-auto flex flex-col items-center sm:items-end">
                    {stepSubmissionAttempted[currentStep] && !canProceed && (
                      <p className="text-xs text-red-600 mb-2 text-center sm:text-right">
                        {t("booking:wizard:errors:correctFields")}
                      </p>
                    )}
                    <button
                      onClick={nextStep}
                      className={`w-full sm:w-auto flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-none transition-colors tracking-wider ${
                        canProceed
                          ? "bg-slate-800 text-white hover:bg-slate-700"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {t("booking:wizard:next").toUpperCase()}
                      <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full sm:w-auto flex flex-col items-center sm:items-end">
                    <div className="text-xs sm:text-sm font-medium text-slate-800 mb-2 text-center sm:text-right">
                      {t("booking:wizard:total")}: {totalCost}
                    </div>
                    {submissionAttempted && !canProceed && (
                      <p className="text-xs text-red-600 mb-2 text-center sm:text-right">
                        {t("booking:wizard:errors:acceptTerms")}
                      </p>
                    )}
                    <button
                      onClick={handleBookingAttempt}
                      disabled={isSubmitting}
                      className={`w-full sm:w-auto px-6 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-none transition-colors tracking-wider flex items-center justify-center ${
                        isSubmitting
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : canProceed
                            ? "bg-slate-800 text-white hover:bg-slate-700"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("booking:wizard:submitting").toUpperCase()}
                        </>
                      ) : (
                        t("booking:wizard:submitButton").toUpperCase()
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-[10px] sm:text-xs text-slate-500 font-medium tracking-wider order-2">
                {t("booking:wizard:stepIndicator", {
                  currentStep,
                  totalSteps,
                }).toUpperCase()}
              </div>
              <button
                onClick={prevStep}
                disabled={currentStep === 1 || isSubmitting}
                className={`w-full sm:w-auto flex items-center justify-center sm:justify-start px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-none transition-colors tracking-wider order-2 sm:order-1 ${
                  currentStep === 1 || isSubmitting
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2" />
                {t("booking:wizard:previous").toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CarBookingWizard;
