import React from "react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  /**
   * A name under each step. Optional: the booking and return forms show
   * numbers only. Worth giving when there are few steps, each holding several
   * parts, so the bar says what each one is for.
   */
  labels?: string[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  labels,
}) => {
  return (
    <div
      className={`flex justify-center mb-8 sm:mb-12 ${
        labels ? "items-start" : "items-center"
      }`}
    >
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`flex ${labels ? "items-start" : "items-center"}`}
        >
          <div className="flex flex-col items-center">
            <div
              aria-current={step === currentStep ? "step" : undefined}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                step < currentStep
                  ? "bg-slate-700 text-white"
                  : step === currentStep
                  ? "bg-slate-800 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {step < currentStep ? (
                <Check className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                step
              )}
            </div>
            {labels?.[step - 1] && (
              <span
                className={`mt-2 max-w-[9rem] text-center text-xs sm:text-sm ${
                  step === currentStep
                    ? "font-medium text-slate-900"
                    : "text-slate-500"
                }`}
              >
                {labels[step - 1]}
              </span>
            )}
          </div>
          {step < totalSteps && (
            <div
              className={`${
                labels ? "w-16 sm:w-24 mt-4 sm:mt-5" : "w-12 sm:w-16"
              } h-0.5 mx-2 transition-colors ${
                step < currentStep ? "bg-slate-700" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
