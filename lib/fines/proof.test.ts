import { describe, expect, it } from "vitest";
import { verifyProofText } from "./proof";

const FINE = {
  amountCents: 4000,
  paymentReference: "001980919800083055750601742",
  fineNumber: "830557506 017 4",
};

describe("verifyProofText", () => {
  it("accepts a TWINT confirmation naming the amount and the reference", () => {
    const text = `TWINT\nZahlung erfolgreich\nCHF 40.00\nan Kantonspolizei Zürich\nReferenz 00 19809 19800 08305 57506 01742\n04.09.2026 18:22`;
    expect(verifyProofText(text, FINE)).toBe("MATCH");
  });

  it("accepts an e-banking confirmation with a comma and the fine number", () => {
    const text = `Zahlungsauftrag ausgeführt\nBetrag 40,00 CHF\nMitteilung: Ordnungsbusse 830557506 017 4`;
    expect(verifyProofText(text, FINE)).toBe("MATCH");
  });

  it("does not accept the right amount for something else", () => {
    const text = `Zahlung erfolgreich\nCHF 40.00\nan Migros\nReferenz 11 22222 33333 44444 55555 66666`;
    expect(verifyProofText(text, FINE)).toBe("MISMATCH");
  });

  it("does not accept the right reference with another amount", () => {
    const text = `CHF 4.00\nReferenz 00 19809 19800 08305 57506 01742`;
    expect(verifyProofText(text, FINE)).toBe("MISMATCH");
  });

  it("does not read 140.00 as 40.00", () => {
    const text = `CHF 140.00\nReferenz 00 19809 19800 08305 57506 01742`;
    expect(verifyProofText(text, FINE)).toBe("MISMATCH");
  });

  it("reads thousands with an apostrophe", () => {
    const fine = { ...FINE, amountCents: 125050 };
    expect(verifyProofText(`CHF 1'250.50 Referenz 001980919800083055750601742`, fine)).toBe("MATCH");
  });

  it("calls an empty read unreadable", () => {
    expect(verifyProofText("   ", FINE)).toBe("UNREADABLE");
  });
});
