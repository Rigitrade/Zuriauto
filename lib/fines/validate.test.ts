import { describe, expect, it } from "vitest";
import { extractFields } from "./extract";
import { parseQrBill } from "./qrBill";
import { requiredFieldsProblem, validateExtraction } from "./validate";
import { KAPO_ZH_OCR } from "./__fixtures__/texts";
import type { Extraction } from "./types";

const NOW = new Date("2026-10-03T12:00:00Z");

const QR = parseQrBill(
  [
    "SPC", "0200", "1", "CH2430000001800000803", "S", "Kantonspolizei Zürich",
    "Ordnungsbussen", "", "8010", "Zürich", "CH", "", "", "", "", "", "", "",
    "40.00", "CHF", "S", "Rigitrade AG", "Tannenstrasse", "16", "8424",
    "Embrach", "CH", "QRR", "001980919800083055750601742",
    "Ordnungsbusse: 830557506 017 4", "EPD",
  ].join("\n")
);

function sample(): Extraction {
  return extractFields(KAPO_ZH_OCR, QR, "de");
}

function withDate(date: string): Extraction {
  const x = sample();
  return { ...x, violationDate: { ...x.violationDate, value: date } };
}

describe("validateExtraction", () => {
  it("passes Ahmed's sample untouched", () => {
    const x = validateExtraction(sample(), { now: NOW });
    expect(x.violationDate.status).toBe("READ");
    expect(x.checks.every((check) => check.passed)).toBe(true);
  });

  it("doubts a moment in the future — the misread 2028", () => {
    const x = validateExtraction(withDate("2028-07-02"), { now: NOW });
    expect(x.violationDate.status).toBe("DOUBTFUL");
    expect(x.checks.find((c) => c.name === "violation-not-in-future")?.passed).toBe(false);
  });

  it("doubts a moment after the letter was written", () => {
    const x = validateExtraction(withDate("2026-09-10"), { now: NOW });
    expect(x.violationDate.status).toBe("DOUBTFUL");
  });

  it("doubts a moment more than two years before the letter", () => {
    const x = validateExtraction(withDate("2024-07-01"), { now: NOW });
    expect(x.violationDate.status).toBe("DOUBTFUL");
  });

  it("doubts an amount out of range", () => {
    for (const cents of [0, 1_000_000]) {
      const base = sample();
      const x = validateExtraction(
        { ...base, amountCents: { ...base.amountCents, value: cents }, printedAmountCents: null },
        { now: NOW }
      );
      expect(x.amountCents.status).toBe("DOUBTFUL");
    }
  });

  it("doubts an OCR value whose words the recogniser was unsure of", () => {
    const x = validateExtraction(sample(), {
      now: NOW,
      wordConfidence: (value) => (value.includes("949636") ? 41 : 90),
    });
    expect(x.plateText.status).toBe("DOUBTFUL");
    expect(x.violationDate.status).toBe("READ");
  });
});

describe("requiredFieldsProblem", () => {
  it("lets the sample through once the plate is ours", () => {
    expect(requiredFieldsProblem(validateExtraction(sample(), { now: NOW }), "CONFIRMED")).toBeNull();
  });

  it("stops a printed total that disagrees with the slip", () => {
    const x = validateExtraction({ ...sample(), printedAmountCents: 4500 }, { now: NOW });
    expect(requiredFieldsProblem(x, "CONFIRMED")).toBe("QR_DISAGREES");
  });

  it("stops a letter with no way to tell this fine from another", () => {
    const base = sample();
    const x = {
      ...base,
      fineNumber: { value: null, status: "MISSING" as const, source: null, snippet: null },
      paymentReference: { value: null, status: "MISSING" as const, source: null, snippet: null },
    };
    expect(requiredFieldsProblem(validateExtraction(x, { now: NOW }), "CONFIRMED")).toBe("FIELDS_MISSING");
  });

  it("stops a letter without a moment", () => {
    const base = sample();
    const x = { ...base, violationDate: { value: null, status: "MISSING" as const, source: null, snippet: null } };
    expect(requiredFieldsProblem(validateExtraction(x, { now: NOW }), "CONFIRMED")).toBe("FIELDS_MISSING");
  });

  it("stops a guessed plate and a misread year", () => {
    expect(requiredFieldsProblem(validateExtraction(sample(), { now: NOW }), "DOUBTFUL")).toBe("FIELDS_DOUBTFUL");
    expect(
      requiredFieldsProblem(validateExtraction(withDate("2028-07-02"), { now: NOW }), "CONFIRMED")
    ).toBe("FIELDS_DOUBTFUL");
  });

  it("hands over what is not a fine", () => {
    expect(requiredFieldsProblem({ ...sample(), kind: "NOT_A_FINE" }, "CONFIRMED")).toBe("NOT_A_FINE");
    expect(requiredFieldsProblem({ ...sample(), kind: "UNREADABLE" }, "MISSING")).toBe("FIELDS_MISSING");
  });
});

describe("validateExtraction — legibility is judged on the value, not its line", () => {
  it("does not doubt a clean value because of garbage elsewhere on its line", () => {
    // The OCR read Ahmed's green marker box as "[", "Und" and friends, with
    // confidence 0. The place and the time themselves read cleanly.
    const confidence = (raw: string) => (/Und|\[/.test(raw) ? 0 : 92);
    const x = validateExtraction(sample(), { now: NOW, wordConfidence: confidence });
    expect(x.location.status).toBe("READ");
    expect(x.violationTime.status).toBe("READ");
  });

  it("still doubts the value's own illegible words", () => {
    const confidence = (raw: string) => (raw.includes("Lufingen") ? 12 : 92);
    const x = validateExtraction(sample(), { now: NOW, wordConfidence: confidence });
    expect(x.location.status).toBe("DOUBTFUL");
  });
});
