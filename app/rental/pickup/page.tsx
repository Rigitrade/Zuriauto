"use client";

import { MainLayout } from "@/components/MainLayout";
import RentalPickupWizard from "@/components/rental/RentalPickupWizard";

export default function RentalPickupPage() {
  return (
    <MainLayout>
      <RentalPickupWizard />
    </MainLayout>
  );
}
