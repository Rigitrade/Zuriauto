import { describe, expect, it } from "vitest";
import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";
import { labelsFor } from "@/lib/rental/labels";
import {
  identityOf,
  publicCompany,
  signOff,
  withCompany,
  ZURIAUTO_IDENTITY,
  type CompanyColumns,
} from "./identity";

const EMPTY: CompanyColumns = {
  name: "",
  brandName: null,
  legalName: null,
  street: null,
  postalCode: null,
  city: null,
  uid: null,
  phone: null,
  officeEmail: null,
  signerName: null,
  website: null,
  signingPlace: null,
  paymentUrl: null,
  twintUrl: null,
};

describe("ZURIAUTO_IDENTITY", () => {
  it("is what the documents print today", () => {
    expect(ZURIAUTO_IDENTITY).toEqual({
      brandName: "ZURIAUTO",
      legalName: "Rigitrade AG",
      street: "Schaffhauserstrasse 550",
      postalCode: "8052",
      city: "Zürich",
      uid: "CHE-199.884.159",
      phone: "+41 58 513 99 96",
      officeEmail: null,
      signerName: "Katamesh, Ahmed",
      website: "zuriauto.ch",
      signingPlace: "Zurich",
      paymentUrl: PAYMENT_URL,
      twintUrl: TWINT_URL,
      poweredBy: false,
    });
  });
});

describe("identityOf", () => {
  it("gives the site company ZURIAUTO's values where its columns are empty", () => {
    expect(identityOf({ ...EMPTY, name: "ZURIAUTO" }, true)).toEqual(ZURIAUTO_IDENTITY);
  });

  it("lets the site company's own columns win", () => {
    const id = identityOf({ ...EMPTY, name: "ZURIAUTO", phone: "+41 44 000 00 00" }, true);
    expect(id.phone).toBe("+41 44 000 00 00");
    expect(id.brandName).toBe("ZURIAUTO");
  });

  it("never gives a partner company ZURIAUTO's values", () => {
    const id = identityOf({ ...EMPTY, name: "Meier Mietwagen GmbH" }, false);
    expect(id).toEqual({
      brandName: "Meier Mietwagen GmbH",
      legalName: "Meier Mietwagen GmbH",
      street: null,
      postalCode: null,
      city: null,
      uid: null,
      phone: null,
      officeEmail: null,
      signerName: null,
      website: null,
      signingPlace: "",
      paymentUrl: null,
      twintUrl: null,
      poweredBy: true,
    });
    for (const value of Object.values(id)) {
      if (typeof value !== "string" || value === "") continue;
      expect(Object.values(ZURIAUTO_IDENTITY)).not.toContain(value);
    }
  });

  it("takes a partner's signing place from its city when none is set", () => {
    const id = identityOf({ ...EMPTY, name: "Meier", brandName: "MEIER CARS", city: "Winterthur" }, false);
    expect(id.signingPlace).toBe("Winterthur");
    expect(id.brandName).toBe("MEIER CARS");
    expect(id.legalName).toBe("Meier");
  });

  it("treats blank columns as unset", () => {
    const id = identityOf({ ...EMPTY, name: "Meier", brandName: "  ", phone: "" }, false);
    expect(id.brandName).toBe("Meier");
    expect(id.phone).toBeNull();
  });
});

describe("publicCompany", () => {
  it("carries only what the renter's browser needs", () => {
    expect(publicCompany(ZURIAUTO_IDENTITY)).toEqual({
      brandName: "ZURIAUTO",
      legalName: "Rigitrade AG",
      signingPlace: "Zurich",
      paymentUrl: PAYMENT_URL,
      twintUrl: TWINT_URL,
      poweredBy: false,
    });
  });
});

describe("signOff", () => {
  it("is today's sign-off for ZURIAUTO", () => {
    expect(signOff(ZURIAUTO_IDENTITY, "de")).toEqual(["Freundliche Grüsse", "ZURIAUTO"]);
    expect(signOff(ZURIAUTO_IDENTITY, "en")).toEqual(["Kind regards", "ZURIAUTO"]);
  });

  it("adds powered by ZURIAUTO for a partner", () => {
    const partner = identityOf({ ...EMPTY, name: "Meier" }, false);
    expect(signOff(partner, "de")).toEqual(["Freundliche Grüsse", "Meier", "powered by ZURIAUTO"]);
  });
});

describe("withCompany", () => {
  it("fills {company} in every string of a nested value, leaving the rest alone", () => {
    const partner = identityOf({ ...EMPTY, name: "Meier" }, false);
    expect(
      withCompany({ a: "Sent to {company}.", b: { c: ["{company} – {company}", 3] }, d: null }, partner)
    ).toEqual({ a: "Sent to Meier.", b: { c: ["Meier – Meier", 3] }, d: null });
  });
});

describe("the rental labels", () => {
  it.each(["de", "en"] as const)("name no company of their own, %s", (language) => {
    const partner = identityOf({ ...EMPTY, name: "Meier" }, false);
    const text = JSON.stringify(withCompany(labelsFor(language), partner));
    expect(text).not.toContain("ZURIAUTO");
    expect(text).not.toContain("{company}");
    expect(text).toContain("Meier");
  });
});
