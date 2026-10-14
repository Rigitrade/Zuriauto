import { describe, expect, it } from "vitest";
import { signedByTwint, verifyTwintSignature, type DkimReport } from "./authentic";

const pass = {
  signingDomain: "twintpay.ch",
  status: { result: "pass" },
  canonBodyLengthLimited: false,
  signingHeaders: { keys: ["From", "To", "Subject", "Date"] },
};
const report = (overrides: Partial<DkimReport> = {}): DkimReport => ({
  headerFrom: ["no-reply@twintpay.ch"],
  results: [pass],
  ...overrides,
});

describe("signedByTwint", () => {
  it("accepts TWINT's own passing signature over From", () => {
    expect(signedByTwint(report())).toBe(true);
  });

  it("refuses a signature by another domain", () => {
    expect(signedByTwint(report({ results: [{ ...pass, signingDomain: "twintpay.ch.example.com" }] }))).toBe(false);
  });

  it("refuses a signature that did not verify", () => {
    expect(signedByTwint(report({ results: [{ ...pass, status: { result: "fail" } }] }))).toBe(false);
  });

  it("refuses a signature with a body-length limit, which lets text be appended", () => {
    expect(signedByTwint(report({ results: [{ ...pass, canonBodyLengthLimited: true }] }))).toBe(false);
  });

  it("refuses a signature that does not cover From", () => {
    expect(signedByTwint(report({ results: [{ ...pass, signingHeaders: { keys: ["Subject"] } }] }))).toBe(false);
  });

  it("refuses another sender, even signed", () => {
    expect(signedByTwint(report({ headerFrom: ["billing@twintpay.ch"] }))).toBe(false);
    expect(signedByTwint(report({ headerFrom: ["no-reply@twintpay.ch", "x@evil.example"] }))).toBe(false);
  });
});

describe("verifyTwintSignature", () => {
  it("refuses an unsigned message that only looks like TWINT's", async () => {
    const forged = Buffer.from(
      "From: no-reply@twintpay.ch\r\nTo: info@zuriauto.ch\r\nSubject: Zahlung\r\n\r\n<b>Betrag</b><br>CHF 2000.00\r\n"
    );
    expect(await verifyTwintSignature(forged)).toBe(false);
  });
});
