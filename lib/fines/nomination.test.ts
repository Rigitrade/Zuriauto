import { describe, expect, it } from "vitest";
import { KAPO_ZH_OCR } from "./__fixtures__/texts";
import { driverNominationMail } from "./mail";
import {
  decideNomination,
  emailsOnLetter,
  nominationEnabled,
  type Driver,
  type NominationFacts,
} from "./nomination";

/** The head of the Kommunalpolizei Uitikon letter of 12.10.2026, as OCR reads it. */
const UITIKON = `Kommunalpolizei Uitikon
Zürcherstrasse 59, 8142 Uitikon
Tel. 044 200 15 17
ordnungsbussen@uitikon.org
Kommunalpolizei, Zürcherstrasse 59, 8142 Uitikon
Busse online bezahlen:
Rigitrade AG
Tannenstrasse 16
8424 Embrach
Zahlungserinnerung / Anzeigevorhalt Bussen-Nr. 18440`;

const driver: Driver = {
  firstName: "Mohit",
  lastName: "Mohit",
  birthDate: new Date("1995-04-14T00:00:00Z"),
  street: "Breitenstrasse 5",
  postalCode: "8914",
  city: "Aeugst am Albis",
  country: "Switzerland",
  phone: "+41 76 204 26 51",
  email: "dahiyam765@gmail.com",
};

const facts = (over: Partial<NominationFacts> = {}): NominationFacts => ({
  driver,
  fineNumber: "18440",
  iban: "CH5930000003800077026",
  emailsOnLetter: ["ordnungsbussen@uitikon.org"],
  confirmedEmail: "ordnungsbussen@uitikon.org",
  ...over,
});

describe("emailsOnLetter", () => {
  it("finds the authority's address in the letter head", () => {
    expect(emailsOnLetter(UITIKON)).toEqual(["ordnungsbussen@uitikon.org"]);
  });

  it("finds none on the Kantonspolizei Zürich letter, which prints none", () => {
    expect(emailsOnLetter(KAPO_ZH_OCR)).toEqual([]);
  });

  it("leaves out our own addresses and the placeholder domain", () => {
    expect(
      emailsOnLetter("info@zuriauto.ch office@rigitrade.ch renter-1@unrecorded.invalid bussen@stadt-zuerich.ch")
    ).toEqual(["bussen@stadt-zuerich.ch"]);
  });

  it("closes up spaces OCR puts round the @, and lowercases", () => {
    expect(emailsOnLetter("Ordnungsbussen @ Uitikon.org")).toEqual(["ordnungsbussen@uitikon.org"]);
  });

  it("lists each address once, and every different one", () => {
    expect(emailsOnLetter("a@polizei.ch, a@polizei.ch. b@polizei.ch")).toEqual([
      "a@polizei.ch",
      "b@polizei.ch",
    ]);
  });

  it("does not guess at an address OCR broke", () => {
    expect(emailsOnLetter("ordnungsbussen@uitikon,org")).toEqual([]);
  });
});

describe("decideNomination", () => {
  it("sends to the confirmed address when the letter shows it", () => {
    expect(decideNomination(facts())).toEqual({ send: true, to: "ordnungsbussen@uitikon.org" });
  });

  it("finds the confirmed address among several on the letter", () => {
    expect(
      decideNomination(facts({ emailsOnLetter: ["info@uitikon.org", "ordnungsbussen@uitikon.org"] }))
    ).toEqual({ send: true, to: "ordnungsbussen@uitikon.org" });
  });

  it("sends a letter with no address to the one confirmed for its authority", () => {
    // The Kantonspolizei Zürich prints none.
    expect(decideNomination(facts({ emailsOnLetter: [] }))).toEqual({
      send: true,
      to: "ordnungsbussen@uitikon.org",
    });
  });

  it("holds a letter with no address when none is confirmed for its authority", () => {
    expect(decideNomination(facts({ emailsOnLetter: [], confirmedEmail: null }))).toEqual({
      send: false,
      reason: "NOMINATION_NO_EMAIL",
      suggestion: null,
    });
  });

  it("holds the first letter of an authority, with the address read as the suggestion", () => {
    expect(decideNomination(facts({ confirmedEmail: null }))).toEqual({
      send: false,
      reason: "NOMINATION_NEW_ADDRESS",
      suggestion: "ordnungsbussen@uitikon.org",
    });
  });

  it("holds a letter whose address differs from the confirmed one", () => {
    expect(
      decideNomination(facts({ emailsOnLetter: ["bussen@uitikon.ch"] }))
    ).toEqual({ send: false, reason: "NOMINATION_ADDRESS_CHANGED", suggestion: "bussen@uitikon.ch" });
  });

  it("holds several addresses with none confirmed, suggesting none", () => {
    expect(
      decideNomination(facts({ confirmedEmail: null, emailsOnLetter: ["a@uitikon.org", "b@uitikon.org"] }))
    ).toEqual({ send: false, reason: "NOMINATION_SEVERAL_EMAILS", suggestion: null });
  });

  it("holds a letter with no payment slip to recognise the authority by", () => {
    expect(decideNomination(facts({ iban: null }))).toMatchObject({
      send: false,
      reason: "NOMINATION_NO_AUTHORITY",
    });
  });

  it("holds a fine with no Busse-Nr. to quote", () => {
    expect(decideNomination(facts({ fineNumber: " " }))).toMatchObject({
      send: false,
      reason: "NOMINATION_NO_NUMBER",
    });
  });

  it("holds a driver the authority could not reach", () => {
    for (const missing of [
      null,
      { ...driver, birthDate: null },
      { ...driver, street: "" },
      { ...driver, lastName: " " },
      // A car marked out without a renter: nobody to name.
      { ...driver, email: "renter-7@unrecorded.invalid" },
    ]) {
      expect(decideNomination(facts({ driver: missing }))).toMatchObject({
        send: false,
        reason: "NOMINATION_DRIVER_INCOMPLETE",
      });
    }
  });
});

describe("nominationEnabled", () => {
  it("is on unless switched off", () => {
    expect(nominationEnabled({})).toBe(true);
    expect(nominationEnabled({ FINES_DRIVER_NOMINATION: "off" })).toBe(false);
  });
});

describe("driverNominationMail", () => {
  it("is the owner's email, filled in", () => {
    const mail = driverNominationMail({
      fineNumber: "246564",
      plate: "ZH 401 859",
      // 21:02 in Zurich, summer time.
      violationAt: new Date("2026-07-18T19:02:00Z"),
      timeKnown: true,
      papers: [],
      driver: { ...driver, birthDate: driver.birthDate! },
    });
    expect(mail.subject).toBe("Lenkerangabe zu Busse-Nr. 246564 – ZH 401 859");
    expect(mail.text).toBe(
      [
        "Sehr geehrte Damen und Herren",
        "",
        "Anbei informieren wir Sie über den Lenker zum Bussgeld (Busse-Nr. 246564).",
        "",
        "Unser Fahrzeug ZH 401 859 wurde am 18.07.2026 um 21:02 Uhr von folgender Person gefahren:",
        "",
        "Name, Vorname:  MOHIT, Mohit",
        "Geburtsdatum:   14.04.1995",
        "Wohnadresse:    Breitenstrasse 5, 8914 Aeugst am Albis",
        "Mobil-Nr.:      +41 76 204 26 51",
        "E-Mail:         dahiyam765@gmail.com",
        "",
        "Für Rückfragen stehen wir Ihnen gerne zur Verfügung.",
        "Freundliche Grüsse",
        "Katamesh, Ahmed",
        "*************",
        "Zuriauto.ch",
        "Eine Marke der Rigitrade AG",
        "T. +41 58 513 99 96",
        "",
        "Schaffhauserstrasse 550",
        "8052 Zürich",
      ].join("\n")
    );
  });

  it("leaves out the hour when the letter gave none, and names a foreign country", () => {
    const mail = driverNominationMail({
      fineNumber: "1",
      plate: "ZH 1",
      violationAt: new Date("2026-07-17T22:00:00Z"),
      timeKnown: false,
      papers: [],
      driver: { ...driver, birthDate: driver.birthDate!, country: "Germany", email: null },
    });
    expect(mail.text).toContain("wurde am 18.07.2026 von folgender Person gefahren:");
    expect(mail.text).toContain("8914 Aeugst am Albis, Germany");
    expect(mail.text).not.toContain("E-Mail:");
  });

  it("lists the rental's papers it carries, after the driver's details", () => {
    const mail = driverNominationMail({
      fineNumber: "1",
      plate: "ZH 1",
      violationAt: new Date("2026-07-17T22:00:00Z"),
      timeKnown: false,
      papers: [
        "Mietvertrag ZA-20260701-0003 vom 01.07.2026, mit Kopien von Ausweis und Führerausweis",
        "Rückgabeprotokoll ZR-20260720-401859-C3D4 vom 20.07.2026",
      ],
      driver: { ...driver, birthDate: driver.birthDate! },
    });
    expect(mail.text).toContain(
      [
        "E-Mail:         dahiyam765@gmail.com",
        "",
        "Als Nachweis der Miete liegen bei:",
        "- Mietvertrag ZA-20260701-0003 vom 01.07.2026, mit Kopien von Ausweis und Führerausweis",
        "- Rückgabeprotokoll ZR-20260720-401859-C3D4 vom 20.07.2026",
        "",
        "Für Rückfragen stehen wir Ihnen gerne zur Verfügung.",
      ].join("\n")
    );
  });
});
