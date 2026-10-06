import { describe, expect, it } from "vitest";
import { parseQrBill, pickQrBill } from "./qrBill";

/** Decoded from Ahmed's sample on 2026-10-03, verbatim. */
const KAPO_ZH = [
  "SPC",
  "0200",
  "1",
  "CH2430000001800000803",
  "S",
  "Kantonspolizei Zürich",
  "Ordnungsbussen",
  "",
  "8010",
  "Zürich",
  "CH",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "40.00",
  "CHF",
  "S",
  "Rigitrade AG",
  "Tannenstrasse",
  "16",
  "8424",
  "Embrach",
  "CH",
  "QRR",
  "001980919800083055750601742",
  "Ordnungsbusse: 830557506 017 4",
  "EPD",
].join("\n");

describe("parseQrBill", () => {
  it("reads the Kantonspolizei slip", () => {
    expect(parseQrBill(KAPO_ZH)).toEqual({
      iban: "CH2430000001800000803",
      creditorName: "Kantonspolizei Zürich",
      creditorPostalCode: "8010",
      creditorTown: "Zürich",
      amountCents: 4000,
      currency: "CHF",
      referenceType: "QRR",
      reference: "001980919800083055750601742",
      message: "Ordnungsbusse: 830557506 017 4",
      billInfo: "",
    });
  });

  it("reads CRLF line endings the same way", () => {
    expect(parseQrBill(KAPO_ZH.replace(/\n/g, "\r\n"))?.amountCents).toBe(4000);
  });

  it("leaves an open amount open", () => {
    const lines = KAPO_ZH.split("\n");
    lines[18] = "";
    expect(parseQrBill(lines.join("\n"))?.amountCents).toBeNull();
  });

  it("keeps amounts exact in cents", () => {
    const lines = KAPO_ZH.split("\n");
    lines[18] = "1234.05";
    expect(parseQrBill(lines.join("\n"))?.amountCents).toBe(123405);
    lines[18] = "120";
    expect(parseQrBill(lines.join("\n"))?.amountCents).toBe(12000);
  });

  it("keeps a creditor reference as printed", () => {
    const lines = KAPO_ZH.split("\n");
    lines[27] = "SCOR";
    lines[28] = "RF18539007547034";
    const bill = parseQrBill(lines.join("\n"));
    expect(bill?.referenceType).toBe("SCOR");
    expect(bill?.reference).toBe("RF18539007547034");
  });

  it("reads the bill information line after EPD", () => {
    const bill = parseQrBill(`${KAPO_ZH}\n//S1/10/10201409/11/200701`);
    expect(bill?.billInfo).toBe("//S1/10/10201409/11/200701");
  });

  it("refuses anything that is not a QR-bill", () => {
    expect(parseQrBill("https://bussen.kapo.zh.ch")).toBeNull();
    expect(parseQrBill(KAPO_ZH.replace("EPD", "XXX"))).toBeNull();
    expect(parseQrBill(KAPO_ZH.split("\n").slice(0, 20).join("\n"))).toBeNull();
    const lines = KAPO_ZH.split("\n");
    lines[18] = "forty";
    expect(parseQrBill(lines.join("\n"))).toBeNull();
  });
});

describe("pickQrBill", () => {
  it("picks the payment slip among a letter's codes", () => {
    const bill = pickQrBill(["https://bussen.kapo.zh.ch", "E-8 portal", KAPO_ZH]);
    expect(bill?.reference).toBe("001980919800083055750601742");
  });

  it("answers null when no code is a QR-bill", () => {
    expect(pickQrBill(["https://example.ch"])).toBeNull();
    expect(pickQrBill([])).toBeNull();
  });
});
