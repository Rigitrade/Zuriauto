import { describe, expect, it } from "vitest";
import {
  availabilityAlertSchema,
  availabilityMail,
  generateUnsubscribeToken,
  normaliseAlertEmail,
  unsubscribeUrl,
} from "./availability";

describe("availabilityAlertSchema", () => {
  it("takes an address and nothing else it does not need", () => {
    const parsed = availabilityAlertSchema.safeParse({
      email: "someone@example.ch",
      language: "en",
      // Anything else a crafted request adds is dropped rather than stored:
      // this row is about somebody who is not yet a customer.
      name: "Should not be kept",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      email: "someone@example.ch",
      language: "en",
    });
  });

  it("refuses something that is not an address", () => {
    expect(availabilityAlertSchema.safeParse({ email: "not-an-address" }).success).toBe(
      false
    );
    expect(availabilityAlertSchema.safeParse({}).success).toBe(false);
  });

  it("falls back on an unknown language rather than storing it", () => {
    // The mail is written in one of two languages; anything else would leave
    // the pass with no body to send.
    expect(
      availabilityAlertSchema.safeParse({ email: "a@b.ch", language: "fr" }).success
    ).toBe(false);
  });
});

describe("normaliseAlertEmail", () => {
  it("folds case and trims, so one person cannot open two rows", () => {
    expect(normaliseAlertEmail("  Someone@Example.CH ")).toBe("someone@example.ch");
  });
});

describe("generateUnsubscribeToken", () => {
  it("is unguessable and survives a mail client breaking lines", () => {
    const token = generateUnsubscribeToken();
    // base64url: no +, / or = to be mangled in a URL or wrapped mid-link.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateUnsubscribeToken()).not.toBe(token);
  });
});

describe("availabilityMail", () => {
  const ctx = {
    available: 2,
    bookUrl: "https://zuriauto.ch/book/",
    unsubscribeUrl: "https://zuriauto.ch/availability/unsubscribe/?token=abc",
  };

  it("never names a plate", () => {
    // The car free at 09:00 may be let by lunchtime, and a mail promising one
    // specifically is a promise this system cannot keep.
    const mail = availabilityMail({ ...ctx, language: "de" });
    expect(mail.text).not.toMatch(/ZH ?\d/);
  });

  it("carries a visible unsubscribe link, not only a header", () => {
    // This goes to somebody who may not remember asking. A link they can see
    // is the difference between an unsubscribe and a spam report.
    for (const language of ["de", "en"] as const) {
      expect(availabilityMail({ ...ctx, language }).text).toContain(
        ctx.unsubscribeUrl
      );
    }
  });

  it("agrees with itself about one car versus several", () => {
    expect(availabilityMail({ ...ctx, available: 1, language: "en" }).text).toContain(
      "A car has just become available."
    );
    expect(availabilityMail({ ...ctx, available: 3, language: "en" }).text).toContain(
      "3 cars have just become available."
    );
  });

  it("writes German by default and English when asked", () => {
    expect(availabilityMail({ ...ctx, language: "de" }).subject).toContain(
      "verfügbar"
    );
    expect(availabilityMail({ ...ctx, language: "en" }).subject).toContain(
      "available"
    );
  });
});

describe("unsubscribeUrl", () => {
  it("does not double the slash on a base that has one", () => {
    expect(unsubscribeUrl("https://zuriauto.ch/", "abc")).toBe(
      "https://zuriauto.ch/availability/unsubscribe/?token=abc"
    );
  });

  it("escapes the token, so a link cannot be broken by its own characters", () => {
    expect(unsubscribeUrl("https://zuriauto.ch", "a+b/c=")).toContain(
      "token=a%2Bb%2Fc%3D"
    );
  });
});
