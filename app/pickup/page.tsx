"use client";

import { MainLayout } from "@/components/MainLayout";
import RentalPickupWizard from "@/components/rental/RentalPickupWizard";

/**
 * The rental pickup contract, at /pickup/.
 *
 * Short on purpose: the office pastes this link into WhatsApp and customers
 * sometimes type it. The former /rental/pickup/ and /apply/ paths are
 * redirected in next.config.ts, since links to both have already been shared.
 */
export default function PickupPage() {
  return (
    <MainLayout>
      <RentalPickupWizard />
    </MainLayout>
  );
}
