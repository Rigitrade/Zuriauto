"use client";

import { MainLayout } from "@/components/MainLayout";
import CarBookingWizard from "@/components/car-rental/booking/CarBookingWizard";

export default function BookPage() {
  return (
    <MainLayout>
      <CarBookingWizard />
    </MainLayout>
  );
}
