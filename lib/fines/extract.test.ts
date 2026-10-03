import { describe, expect, it } from "vitest";
import { extractFields } from "./extract";
import { detectLanguage } from "./language";
import { parseQrBill, type QrBill } from "./qrBill";
import {
  FUEL_INVOICE,
  KAPO_ZH_OCR,
  PARKPRO_PRIVATE,
  POLICE_TI_MULTA,
  POLICE_VD_RAPPEL,
} from "./__fixtures__/texts";

const KAPO_QR = parseQrBill(
  [
    "SPC", "0200", "1", "CH2430000001800000803", "S", "Kantonspolizei Zürich",
    "Ordnungsbussen", "", "8010", "Zürich", "CH", "", "", "", "", "", "", "",
    "40.00", "CHF", "S", "Rigitrade AG", "Tannenstrasse", "16", "8424",
    "Embrach", "CH", "QRR", "001980919800083055750601742",
    "Ordnungsbusse: 830557506 017 4", "EPD",
  ].join("\n")
) as QrBill;

const PARKPRO_QR: QrBill = {
  iban: "CH4431999123000889012",
  creditorName: "ParkPro AG",
  creditorPostalCode: "8001",
  creditorTown: "Zürich",
  amountCents: 5000,
  currency: "CHF",
  referenceType: "SCOR",
  reference: "RF18539007547034",
  message: "",
  billInfo: "",
};

describe("detectLanguage", () => {
  it("tells the three languages apart", () => {
    expect(detectLanguage(KAPO_ZH_OCR, null)).toBe("de");
    expect(detectLanguage(POLICE_VD_RAPPEL, null)).toBe("fr");
    expect(detectLanguage(POLICE_TI_MULTA, null)).toBe("it");
  });

  it("trusts the QR message's fine word over a short text", () => {
    expect(detectLanguage("ZH 513925 40.00", { ...KAPO_QR, message: "Amende d'ordre 4471" })).toBe("fr");
  });

  it("answers null for nothing", () => {
    expect(detectLanguage("", null)).toBeNull();
  });
});

describe("extractFields — Kantonspolizei Zürich Mahnung (the real OCR)", () => {
  const x = extractFields(KAPO_ZH_OCR, KAPO_QR, "de");

  it("classifies it", () => {
    expect(x.kind).toBe("REMINDER");
    expect(x.issuerKind).toBe("POLICE");
    expect(x.language).toBe("de");
  });

  it("takes money and numbers from the QR slip, exactly", () => {
    expect(x.amountCents).toMatchObject({ value: 4000, status: "CONFIRMED", source: "qr" });
    expect(x.fineNumber).toMatchObject({ value: "830557506 017 4", status: "CONFIRMED", source: "qr" });
    expect(x.paymentReference).toMatchObject({ value: "001980919800083055750601742", status: "CONFIRMED" });
    expect(x.issuerName).toMatchObject({ value: "Kantonspolizei Zürich", status: "CONFIRMED" });
    expect(x.issuerIban.value).toBe("CH2430000001800000803");
  });

  it("keeps the printed total to compare against the slip", () => {
    expect(x.printedAmountCents).toBe(4000);
  });

  it("reads the moment, place and plate under their labels", () => {
    expect(x.violationDate).toMatchObject({ value: "2026-07-02", status: "READ", source: "ocr" });
    expect(x.violationTime).toMatchObject({ value: "10:00", status: "READ" });
    expect(x.location).toMatchObject({ value: "Lufingen, Zürcherstrasse", status: "READ" });
    expect(x.plateText).toMatchObject({ value: "ZH 949636", status: "READ" });
  });

  it("reads the offence, the speeds and the letter's own date", () => {
    expect(x.offenceCode.value).toBe("303.1.a");
    expect(x.offenceText.value).toContain("Höchstgeschwindigkeit");
    expect(x.speedMeasuredKmh.value).toBe(55);
    expect(x.speedLimitKmh.value).toBe(50);
    expect(x.letterDate.value).toBe("2026-09-04");
  });

  it("quotes the line each field came from", () => {
    expect(x.violationDate.snippet).toContain("02.07.2026");
  });
});

describe("extractFields — French reminder, no QR", () => {
  const x = extractFields(POLICE_VD_RAPPEL, null, "fr");

  it("reads it", () => {
    expect(x.kind).toBe("REMINDER");
    expect(x.issuerKind).toBe("POLICE");
    expect(x.fineNumber).toMatchObject({ value: "4471 2093 55", status: "READ" });
    expect(x.plateText.value).toBe("ZH 513925");
    expect(x.violationDate.value).toBe("2026-03-14");
    expect(x.violationTime.value).toBe("08:15");
    expect(x.location.value).toBe("Lausanne, Avenue de Rhodanie");
    expect(x.offenceCode.value).toBe("303.1.a");
    expect(x.speedMeasuredKmh.value).toBe(56);
    expect(x.letterDate.value).toBe("2026-05-12");
  });

  it("reads the printed total when there is no slip, and says it was read", () => {
    expect(x.amountCents).toMatchObject({ value: 4000, status: "READ", source: "ocr" });
    expect(x.paymentReference.status).toBe("MISSING");
  });
});

describe("extractFields — Italian notice", () => {
  const x = extractFields(POLICE_TI_MULTA, null, "it");

  it("reads it", () => {
    expect(x.kind).toBe("NOTICE");
    expect(x.fineNumber.value).toBe("5521 8834 10");
    expect(x.plateText.value).toBe("ZH 401859");
    expect(x.violationDate.value).toBe("2026-08-01");
    expect(x.violationTime.value).toBe("17:40");
    expect(x.location.value).toBe("Lugano, Via Nassa");
    expect(x.dueDate.value).toBe("2026-09-19");
    expect(x.letterDate.value).toBe("2026-08-20");
  });
});

describe("extractFields — private parking charge", () => {
  const x = extractFields(PARKPRO_PRIVATE, PARKPRO_QR, "de");

  it("is a private fine with its moment read from the sentence", () => {
    expect(x.kind).toBe("NOTICE");
    expect(x.issuerKind).toBe("PRIVATE");
    expect(x.fineNumber).toMatchObject({ value: "PP-2026-118734", status: "READ" });
    expect(x.paymentReference.value).toBe("RF18539007547034");
    expect(x.plateText.value).toBe("ZH 513925");
    expect(x.violationDate).toMatchObject({ value: "2026-06-12", status: "READ" });
    expect(x.violationTime.value).toBe("14:32");
    expect(x.dueDate.value).toBe("2026-07-20");
  });
});

describe("extractFields — not a fine", () => {
  it("recognises a fuel invoice as something else", () => {
    expect(extractFields(FUEL_INVOICE, null, "de").kind).toBe("NOT_A_FINE");
  });

  it("calls a blank page unreadable", () => {
    expect(extractFields("  \n ", null, null).kind).toBe("UNREADABLE");
  });
});
