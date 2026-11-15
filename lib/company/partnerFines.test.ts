import { describe, expect, it } from "vitest";
import {
  driverNominationMail,
  fineNoticeMail,
  fineReopenedMail,
  fineThanksMail,
  renterNamedMail,
} from "@/lib/fines/mail";
import { emailsOnLetter } from "@/lib/fines/nomination";
import { fineCtx } from "./__fixtures__/documents";
import { identityOf, ownMailDomains, ZURIAUTO_IDENTITY, type CompanyColumns } from "./identity";

/**
 * Multi-company phase B (15.11.2026): a partner is the registered keeper of
 * its cars, so its renters' fines and its letters to the police are in its
 * own name.
 */

const NONE: Omit<CompanyColumns, "name"> = {
  brandName: null, legalName: null, street: null, postalCode: null, city: null, uid: null,
  phone: null, officeEmail: null, signerName: null, website: null, signingPlace: null,
  paymentUrl: null, twintUrl: null,
};
const meier = (columns: Partial<CompanyColumns> = {}) =>
  identityOf({ ...NONE, name: "Meier Mietwagen GmbH", brandName: "MEIER CARS", ...columns }, false);

const withoutPoweredBy = (text: string) => text.replaceAll("powered by ZURIAUTO", "");

describe("a partner's fine mails to its renter", () => {
  it.each(["de", "en"] as const)("are in the partner's name, %s", (language) => {
    const company = meier();
    // The fine link is the platform site until phase C gives companies links.
    const ctx = { ...fineCtx(language), company, payUrl: "https://example.test/pay" };
    const mails = {
      notice: fineNoticeMail(ctx),
      reopened: fineReopenedMail(ctx),
      thanks: fineThanksMail(ctx),
      named: renterNamedMail({ ...ctx, fineNumber: "B-123456" }),
    };
    for (const [name, mail] of Object.entries(mails)) {
      expect(mail.text, name).toMatch(/\nMEIER CARS\npowered by ZURIAUTO$/);
      expect(withoutPoweredBy(mail.text), name).not.toMatch(/ZURIAUTO|sumup|twint\.ch/i);
    }
    expect(mails.notice.text).toContain(
      language === "en" ? "MEIER CARS does not collect it." : "MEIER CARS zieht ihn nicht ein."
    );
  });

  it.each(["de", "en"] as const)("ask for the handling fee at the office when the partner has no payment page, %s", (language) => {
    const text = fineNoticeMail({ ...fineCtx(language), company: meier() }).text;
    expect(text).toContain(language === "en" ? "Please pay it to our office, quoting fine B-123456." : "Bitte bezahlen Sie diese an unser Büro mit dem Vermerk «Busse B-123456».");
    expect(text).not.toMatch(/^(Card|Karte|TWINT):/m);
  });

  it("list only the partner's own payment links for the fee", () => {
    const text = fineNoticeMail({ ...fineCtx("en"), company: meier({ twintUrl: "https://go.twint.ch/meier" }) }).text;
    expect(text).toContain("TWINT: https://go.twint.ch/meier");
    expect(text).not.toMatch(/^Card:/m);
  });
});

describe("a partner's driver nomination letter", () => {
  const letter = (company = meier()) =>
    driverNominationMail({
      fineNumber: "B-123456",
      plate: "ZH 777777",
      violationAt: new Date("2026-10-02T08:00:00Z"),
      timeKnown: true,
      papers: [],
      company,
      driver: {
        firstName: "Anna", lastName: "Meier", birthDate: new Date("1990-04-12T00:00:00Z"),
        street: "Bahnhofstrasse 1", postalCode: "8001", city: "Zürich", country: "Switzerland",
        phone: "+41791234567", email: null,
      },
    });

  it("is signed by the partner, with its own contact block", () => {
    const { text } = letter(
      meier({ signerName: "Meier, Hans", website: "meier-cars.ch", phone: "+41 52 000 00 00", street: "Hauptstrasse 1", postalCode: "8400", city: "Winterthur" })
    );
    expect(text.split("\n").slice(-9)).toEqual([
      "Freundliche Grüsse",
      "Meier, Hans",
      "*************",
      "Meier-cars.ch",
      "Eine Marke der Meier Mietwagen GmbH",
      "T. +41 52 000 00 00",
      "",
      "Hauptstrasse 1",
      "8400 Winterthur",
    ]);
    expect(text).not.toMatch(/ZURIAUTO|Zuriauto|Rigitrade|Katamesh|Schaffhauserstrasse/);
  });

  it("leaves out what the partner has not filled in", () => {
    const { text } = letter();
    expect(text.split("\n").slice(-5)).toEqual([
      "Für Rückfragen stehen wir Ihnen gerne zur Verfügung.",
      "Freundliche Grüsse",
      "*************",
      "MEIER CARS",
      "Eine Marke der Meier Mietwagen GmbH",
    ]);
  });
});

describe("addresses on a letter", () => {
  const letterText = "Kontakt: info@meier-cars.ch, office@zuriauto.ch, verkehr@polizei.example";

  it("are the authority's, not the keeper's own, for a partner", () => {
    const domains = ownMailDomains(meier({ website: "meier-cars.ch", officeEmail: "office@meier-mail.ch" }));
    expect(domains).toEqual(["zuriauto.ch", "rigitrade.ch", "meier-cars.ch", "meier-mail.ch"]);
    expect(emailsOnLetter(letterText, domains)).toEqual(["verkehr@polizei.example"]);
  });

  it("are as before for ZURIAUTO", () => {
    expect(ownMailDomains(ZURIAUTO_IDENTITY)).toEqual(["zuriauto.ch", "rigitrade.ch"]);
    expect(emailsOnLetter(letterText, ownMailDomains(ZURIAUTO_IDENTITY))).toEqual([
      "info@meier-cars.ch",
      "verkehr@polizei.example",
    ]);
  });
});
