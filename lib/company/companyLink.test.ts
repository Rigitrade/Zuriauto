import { describe, expect, it } from "vitest";
import { companyFormUrl, withCompanyParam } from "./companyLink";
import { noCarForPartner } from "@/lib/rental/labels";

/** A partner's own pickup and return links (multi-company phase C, 16.11.2026). */

describe("withCompanyParam", () => {
  it("leaves ZURIAUTO's calls exactly as they were", () => {
    expect(withCompanyParam("/api/fleet/", undefined)).toBe("/api/fleet/");
    expect(withCompanyParam("/api/fleet/?scope=return", null)).toBe("/api/fleet/?scope=return");
  });

  it("names the partner on its pages' calls", () => {
    expect(withCompanyParam("/api/fleet/", "meier")).toBe("/api/fleet/?company=meier");
    expect(withCompanyParam("/api/fleet/?scope=return", "meier")).toBe("/api/fleet/?scope=return&company=meier");
  });
});

describe("companyFormUrl", () => {
  it("builds the link the partner sends its renters", () => {
    expect(companyFormUrl("https://www.zuriauto.ch/", "meier", "pickup")).toBe("https://www.zuriauto.ch/meier/pickup/");
    expect(companyFormUrl("https://www.zuriauto.ch", "meier", "return")).toBe("https://www.zuriauto.ch/meier/return/");
  });
});

describe("noCarForPartner", () => {
  it("sends the partner's renter to the partner, not to ZURIAUTO's waiting list", () => {
    expect(noCarForPartner("de", "MEIER CARS")).toContain("MEIER CARS");
    expect(noCarForPartner("en", "MEIER CARS")).toContain("MEIER CARS");
    expect(noCarForPartner("de", "MEIER CARS")).not.toMatch(/ZURIAUTO/i);
  });
});
