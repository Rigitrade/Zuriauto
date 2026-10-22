import { describe, expect, it } from "vitest";
import gtc, { GTC_DATE, GTC_LANGUAGES } from "@/locales/gtc";
import { confirmationLines, formatDateTime } from "./contractPdf";
import { GTC_CONFIRMATIONS } from "./gtcConfirmations";
import { labelsFor } from "./labels";
import type { ContractDetails } from "./schema";

/**
 * The boxes ticked before signing name GTC clauses by number. A number that
 * points at nothing, or at the wrong clause in one translation, would have the
 * renter confirm something the terms do not say — so every reference is checked
 * against every language the renter can read the terms in.
 */
describe("GTC confirmations", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "every confirmation names a clause that exists in the %s terms",
    (language) => {
      const clauses = gtc[language].sections.flatMap((section) =>
        section.blocks.flatMap((block) =>
          block.kind === "clause" ? [block.num] : []
        )
      );
      for (const { ref } of GTC_CONFIRMATIONS) {
        expect(clauses).toContain(ref);
      }
    }
  );

  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "the %s terms are numbered 1 to 18 without gaps",
    (language) => {
      const numbers = gtc[language].sections.map((section) => section.num);
      expect(numbers).toEqual(
        Array.from({ length: 18 }, (_, i) => String(i + 1))
      );
    }
  );

  it("the terms carry the date of the current version", () => {
    expect(GTC_DATE).toBe("22.10.2026");
  });

  // These messages name the clauses in words rather than reading
  // GTC_CONFIRMATIONS, so a renumbering must not leave them pointing at the
  // old ones, as it once left them at "Art. 11".
  it.each(["de", "en"] as const)(
    "the %s messages about the boxes name the clauses they confirm",
    (language) => {
      const L = labelsFor(language);
      for (const message of [L.gtc.locked, L.errors.confirm]) {
        for (const { ref } of GTC_CONFIRMATIONS) {
          expect(message).toContain(ref);
        }
      }
    }
  );
});

describe("confirmationLines", () => {
  const confirmed = {
    truthfulInfoConfirmedAt: "2026-10-06T12:32:00.000Z",
    deceptionNoticeConfirmedAt: "2026-10-06T12:33:00.000Z",
  } as ContractDetails;
  // Same clock as the "accepted at" line above it on the contract.
  const at = (iso: string) => formatDateTime(new Date(iso));

  it("prints one line per confirmation, with its clause and the time ticked", () => {
    expect(confirmationLines(confirmed, "de")).toEqual([
      `Art. 15.1 AGB – Wahrheitsgemässe Angaben: bestätigt am ${at(confirmed.truthfulInfoConfirmedAt)}`,
      `Art. 15.5 AGB – Falsche Angaben und Unterlagen: bestätigt am ${at(confirmed.deceptionNoticeConfirmedAt)}`,
    ]);
  });

  it("speaks the contract's language", () => {
    expect(confirmationLines(confirmed, "en")).toEqual([
      `Art. 15.1 GTC – Truthful information: confirmed on ${at(confirmed.truthfulInfoConfirmedAt)}`,
      `Art. 15.5 GTC – False information and documents: confirmed on ${at(confirmed.deceptionNoticeConfirmedAt)}`,
    ]);
  });
});
