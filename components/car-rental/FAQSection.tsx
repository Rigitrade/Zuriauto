"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type FAQItem = {
  question: string;
  answer: string;
};

export default function FAQSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Get FAQ data from translations
  const faqItems = t("carRental:faq:questions", {
    returnObjects: true,
  }) as FAQItem[];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-slate-100" id="faq">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-6 sm:mb-8 text-center">
          {t("carRental:faq:title")}
        </h2>

        <div className="max-w-3xl mx-auto">
          <div className="space-y-2 sm:space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="border border-slate-200 overflow-hidden"
              >
                <button
                  className="flex justify-between items-center w-full p-3 sm:p-4 text-left bg-white hover:bg-slate-50 transition-colors"
                  onClick={() => toggleFAQ(index)}
                >
                  <span className="font-medium text-xs sm:text-sm lg:text-base">
                    {item.question}
                  </span>
                  {openIndex === index ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {openIndex === index && (
                  <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
