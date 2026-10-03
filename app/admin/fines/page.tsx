"use client";

import { Suspense } from "react";
import { FinesSection } from "@/components/admin/sections/FinesSection";

/** Suspense for `useSearchParams` — the tab and the open fine live in the URL,
 *  so a fine can be linked to from an email to the office. */
export default function AdminFinesPage() {
  return (
    <Suspense fallback={null}>
      <FinesSection />
    </Suspense>
  );
}
