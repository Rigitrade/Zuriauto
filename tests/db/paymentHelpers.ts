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
