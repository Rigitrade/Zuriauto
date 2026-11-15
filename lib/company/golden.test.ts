import { describe, expect, it } from "vitest";
import {
  driverNominationMail,
  fineNoticeMail,
  fineReopenedMail,
  fineThanksMail,
  renterNamedMail,
} from "@/lib/fines/mail";
import { availabilityMail } from "@/lib/rental/availability";
import { buildContractPdf } from "@/lib/rental/contractPdf";
import { buildCustomerEmail } from "@/lib/rental/customerEmail";
import { findVehicle } from "@/lib/rental/fleet";
import { labelsFor } from "@/lib/rental/labels";
import {
  chargeCorrectionMail,
  chargeDueMail,
  extensionConfirmedMail,
  mfkNoticeRenterMail,
  rentalEndingMail,
  serviceDueRenterMail,
} from "@/lib/rental/lifecycleMail";
import { buildReturnPdf } from "@/lib/rental/returnPdf";
import { publicCompany, withCompany, ZURIAUTO_IDENTITY } from "./identity";
import { contractDetails, fineCtx, LANGS, pdfText, PNG, returnDetails } from "./__fixtures__/documents";

/**
 * ZURIAUTO's output as it was before multi-company phase B (15.11.2026).
 *
 * Phase B makes every document and mail carry the renting company. For
 * ZURIAUTO nothing may change, so these snapshots were recorded on the code
 * before the change and are NEVER re-recorded: a diff here is a regression,
 * not a snapshot to update.
 */

const ZURIAUTO = publicCompany(ZURIAUTO_IDENTITY);

describe("ZURIAUTO golden output (recorded before phase B)", () => {
  it.each(LANGS)("contract PDF, %s", async (language) => {
    const text = await pdfText(
      await buildContractPdf({
        details: contractDetails,
        vehicle: findVehicle("prius-zh513925")!,
        contractNumber: "ZA-20260822-0002",
        issuedAt: new Date("2026-08-22T10:00:00.000Z"),
        language,
        conditionPhotos: [],
        signaturePng: PNG,
        includeGtcAppendix: false,
        documentsOnFile: { contractNumber: "ZA-20260212-0007", signedAt: "2026-02-12", checkedAt: "2026-08-22" },
        company: ZURIAUTO,
      })
    );
    expect(text).toMatchSnapshot();
  });

  it.each(LANGS)("return PDF, %s", async (language) => {
    const text = await pdfText(
      await buildReturnPdf({
        details: returnDetails,
        vehicle: findVehicle("prius-zh513925")!,
        returnNumber: "ZR-20261018-513925-A1B2",
        issuedAt: new Date("2026-10-18T10:00:00Z"),
        language,
        signaturePng: PNG,
        company: ZURIAUTO,
      })
    );
    expect(text).toMatchSnapshot();
  });

  it.each(LANGS)("customer email, %s", (language) => {
    const L = withCompany(labelsFor(language), ZURIAUTO_IDENTITY);
    expect(
      buildCustomerEmail({
        language,
        customerName: "Anna Meier",
        referenceLabel: L.pdf.contractNumber,
        referenceNumber: "ZA-20260822-0002",
        hello: L.email.customerHello,
        body: L.email.customerBody,
        company: ZURIAUTO_IDENTITY,
      })
    ).toMatchSnapshot();
  });

  it.each(LANGS)("labels naming the company, %s", (language) => {
    const L = withCompany(labelsFor(language), ZURIAUTO_IDENTITY);
    expect({ result: L.result, email: L.email, retResult: L.ret.result, retEmail: L.ret.email }).toMatchSnapshot();
  });

  it.each(LANGS)("lifecycle renter mails, %s", (language) => {
    const base = { firstName: "Anna", carModel: "Toyota Prius", plate: "ZH 513925", language, company: ZURIAUTO_IDENTITY };
    expect({
      ending: rentalEndingMail({ ...base, endAt: new Date("2026-11-20T09:00:00Z"), manageUrl: "https://zuriauto.ch/rental/manage?t=x" }),
      due: chargeDueMail({
        ...base,
        weekNumber: 3,
        amountCents: 45_000,
        paymentUrl: "https://pay.example/x",
        reference: "ZA-3",
        isReminder: false,
        dueDate: new Date("2026-11-16T00:00:00Z"),
      }),
      reminder: chargeDueMail({
        ...base,
        weekNumber: 3,
        amountCents: 45_000,
        paymentUrl: "https://pay.example/x",
        reference: "ZA-3",
        isReminder: true,
      }),
      correction: chargeCorrectionMail({ ...base, weekNumber: 3, amountCents: 45_000, sentAt: new Date("2026-11-10T07:00:00Z") }),
      extension: extensionConfirmedMail({
        ...base,
        weeksAdded: 2,
        newEndAt: new Date("2026-12-04T09:00:00Z"),
        amountCents: 90_000,
        paymentUrl: "https://pay.example/y",
      }),
      mfk: mfkNoticeRenterMail({ ...base, mfkDate: new Date("2026-11-29T00:00:00Z"), daysLeft: 14 }),
      service: serviceDueRenterMail({
        ...base,
        dueKm: 130_000,
        estimatedKmNow: 128_900,
        estimatedDueOn: new Date("2026-11-25T00:00:00Z"),
        overdue: false,
      }),
    }).toMatchSnapshot();
  });

  it.each(LANGS)("availability mail, %s", (language) => {
    expect(
      availabilityMail({ language, available: 2, bookUrl: "https://zuriauto.ch/book", unsubscribeUrl: "https://zuriauto.ch/u/x" })
    ).toMatchSnapshot();
  });

  it.each(LANGS)("fine mails to the renter, %s", (language) => {
    const ctx = fineCtx(language);
    expect({
      notice: fineNoticeMail(ctx),
      reminder: fineNoticeMail({ ...ctx, reminder: true }),
      reopened: fineReopenedMail(ctx),
      thanks: fineThanksMail(ctx),
      named: renterNamedMail({ ...ctx, fineNumber: "B-123456" }),
    }).toMatchSnapshot();
  });

  it("police nomination letter", () => {
    expect(
      driverNominationMail({
        company: ZURIAUTO_IDENTITY,
        fineNumber: "B-123456",
        plate: "ZH 513925",
        violationAt: new Date("2026-10-02T08:00:00Z"),
        timeKnown: true,
        papers: ["Mietvertrag ZA-20260822-0002.pdf"],
        driver: {
          firstName: "Anna",
          lastName: "Meier",
          birthDate: new Date("1990-04-12T00:00:00Z"),
          street: "Bahnhofstrasse 1",
          postalCode: "8001",
          city: "Zürich",
          country: "Switzerland",
          phone: "+41791234567",
          email: "anna@example.ch",
        },
      })
    ).toMatchSnapshot();
  });
});
