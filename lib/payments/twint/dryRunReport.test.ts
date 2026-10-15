import { describe, expect, it } from "vitest";
import type { DryRunRow } from "./dryRun";
import { formatDryRun } from "./dryRunReport";
import type { TwintNotification } from "./parse";

const n: TwintNotification = {
  externalId: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
  amountCents: 45_000,
  currency: "CHF",
  paidAt: new Date("2026-06-10T10:00:00Z"),
  storeName: "Zuriauto",
  payerName: "Anna Meier",
  payerEmail: "anna@example.ch",
  payerPhone: "+41791234567",
  message: "ZH 513 925 W2",
};

const labels = new Map([
  ["r-anna", "ZH 513 925 · Anna M. · 01.06.26– · ACTIVE"],
  ["r-ben", "ZH 513 925 · Ben K. · 12.06.26– · ACTIVE"],
]);

const booked: DryRunRow = {
  uid: 7,
  outcome: "booked",
  notification: n,
  decision: { status: "BOOKED", rentalId: "r-anna", chargeId: "c-2", matchedBy: "reference+amount", candidates: ["r-anna"] },
};
const waiting: DryRunRow = {
  uid: 8,
  outcome: "review",
  notification: { ...n, externalId: "second" },
  decision: { status: "NEEDS_REVIEW", reason: "REFERENCE_AMBIGUOUS", rentalId: null, candidates: ["r-anna", "r-ben"] },
};
const otherStore: DryRunRow = {
  uid: 9,
  outcome: "other-store",
  detail: "Velo Huber GmbH",
  subject: "Erfolgreiche Transaktion",
  receivedAt: new Date("2026-06-10T10:01:00Z"),
};

describe("formatDryRun", () => {
  it("never prints who paid, only a masked trace of it", () => {
    const text = formatDryRun([booked], labels);

    expect(text).not.toContain("Anna Meier");
    expect(text).not.toContain("anna@example.ch");
    expect(text).not.toContain("41791234567");
    expect(text).toContain("A*** M***");
  });

  it("names the rental a payment would be booked to, and how it was matched", () => {
    const text = formatDryRun([booked], labels);

    expect(text).toContain("10.06.26, 12:00 · CHF 450.00");
    expect(text).toContain('Nachricht: "ZH 513 925 W2"');
    expect(text).toContain("would BOOK, by reference+amount: ZH 513 925 · Anna M.");
  });

  it("gives the reason a payment would wait and the rentals the office would choose from", () => {
    const text = formatDryRun([waiting], labels);

    expect(text).toContain("would WAIT for the office: REFERENCE_AMBIGUOUS");
    expect(text).toContain("candidate: ZH 513 925 · Anna M.");
    expect(text).toContain("candidate: ZH 513 925 · Ben K.");
  });

  it("shows mail nothing would be booked from, and counts every outcome", () => {
    const text = formatDryRun([booked, waiting, otherStore], labels);

    expect(text).toContain("uid 9 · 10.06.26, 12:01 · OTHER-STORE (Velo Huber GmbH)");
    expect(text).toContain('Would happen: {"booked":1,"review":1,"other-store":1}');
    expect(text).toContain('Why the rest would wait: {"REFERENCE_AMBIGUOUS":1}');
    expect(text).toContain("nothing was stored, booked or sent");
  });
});
