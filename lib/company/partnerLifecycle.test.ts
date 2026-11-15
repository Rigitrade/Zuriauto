import { describe, expect, it } from "vitest";
import {
  chargeCorrectionMail,
  chargeDueMail,
  extensionConfirmedMail,
  mfkNoticeRenterMail,
  rentalEndingMail,
  serviceDueRenterMail,
} from "@/lib/rental/lifecycleMail";
import { identityOf, type CompanyColumns } from "./identity";

/**
 * Multi-company phase B (15.11.2026): the reminders a partner's renter
 * receives close with the partner's name and "powered by ZURIAUTO", and never
 * point at ZURIAUTO's payment page.
 */

const NONE: Omit<CompanyColumns, "name"> = {
  brandName: null, legalName: null, street: null, postalCode: null, city: null, uid: null,
  phone: null, officeEmail: null, signerName: null, website: null, signingPlace: null,
  paymentUrl: null, twintUrl: null,
};
const company = identityOf({ ...NONE, name: "Meier Mietwagen GmbH", brandName: "MEIER CARS" }, false);

function mails(language: "de" | "en") {
  const base = { firstName: "Anna", carModel: "Toyota Prius", plate: "ZH 513925", language, company };
  return {
    ending: rentalEndingMail({ ...base, endAt: new Date("2026-11-20T09:00:00Z"), manageUrl: "https://x/m" }),
    due: chargeDueMail({ ...base, weekNumber: 3, amountCents: 45_000, paymentUrl: null, reference: "R", isReminder: false }),
    correction: chargeCorrectionMail({ ...base, weekNumber: 3, amountCents: 45_000, sentAt: new Date("2026-11-10T07:00:00Z") }),
    extension: extensionConfirmedMail({
      ...base, weeksAdded: 2, newEndAt: new Date("2026-12-04T09:00:00Z"), amountCents: 90_000, paymentUrl: null,
    }),
    mfk: mfkNoticeRenterMail({ ...base, mfkDate: new Date("2026-11-29T00:00:00Z"), daysLeft: 14 }),
    service: serviceDueRenterMail({
      ...base, dueKm: 130_000, estimatedKmNow: 128_900, estimatedDueOn: new Date("2026-11-25T00:00:00Z"), overdue: false,
    }),
  };
}

describe("a partner's reminder mails", () => {
  it.each(["de", "en"] as const)("close with the partner and powered by ZURIAUTO, %s", (language) => {
    for (const [name, mail] of Object.entries(mails(language))) {
      expect(mail.text, name).toMatch(/\nMEIER CARS\npowered by ZURIAUTO$/);
      expect(mail.text.replaceAll("powered by ZURIAUTO", ""), name).not.toContain("ZURIAUTO");
      expect(mail.subject, name).not.toContain("ZURIAUTO");
    }
  });

  it.each(["de", "en"] as const)("leave out the payment page when the partner has none, %s", (language) => {
    const { due, extension } = mails(language);
    for (const mail of [due, extension]) {
      expect(mail.text).not.toMatch(/https?:/);
      expect(mail.text).not.toMatch(/payment page|Zahlungsseite/);
    }
  });
});
