import { describe, expect, it } from "vitest";
import gtc, { GTC_LANGUAGES, type GtcLanguage } from "@/locales/gtc";

/**
 * The lessor asked on 07.10.2026 for the deposit's payback period in the
 * terms. Since the GTC of 15.10.2026 it is clause 12.4, and since 16.10.2026
 * it gives five to ten working days (the owner's request of that day): unless
 * the rental agreement says otherwise, the deposit is paid back five to ten
 * working days after the vehicle has been properly returned. It must say the
 * same in every language the renter can read the terms in.
 */
const WORDS: Record<GtcLanguage, { deposit: RegExp; days: RegExp }> = {
  de: { deposit: /Kaution/, days: /fünf bis zehn Arbeitstage nach ordnungsgemässer Rückgabe/ },
  en: { deposit: /deposit/i, days: /five to ten working days after the vehicle/ },
  fr: { deposit: /caution/i, days: /cinq à dix jours ouvrables après la restitution/ },
};

describe("GTC deposit payback", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "the %s terms give the payback period in clause 12.4",
    (language) => {
      const clause = gtc[language].sections
        .flatMap((section) => section.blocks)
        .find((block) => block.kind === "clause" && block.num === "12.4");
      expect(clause).toBeDefined();

      const text = clause?.kind === "clause" ? clause.text : "";
      const words = WORDS[language];
      expect(text).toMatch(words.deposit);
      expect(text).toMatch(words.days);
    }
  );
});
