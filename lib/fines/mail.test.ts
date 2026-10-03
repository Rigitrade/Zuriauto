import { describe, expect, it } from "vitest";
import {
  fineNoticeMail,
  fineReopenedMail,
  fineThanksMail,
  officeFineAlertMail,
  officeFineDigestMail,
  type FineMailContext,
} from "./mail";

const CTX: FineMailContext = {
  language: "de",
  firstName: "Anna",
  plate: "ZH 513 925",
  carModel: "Toyota Prius Hybrid",
  violationAt: new Date("2026-07-02T08:00:00Z"),
  timeKnown: true,
  location: "Lufingen, Zürcherstrasse",
  offence: {
    de: "Überschreiten allgemeiner, fahrzeugbedingter oder signalisierter Höchstgeschwindigkeit innerorts",
    en: "Exceeding the general, vehicle-specific or signposted speed limit in a built-up area by 1–5 km/h",
  },
  amountCents: 4000,
  dueDate: new Date("2026-10-04T00:00:00Z"),
  issuerName: "Kantonspolizei Zürich",
  fineNumber: "830557506 017 4",
  feeCents: 2000,
  payUrl: "https://www.zuriauto.ch/fines/pay/?t=abc",
  reminder: false,
};

describe("fineNoticeMail", () => {
  it("tells a German renter what, when, where and how to pay", () => {
    const mail = fineNoticeMail(CTX);
    expect(mail.subject).toBe("Busse für ZH 513 925 vom 02.07.2026");
    for (const part of [
      "Guten Tag Anna",
      "02.07.2026, 10:00",
      "Lufingen, Zürcherstrasse",
      "Höchstgeschwindigkeit",
      "CHF 40.00",
      "04.10.2026",
      "Kantonspolizei Zürich",
      "830557506 017 4",
      "Einzahlungsschein",
      "https://www.zuriauto.ch/fines/pay/?t=abc",
      "CHF 20.00",
    ]) {
      expect(mail.text).toContain(part);
    }
  });

  it("writes to an English renter in English, without German words", () => {
    const mail = fineNoticeMail({ ...CTX, language: "en" });
    expect(mail.subject).toBe("Traffic fine for ZH 513 925 of 02.07.2026");
    expect(mail.text).toContain("Hello Anna");
    expect(mail.text).toContain("speed limit");
    expect(mail.text).toContain("payment slip");
    expect(mail.text).not.toMatch(/Mahnung|Busse|Einzahlungsschein/);
  });

  it("says nothing about a fee when there is none", () => {
    expect(fineNoticeMail({ ...CTX, feeCents: 0 }).text).not.toContain("CHF 20.00");
    expect(fineNoticeMail({ ...CTX, feeCents: 0 }).text).not.toMatch(/Bearbeitungsgebühr/);
  });

  it("gives the date alone when the letter gives no time", () => {
    const mail = fineNoticeMail({ ...CTX, timeKnown: false });
    expect(mail.text).toContain("02.07.2026");
    expect(mail.text).not.toContain("10:00");
  });

  it("says a reminder's deadline is close", () => {
    expect(fineNoticeMail({ ...CTX, reminder: true }).subject).toBe("Mahnung: Busse für ZH 513 925 vom 02.07.2026");
    expect(fineNoticeMail({ ...CTX, reminder: true }).text).toContain("noch nicht bezahlt");
    expect(fineNoticeMail({ ...CTX, language: "en", reminder: true }).text).toContain("not been paid");
  });
});

describe("the other renter mails", () => {
  it("tells a renter the police still have no payment", () => {
    expect(fineReopenedMail(CTX).text).toContain("https://www.zuriauto.ch/fines/pay/?t=abc");
    expect(fineReopenedMail({ ...CTX, language: "en" }).subject).toContain("ZH 513 925");
  });

  it("thanks a renter whose payment was confirmed", () => {
    expect(fineThanksMail(CTX).subject).toContain("ZH 513 925");
    expect(fineThanksMail({ ...CTX, language: "en" }).text).toContain("Thank you");
  });
});

describe("office mails", () => {
  it("are German and link to the fine", () => {
    const mail = officeFineAlertMail({
      kind: "reopened",
      plate: "ZH 513 925",
      fineNumber: "830557506 017 4",
      renterName: "Anna Meier",
      detail: "Mahnung erhalten",
      fineUrl: "https://www.zuriauto.ch/admin/fines/?fine=f1",
    });
    expect(mail.subject).toContain("ZH 513 925");
    expect(mail.text).toContain("Anna Meier");
    expect(mail.text).toContain("https://www.zuriauto.ch/admin/fines/?fine=f1");
  });

  it("collects the day's review cases in one digest", () => {
    const mail = officeFineDigestMail(
      [
        { plate: "ZH 949 636", reason: "Kontrollschild nicht in der Flotte", fineUrl: "u1" },
        { plate: "ZH 513 925", reason: "Übergabe innerhalb von zwei Stunden", fineUrl: "u2" },
      ],
      "https://www.zuriauto.ch/admin/fines/?tab=review"
    );
    expect(mail.subject).toBe("2 Bussen zu prüfen");
    expect(mail.text).toContain("ZH 949 636");
    expect(mail.text).toContain("u2");
  });
});
