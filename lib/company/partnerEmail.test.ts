import { describe, expect, it } from "vitest";
import { buildCustomerEmail } from "@/lib/rental/customerEmail";
import { labelsFor } from "@/lib/rental/labels";
import { identityOf, withCompany, type CompanyColumns } from "./identity";

/**
 * Multi-company phase B (15.11.2026): the contract and return confirmation a
 * partner's renter receives is the partner's, with "powered by ZURIAUTO".
 */

const NONE: Omit<CompanyColumns, "name"> = {
  brandName: null, legalName: null, street: null, postalCode: null, city: null, uid: null,
  phone: null, officeEmail: null, signerName: null, website: null, signingPlace: null,
  paymentUrl: null, twintUrl: null,
};

const meier = (columns: Partial<CompanyColumns> = {}) =>
  identityOf({ ...NONE, name: "Meier Mietwagen GmbH", brandName: "Meier <Cars>", ...columns }, false);

function mail(company = meier(), language: "de" | "en" = "de") {
  const L = withCompany(labelsFor(language), company);
  return buildCustomerEmail({
    language,
    customerName: "Anna Meier",
    referenceLabel: L.pdf.contractNumber,
    referenceNumber: "ZA-20260822-0002",
    hello: L.email.customerHello,
    body: L.email.customerBody,
    company,
  });
}

describe("a partner's confirmation email", () => {
  it("carries the partner's escaped brand, legal name and powered by ZURIAUTO", () => {
    const { html, text } = mail();

    expect(html).toContain("Meier &lt;Cars&gt;");
    expect(html).not.toContain("Meier <Cars>");
    expect(html).toContain("Meier Mietwagen GmbH");
    expect(html).toContain("powered by ZURIAUTO");
    expect(text).toMatch(/Meier <Cars>\npowered by ZURIAUTO$/);
  });

  it("names no other ZURIAUTO identity", () => {
    const { html, text } = mail();
    for (const part of [html, text]) {
      const rest = part.replaceAll("powered by ZURIAUTO", "");
      expect(rest).not.toMatch(/ZURIAUTO|Rigitrade|zuriauto\.ch|sumup|twint\.ch/i);
    }
  });

  it("leaves out the payment buttons and lines when the partner has no payment links", () => {
    const { html, text } = mail();
    const L = labelsFor("de");
    expect(html).not.toContain("<a href=");
    expect(html).not.toContain(L.result.payHint);
    expect(text).not.toContain(L.email.customerPayment);
  });

  it("shows only the payment link the partner has", () => {
    const { html, text } = mail(meier({ twintUrl: "https://go.twint.ch/meier" }));
    const L = labelsFor("de");
    expect(html).toContain("https://go.twint.ch/meier");
    // One button: the TWINT one.
    expect(html.match(/<a href=/g)).toHaveLength(1);
    expect(text).toContain("https://go.twint.ch/meier");
    expect(text).not.toContain(L.email.customerPayment + "\n");
  });

  it("links the partner's website in the footer when it has one", () => {
    const { html } = mail(meier({ website: "meier.example" }));
    expect(html).toContain('href="https://meier.example"');
  });
});

describe("the payment hint names only the ways the company offers", () => {
  const hint = (html: string) => /<p[^>]*>([^<]*(?:bezahlen|right away)[^<]*)<\/p>/.exec(html)?.[1] ?? "";

  it("card link only: card, no TWINT", () => {
    const { html } = mail(meier({ paymentUrl: "https://pay.example.test/m" }));
    expect(hint(html)).toBe("Sie können die Miete direkt und sicher per Kreditkarte bezahlen.");
  });

  it("TWINT link only: TWINT, no card", () => {
    const { html } = mail(meier({ twintUrl: "https://twint.example.test/m" }), "en");
    expect(hint(html)).toBe("You can pay the rental securely by TWINT right away.");
  });

  it("both links: the existing sentence", () => {
    const { html } = mail(meier({ paymentUrl: "https://pay.example.test/m", twintUrl: "https://twint.example.test/m" }));
    expect(hint(html)).toBe("Sie können die Miete direkt und sicher per Kreditkarte oder TWINT bezahlen.");
  });
});
