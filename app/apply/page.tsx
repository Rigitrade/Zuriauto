"use client";

import { MainLayout } from "@/components/MainLayout";
import RentalPickupWizard from "@/components/rental/RentalPickupWizard";

/**
 * The rental pickup contract, at /apply/.
 *
 * Short on purpose: the office pastes this link into WhatsApp and customers
 * sometimes type it. The former /rental/pickup/ path is redirected in
 * next.config.ts, since links to it have already been shared.
 */
export default function ApplyPage() {
  return (
    <MainLayout>
      <RentalPickupWizard />
    </MainLayout>
  );
}
