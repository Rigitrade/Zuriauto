import { describe, expect, it } from "vitest";
import { enterPartnerFrame, inPartnerFrame, subscribePartnerFrame } from "./partnerFrame";

/**
 * ZURIAUTO's site-wide widgets (the WhatsApp button) stay off a partner's
 * pages (multi-company phase C, 16.11.2026): they would send the partner's
 * renter to ZURIAUTO.
 */
describe("the partner frame flag", () => {
  it("is up while a partner frame is on screen, and down after", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribePartnerFrame(() => seen.push(inPartnerFrame()));
    expect(inPartnerFrame()).toBe(false);

    const leave = enterPartnerFrame();
    expect(inPartnerFrame()).toBe(true);
    leave();
    expect(inPartnerFrame()).toBe(false);
    expect(seen).toEqual([true, false]);
    unsubscribe();
  });

  it("stays up until every frame has left", () => {
    const first = enterPartnerFrame();
    const second = enterPartnerFrame();
    first();
    expect(inPartnerFrame()).toBe(true);
    second();
    expect(inPartnerFrame()).toBe(false);
  });
});
