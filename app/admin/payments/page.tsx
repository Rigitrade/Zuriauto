"use client";

import { Suspense } from "react";
import { PaymentsSection } from "@/components/admin/sections/PaymentsSection";

/** Suspense for `useSearchParams`: the tab and the open payment live in the URL. */
export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsSection />
    </Suspense>
  );
}
