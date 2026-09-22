"use client";

import { use } from "react";
import { CarProfileSection } from "@/components/admin/sections/CarProfileSection";

/**
 * One car's profile.
 *
 * A client component reading the id out of the route, because the section it
 * renders lives on the overview payload the shell already holds — this page
 * fetches nothing of its own, which is what makes it instant from the fleet
 * list. `use()` unwraps the params promise Next hands a page in this version.
 */
export default function AdminCarProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CarProfileSection carId={id} />;
}
