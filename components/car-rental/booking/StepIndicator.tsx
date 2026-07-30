import React from "react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <div className="flex items-center justify-center mb-8 sm:mb-12">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
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
          {step < totalSteps && (
            <div
              className={`w-12 sm:w-16 h-0.5 mx-2 transition-colors ${
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
