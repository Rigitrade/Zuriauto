import { describe, expect, it } from "vitest";
import gtc, { GTC_DATE, GTC_LANGUAGES } from "@/locales/gtc";
import { confirmationLines, formatDateTime } from "./contractPdf";
import { GTC_CONFIRMATIONS } from "./gtcConfirmations";
import type { ContractDetails } from "./schema";

/**
 * The boxes ticked before signing name GTC articles by number. A number that
 * points at nothing, or at the wrong article in one translation, would have the
 * renter confirm something the terms do not say — so every reference is checked
 * against every language the renter can read the terms in.
 */
describe("GTC confirmations", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "every confirmation names a sub-article that exists in the %s terms",
    (language) => {
      const headings = gtc[language].sections.flatMap((section) =>
        section.blocks.flatMap((block) =>
          block.kind === "sub" ? [block.title.split(" ")[0]] : []
        )
      );
      for (const { ref } of GTC_CONFIRMATIONS) {
        expect(headings).toContain(ref);
      }
    }
  );

  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "the %s terms are numbered 1 to 12 without gaps",
    (language) => {
      const numbers = gtc[language].sections.map((section) => section.num);
      expect(numbers).toEqual(
        Array.from({ length: 12 }, (_, i) => String(i + 1))
      );
    }
  );

  it("the terms carry the date of the current version", () => {
    expect(GTC_DATE).toBe("08.10.2026");
  });
});

describe("confirmationLines", () => {
  const confirmed = {
    truthfulInfoConfirmedAt: "2026-10-06T12:32:00.000Z",
    deceptionNoticeConfirmedAt: "2026-10-06T12:33:00.000Z",
  } as ContractDetails;
  // Same clock as the "accepted at" line above it on the contract.
  const at = (iso: string) => formatDateTime(new Date(iso));

  it("prints one line per confirmation, with its article and the time ticked", () => {
    expect(confirmationLines(confirmed, "de")).toEqual([
      `Art. 11.1 AGB – Wahrheitsgemässe Angaben: bestätigt am ${at(confirmed.truthfulInfoConfirmedAt)}`,
      `Art. 11.2 AGB – Täuschung und Haftung: bestätigt am ${at(confirmed.deceptionNoticeConfirmedAt)}`,
    ]);
  });

  it("speaks the contract's language", () => {
    expect(confirmationLines(confirmed, "en")).toEqual([
      `Art. 11.1 GTC – Truthful information: confirmed on ${at(confirmed.truthfulInfoConfirmedAt)}`,
      `Art. 11.2 GTC – Deception and liability: confirmed on ${at(confirmed.deceptionNoticeConfirmedAt)}`,
    ]);
  });
});
