import { describe, expect, it } from "vitest";
import gtc, { GTC_LANGUAGES, type GtcBlock, type GtcLanguage } from "@/locales/gtc";

/**
 * The lessor asked on 07.10.2026 for the deposit's payback period in the
 * terms. Since the GTC of 15.10.2026 it is clause 12.4; the owner's request of
 * 16.10.2026 made it five to ten working days, and the GTC of 01.10.2026 (the
 * lessor's revision received on 18.10.2026) words it as no earlier than five
 * and no later than ten working days after the vehicle has been properly
 * returned, under the heading "Frist für die Kautionsrückzahlung". It must say
 * the same in every language the renter can read the terms in.
 */
const WORDS: Record<GtcLanguage, { deposit: RegExp; days: RegExp }> = {
  de: { deposit: /Kaution/, days: /frühestens nach 5 und spätestens innerhalb von 10 Arbeitstagen nach ordnungsgemässer Rückgabe/ },
  en: { deposit: /deposit/i, days: /no earlier than 5 and no later than 10 working days after the vehicle has been properly returned/ },
  fr: { deposit: /caution/i, days: /au plus tôt après 5 et au plus tard dans les 10 jours ouvrables suivant la restitution/ },
};

/** Clause 12.4's text and the paragraphs that continue it. */
function clauseText(language: GtcLanguage, num: string): string | null {
  const blocks: GtcBlock[] = gtc[language].sections.flatMap((section) => section.blocks);
  const at = blocks.findIndex((block) => block.kind === "clause" && block.num === num);
  if (at < 0) return null;
  const parts: string[] = [];
  for (const block of blocks.slice(at)) {
    if (block.kind === "clause" && block.num !== num) break;
    if (block.kind === "clause" || block.kind === "p") parts.push(block.text);
  }
  return parts.join(" ");
}

describe("GTC deposit payback", () => {
  it.each(GTC_LANGUAGES.map((l) => l.code))(
    "the %s terms give the payback period in clause 12.4",
    (language) => {
      const text = clauseText(language, "12.4");
      expect(text).not.toBeNull();

      const words = WORDS[language];
      expect(text).toMatch(words.deposit);
      expect(text).toMatch(words.days);
    }
  );
});
