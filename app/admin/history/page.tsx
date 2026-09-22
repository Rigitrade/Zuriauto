"use client";

import { Suspense } from "react";
import { HistorySection } from "@/components/admin/sections/HistorySection";

/**
 * Wrapped in Suspense because the section reads `?car=` — the car profile
 * links here with one named — and `useSearchParams` requires a boundary it can
 * suspend at while the URL is read on the client. Without it the build refuses
 * the page rather than the reader noticing anything at runtime.
 *
 * The fallback is empty on purpose: the shell has already painted the frame,
 * and a spinner for something this fast is a flash rather than feedback.
 */
export default function AdminHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistorySection />
    </Suspense>
  );
}
