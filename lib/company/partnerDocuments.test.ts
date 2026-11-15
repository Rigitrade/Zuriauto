import { describe, expect, it } from "vitest";
import { buildContractPdf } from "@/lib/rental/contractPdf";
import { findVehicle } from "@/lib/rental/fleet";
import { buildReturnPdf } from "@/lib/rental/returnPdf";
import { contractDetails, pdfText, PNG, returnDetails } from "./__fixtures__/documents";
import { identityOf, publicCompany, type CompanyColumns } from "./identity";

/**
 * Multi-company phase B (15.11.2026): a partner's renter signs a document in
 * the partner's name, with "powered by ZURIAUTO" (Ahmed), and no ZURIAUTO
 * identity outside that line. The GTC appendix stays Rigitrade's until
 * phase C, so these documents are built without it.
 */

const NONE: Omit<CompanyColumns, "name"> = {
  brandName: null, legalName: null, street: null, postalCode: null, city: null, uid: null,
  phone: null, officeEmail: null, signerName: null, website: null, signingPlace: null,
  paymentUrl: null, twintUrl: null,
};

export const MEIER = publicCompany(
  identityOf({ ...NONE, name: "Meier Mietwagen GmbH", brandName: "MEIER CARS", city: "Winterthur" }, false)
);

/** Every ZURIAUTO identity string, except the one sanctioned line. */
function zuriautoOutsidePoweredBy(text: string): string[] {
  const rest = text.replaceAll("powered by ZURIAUTO", "");
  return ["ZURIAUTO", "Rigitrade", "Zurich", "Schaffhauserstrasse"].filter((s) => rest.includes(s));
}

describe("a partner's contract PDF", () => {
  it.each(["de", "en"] as const)("names the partner as brand and lessor, %s", async (language) => {
    const text = await pdfText(
      await buildContractPdf({
        details: { ...contractDetails, place: "" },
        vehicle: findVehicle("prius-zh513925")!,
        contractNumber: "ZA-20260822-0002",
        issuedAt: new Date("2026-08-22T10:00:00.000Z"),
        language,
        conditionPhotos: [],
        signaturePng: PNG,
        includeGtcAppendix: false,
        documentsOnFile: { contractNumber: "ZA-20260212-0007", signedAt: "2026-02-12", checkedAt: "2026-08-22" },
        company: MEIER,
      })
    );

    expect(text).toMatch(/^MEIER CARS/m);
    expect(text).toContain("powered by ZURIAUTO");
    expect(text).toContain(`${language === "de" ? "Vermieter" : "Lessor"}: Meier Mietwagen GmbH`);
    expect(text).toMatch(/Winterthur, 22\.08\.2026/);
    expect(zuriautoOutsidePoweredBy(text)).toEqual([]);
  });
});

describe("a partner's return PDF", () => {
  it.each(["de", "en"] as const)("names the partner as brand and lessor, %s", async (language) => {
    const text = await pdfText(
      await buildReturnPdf({
        details: { ...returnDetails, place: "" },
        vehicle: findVehicle("prius-zh513925")!,
        returnNumber: "ZR-20261018-513925-A1B2",
        issuedAt: new Date("2026-10-18T10:00:00Z"),
        language,
        signaturePng: PNG,
        company: MEIER,
      })
    );

    expect(text).toMatch(/^MEIER CARS/m);
    expect(text).toContain("powered by ZURIAUTO");
    expect(text).toContain(`${language === "de" ? "Vermieter" : "Lessor"}: Meier Mietwagen GmbH`);
    expect(text).toMatch(/Winterthur, 18\.10\.2026/);
    expect(zuriautoOutsidePoweredBy(text)).toEqual([]);
  });
});
