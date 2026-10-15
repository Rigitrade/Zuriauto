import { describe, expect, it } from "vitest";
import { SAMPLE_HTML, sampleHtml } from "./__fixtures__/notification";
import { parseAmount, parseNotification, parseTwintDate } from "./parse";

describe("parseNotification", () => {
  it("reads every field of TWINT's email", () => {
    expect(parseNotification(SAMPLE_HTML)).toEqual({
      ok: true,
      notification: {
        externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
        amountCents: 25_000,
        currency: "CHF",
        paidAt: new Date("2026-10-05T08:00:00.000Z"),
        storeName: "Zuriauto",
        payerName: "Anna Meier",
        payerEmail: "anna@example.ch",
        payerPhone: "+41791234567",
        message: "Auto vermieten\nZH 513 925 W2",
      },
    });
  });

  it("leaves an empty Nachricht as null rather than failing", () => {
    const result = parseNotification(sampleHtml({ message: [] }));
    expect(result.ok && result.notification.message).toBeNull();
  });

  it("refuses an email without the TWINT fields", () => {
    expect(parseNotification("<p>Ihre Bestellung ist unterwegs</p>")).toEqual({ ok: false, reason: "NOT_A_PAYMENT" });
  });

  it("names the field it could not read", () => {
    expect(parseNotification(sampleHtml({ date: "gestern" }))).toEqual({
      ok: false,
      reason: "FIELD_UNREADABLE",
      field: "Transaktionsdatum",
    });
  });

  it("decodes HTML entities in the customer's text", () => {
    const result = parseNotification(sampleHtml({ message: ["Miete &amp; Kaution ZH 513 925"] }));
    expect(result.ok && result.notification.message).toBe("Miete & Kaution ZH 513 925");
  });
});

describe("parseAmount", () => {
  it.each([
    ["CHF 250.00", 25_000],
    ["CHF 1'250.00", 125_000],
    ["CHF 1’250.50", 125_050],
    ["CHF 40", 4_000],
  ])("%s → %i cents", (text, cents) => {
    expect(parseAmount(text)).toBe(cents);
  });

  it("refuses zero and non-amounts", () => {
    expect(parseAmount("CHF 0.00")).toBeNull();
    expect(parseAmount("zweihundert")).toBeNull();
  });
});

describe("parseTwintDate", () => {
  it("reads Zurich summer time", () => {
    expect(parseTwintDate("05.07.2026, 10:00")).toEqual(new Date("2026-07-05T08:00:00Z"));
  });

  it("reads Zurich winter time", () => {
    expect(parseTwintDate("05.12.2026, 10:00")).toEqual(new Date("2026-12-05T09:00:00Z"));
  });

  it("refuses a date that does not exist", () => {
    expect(parseTwintDate("31.02.2026, 10:00")).toBeNull();
  });
});

describe("amounts as an HTML email can write them", () => {
  it.each([
    ["CHF 1&rsquo;250.00", 125_000],
    ["CHF 1&#x2019;250.00", 125_000],
    ["CHF 1&#8217;250.00", 125_000],
  ])("reads %s whole, not as CHF 1.00", (amount, cents) => {
    const result = parseNotification(sampleHtml({ amount }));
    expect(result.ok && result.notification.amountCents).toBe(cents);
  });

  it.each(["CHF 1,250.00", "CHF 250.5", "CHF 12'50.00", "CHF 250.00 / 3"])(
    "refuses %s rather than guess",
    (amount) => {
      expect(parseNotification(sampleHtml({ amount }))).toEqual({ ok: false, reason: "FIELD_UNREADABLE", field: "Betrag" });
    }
  );
});
