import { describe, expect, it } from "vitest";
import gtc, { GTC_LANGUAGES, type GtcLanguage } from "@/locales/gtc";

/**
 * The lessor asked on 07.10.2026 for the deposit's payback period in the terms:
 * within 10 working days (2 weeks) after the rental ends. It is Art. 7.3, under
 * the return of the vehicle, and must say the same in every language the renter
 * can read the terms in.
 */
const WORDS: Record<GtcLanguage, { deposit: RegExp; days: RegExp; weeks: RegExp }> = {
  de: { deposit: /Kaution/, days: /10 Arbeitstagen/, weeks: /2 Wochen/ },
  en: { deposit: /deposit/i, days: /10 working days/, weeks: /2 weeks/ },
  fr: { deposit: /caution/i, days: /10 jours ouvrables/, weeks: /2 semaines/ },
};

describe("GTC deposit payback", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "the %s terms give the payback period in Art. 7.3",
    (language) => {
      const blocks = gtc[language].sections.find((s) => s.num === "7")!.blocks;
      const at = blocks.findIndex(
        (b) => b.kind === "sub" && b.title.startsWith("7.3 ")
      );
      expect(at).toBeGreaterThan(-1);

      const body = blocks[at + 1];
      expect(body.kind).toBe("p");
      const text = body.kind === "p" ? body.text : "";
      const words = WORDS[language];
      expect(text).toMatch(words.deposit);
      expect(text).toMatch(words.days);
      expect(text).toMatch(words.weeks);
    }
  );
});
