import { describe, expect, it } from "vitest";
import { newPartnerSchema } from "./partners";
import { isValidCompanySlug, suggestSlug } from "@/lib/company/slug";

/**
 * Creating a partner company from Konten (15.11.2026): the minimum a partner
 * needs before its owner can sign in and fill in the rest under Firma.
 */

const valid = {
  brandName: "  MEIER CARS ",
  legalName: "Meier Mietwagen GmbH",
  slug: " Meier ",
  officeEmail: " Office@Meier-Cars.ch ",
  owner: { displayName: "Hans Meier", username: " Meier ", password: "lang-genug-123" },
};

describe("newPartnerSchema", () => {
  it("accepts the minimum, trimmed and lower-cased where it is typed to sign in or link", () => {
    expect(newPartnerSchema.parse(valid)).toEqual({
      brandName: "MEIER CARS",
      legalName: "Meier Mietwagen GmbH",
      slug: "meier",
      officeEmail: "office@meier-cars.ch",
      owner: { displayName: "Hans Meier", username: "meier", password: "lang-genug-123" },
    });
  });

  it.each(["brandName", "legalName", "slug", "officeEmail"] as const)("requires %s", (field) => {
    const result = newPartnerSchema.safeParse({ ...valid, [field]: "   " });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((issue) => issue.path.join("."))).toContain(field);
  });

  it("requires the owner's name, username and a password of 10+ characters", () => {
    const result = newPartnerSchema.safeParse({
      ...valid,
      owner: { displayName: "", username: "a b", password: "short" },
    });
    expect(result.error!.issues.map((issue) => issue.path.join(".")).sort()).toEqual([
      "owner.displayName",
      "owner.password",
      "owner.username",
    ]);
  });

  it("refuses a short name the site already uses, or one that is not a link word", () => {
    for (const slug of ["admin", "pickup", "-meier", "m", "meier cars"]) {
      expect(newPartnerSchema.safeParse({ ...valid, slug }).success, slug).toBe(false);
    }
  });

  it("refuses one office address that is not an email, and line breaks in names", () => {
    expect(newPartnerSchema.safeParse({ ...valid, officeEmail: "office" }).success).toBe(false);
    expect(newPartnerSchema.safeParse({ ...valid, brandName: "MEIER\r\nBcc: x@y.ch" }).success).toBe(false);
  });

  it("refuses anything else, such as a company id", () => {
    expect(newPartnerSchema.safeParse({ ...valid, organisationId: "x" }).success).toBe(false);
  });
});

describe("suggestSlug", () => {
  it.each([
    ["MEIER CARS", "meier-cars"],
    ["Zürich Auto AG", "zuerich-auto-ag"],
    ["Émile & Söhne", "emile-soehne"],
    ["  --Auto  ", "auto"],
    ["", ""],
  ])("%s → %s", (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });

  it("keeps a long name to a valid short name", () => {
    const slug = suggestSlug("Die allerbeste Autovermietung im ganzen Kanton Zürich GmbH");
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(isValidCompanySlug(slug)).toBe(true);
  });
});
