import { sampleHtml, type SampleFields } from "@/lib/payments/twint/__fixtures__/notification";
import type { RawMail } from "@/lib/payments/twint/ingest";
import type { TwintNotification } from "@/lib/payments/twint/parse";

/** A parsed notification for Anna's rental of ZH 513 925 (fineHelpers' default car). */
export function notification(overrides: Partial<TwintNotification> = {}): TwintNotification {
  return {
    externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
    amountCents: 45_000,
    currency: "CHF",
    paidAt: new Date("2026-06-10T10:00:00Z"),
    storeName: "Zuriauto",
    payerName: "Anna Meier",
    payerEmail: "anna@example.ch",
    payerPhone: "+41791234567",
    message: "ZH 513 925 W2",
    ...overrides,
  };
}

/** A whole RFC 822 message around the fixture HTML. Unsigned: tests inject
 *  `verify`, and the signature itself is Task 3's business. */
export function rawMail(fields: Partial<SampleFields> = {}, uid = 1): RawMail {
  const html = sampleHtml({ amount: "CHF 450.00", date: "10.06.2026, 12:00", ...fields });
  const source = [
    "From: no-reply@twintpay.ch",
    `Message-ID: <twint-${uid}@twintpay.ch>`,
    "To: info@zuriauto.ch",
    "Subject: Erfolgreiche Transaktion",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");
  return { uid, source: Buffer.from(source) };
}
