import { describe, expect, it } from "vitest";
import { identityOf, ZURIAUTO_IDENTITY, type CompanyColumns } from "./identity";
import { companyMail } from "./mailEnvelope";

const CONFIG = {
  host: "smtp.example",
  port: 587,
  user: "noreply@zuriauto.ch",
  pass: "secret",
  from: "ZURIAUTO <noreply@zuriauto.ch>",
  office: "info@zuriauto.ch",
  archive: "archive@zuriauto.ch",
};

const NONE: Omit<CompanyColumns, "name"> = {
  brandName: null, legalName: null, street: null, postalCode: null, city: null, uid: null,
  phone: null, officeEmail: null, signerName: null, website: null, signingPlace: null,
  paymentUrl: null, twintUrl: null,
};

const partner = (columns: Partial<CompanyColumns>) =>
  identityOf({ ...NONE, name: "Meier Mietwagen GmbH", ...columns }, false);

describe("companyMail", () => {
  it("leaves ZURIAUTO's mail exactly as configured", () => {
    expect(companyMail(CONFIG, ZURIAUTO_IDENTITY)).toEqual(CONFIG);
  });

  it("sends ZURIAUTO's office mail to its own office address once one is set", () => {
    const mail = companyMail(CONFIG, { ...ZURIAUTO_IDENTITY, officeEmail: "office@zuriauto.ch" });
    expect(mail).toEqual({ ...CONFIG, office: "office@zuriauto.ch" });
  });

  it("sends a partner's mail from the shared address under the partner's name, to its office, with no archive copy", () => {
    const mail = companyMail(CONFIG, partner({ brandName: "MEIER CARS", officeEmail: "office@meier.example" }));
    expect(mail).toEqual({
      host: "smtp.example",
      port: 587,
      user: "noreply@zuriauto.ch",
      pass: "secret",
      from: '"MEIER CARS" <noreply@zuriauto.ch>',
      office: "office@meier.example",
      // A renter's reply reaches the partner, not the shared sender mailbox.
      replyTo: "office@meier.example",
    });
  });

  it("takes a bare MAIL_FROM address as the address", () => {
    const mail = companyMail({ ...CONFIG, from: "noreply@zuriauto.ch" }, partner({ officeEmail: "o@meier.example" }));
    expect(mail?.from).toBe('"Meier Mietwagen GmbH" <noreply@zuriauto.ch>');
  });

  it("keeps quotes and line breaks in a name out of the header", () => {
    const mail = companyMail(CONFIG, partner({ brandName: 'Meier "Cars"\r\nBcc: x@evil', officeEmail: "o@meier.example" }));
    expect(mail?.from).toBe('"Meier Cars Bcc: x@evil" <noreply@zuriauto.ch>');
  });

  it("sends nothing for a partner with no office address, rather than to ZURIAUTO's office", () => {
    expect(companyMail(CONFIG, partner({}))).toBeNull();
  });
});
