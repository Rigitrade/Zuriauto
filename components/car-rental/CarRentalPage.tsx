"use client";

import BenefitsSection from "./BenefitsSection";
import CarBookingWizard from "./booking/CarBookingWizard";
import ContactSection from "./ContactSection";
import FAQSection from "./FAQSection";
import HeroSection from "./HeroSection";
import PricingSection from "./PricingSection";
import ServicesSection from "./ServicesSection";
import TestimonialsSection from "./TestimonialsSection";
import VehiclesSection from "./VehiclesSection";

export default function CarRentalPage() {
  return (
    <>
      <HeroSection />
      <VehiclesSection />
      <ServicesSection />
      <BenefitsSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <ContactSection />
      <CarBookingWizard />
    </>
  );
}
