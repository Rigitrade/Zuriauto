"use client";

import { useEffect } from "react";
import { enterPartnerFrame } from "./partnerFrame";

/** Raises the partner frame flag while the partner's frame is on screen. */
export function PartnerFrameMarker() {
  useEffect(() => enterPartnerFrame(), []);
  return null;
}
