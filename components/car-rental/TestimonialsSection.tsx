"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import { Quote, Star } from "lucide-react";
import Image from "next/image";

export default function TestimonialsSection() {
  const { t } = useI18n();

  const testimonials = [
    {
      quote: t("carRental:testimonials:ahmed"),
      author: t("carRental:testimonials:ahmedLocation"),
      rating: 5,
    },
    {
      quote: t("carRental:testimonials:emily"),
      author: t("carRental:testimonials:emilyLocation"),
      rating: 5,
    },
  ];

  return (
    <section className="py-8 sm:py-12 lg:py-16 bg-white" id="testimonials">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Content First on Mobile */}
          <div className="flex flex-col justify-center p-4 sm:p-6 lg:p-8 order-1 lg:order-1">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-wider mb-6 sm:mb-8">
              {t("carRental:testimonials:title")}
            </h2>

            <div className="space-y-6 sm:space-y-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="relative">
                  {/* Quote Icon */}
                  <div className="absolute top-0 left-0 -translate-x-2 -translate-y-2">
                    <Quote className="h-6 w-6 text-slate-300 fill-current" />
                  </div>

                  {/* Rating */}
                  <div className="flex mb-3 ml-5">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 text-yellow-400 fill-current "
                      />
                    ))}
                  </div>

                  {/* Testimonial Content */}
                  <blockquote className="text-sm sm:text-base text-slate-700 leading-relaxed mb-3 pl-4">
                    &quot;{testimonial.quote}&quot;
                  </blockquote>

                  {/* Author */}
                  <cite className="text-xs sm:text-sm text-slate-500 font-medium pl-4">
                    – {testimonial.author}
                  </cite>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button
                variant="outline"
                className="rounded-none px-6 sm:px-8 py-2 text-[10px] sm:text-xs tracking-widest"
              >
                {t("common:learnMore").toUpperCase()}
              </Button>
            </div>
          </div>

          {/* Image Second on Mobile */}
          <div className="bg-slate-100 p-4 sm:p-6 lg:p-8 rounded-lg flex items-center justify-center order-2 lg:order-2">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/cars/Toyota_Prius_Hybrid.webp"
                alt="Happy Customers"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
