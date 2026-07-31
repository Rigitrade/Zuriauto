"use client";

import BenefitsSection from "./BenefitsSection";
import CarBookingWizard from "./booking/CarBookingWizard";
import HeroSection from "./HeroSection";
import ServicesSection from "./ServicesSection";

export default function CarRentalPage() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <BenefitsSection />
      <CarBookingWizard />
    </>
  );
}
