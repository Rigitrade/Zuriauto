import { generateKeyPairSync } from "node:crypto";
import { dkimSign } from "mailauth/lib/dkim/sign";
import { describe, expect, it } from "vitest";
import { signedByTwint, verifyTwintSignature, type DkimReport } from "./authentic";

const pass = {
  signingDomain: "twintpay.ch",
  status: { result: "pass" },
  canonBodyLengthLimited: false,
  signingHeaders: { keys: "From: To: Subject: Date" },
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
    expect(signedByTwint(report({ results: [{ ...pass, signingHeaders: { keys: "Subject" } }] }))).toBe(false);
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

describe("verifyTwintSignature — a real signature, end to end", () => {
  // mailauth signs and verifies here as it does on a real email; only DNS is
  // stubbed, answering for TWINT's selector with this test key. The pure
  // tests above fake mailauth's result — this one is what proves the shape.
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const p = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const resolver = async (name: string, type: string) => {
    if (type === "TXT" && name === "selector1._domainkey.twintpay.ch") return [[`v=DKIM1; k=rsa; p=${p}`]];
    throw Object.assign(new Error(`ENOTFOUND ${name}`), { code: "ENOTFOUND" });
  };
  const body = "Hallo Zuriauto\r\nBetrag\r\nCHF 450.00\r\n";
  const headers = (from: string) => `From: ${from}\r\nTo: info@zuriauto.ch\r\nSubject: Zahlung\r\n\r\n`;
  async function signed(from: string): Promise<string> {
    const message = headers(from) + body;
    // mailauth's runtime reads `signatureData` (as its README shows); its
    // .d.ts declares top-level fields instead, and with those it signs
    // nothing. The cast follows the runtime.
    const options = {
      canonicalization: "relaxed/relaxed",
      signatureData: [
        {
          signingDomain: "twintpay.ch",
          selector: "selector1",
          privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        },
      ],
    } as unknown as Parameters<typeof dkimSign>[1];
    const result = await dkimSign(message, options);
    return result.signatures + message;
  }

  it("accepts a message TWINT really signed", async () => {
    expect(await verifyTwintSignature(Buffer.from(await signed("no-reply@twintpay.ch")), { resolver })).toBe(true);
  });

  it("refuses it once a word of the body is changed", async () => {
    const forged = (await signed("no-reply@twintpay.ch")).replace("CHF 450.00", "CHF 4500.00");
    expect(await verifyTwintSignature(Buffer.from(forged), { resolver })).toBe(false);
  });
});
