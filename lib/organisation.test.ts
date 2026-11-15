import { describe, expect, it } from "vitest";
import { isValidCompanySlug } from "./organisation";

describe("isValidCompanySlug", () => {
  it("accepts meier and auto-meier-2", () => {
    expect(isValidCompanySlug("meier")).toBe(true);
    expect(isValidCompanySlug("auto-meier-2")).toBe(true);
  });

  it("refuses names of existing pages, in any case", () => {
    for (const slug of ["admin", "pickup", "return", "GTC", "gtc", "api", "book", "privacy"]) {
      expect(isValidCompanySlug(slug), slug).toBe(false);
    }
  });

  it("refuses a leading or trailing hyphen, one letter, capitals and 40 characters", () => {
    expect(isValidCompanySlug("-meier")).toBe(false);
    expect(isValidCompanySlug("meier-")).toBe(false);
    expect(isValidCompanySlug("a")).toBe(false);
    expect(isValidCompanySlug("Meier")).toBe(false);
    expect(isValidCompanySlug("a".repeat(40))).toBe(false);
  });
});
