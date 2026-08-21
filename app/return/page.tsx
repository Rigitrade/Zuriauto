"use client";

import { MainLayout } from "@/components/MainLayout";
import RentalReturnWizard from "@/components/rental/RentalReturnWizard";

/**
 * The vehicle return form, at /return/.
 *
 * Short for the same reason /pickup/ is: the office pastes this link into
 * WhatsApp when a rental ends, and customers sometimes type it.
 */
export default function ReturnPage() {
  return (
    <MainLayout>
      <RentalReturnWizard />
    </MainLayout>
  );
}
