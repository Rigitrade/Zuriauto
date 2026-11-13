import { describe, expect, it } from "vitest";
import gtc, { type GtcDocument } from "@/locales/gtc";

/**
 * The English and French terms are translated here from the lessor's German
 * (see the head of `locales/gtc.ts`). A translation that drops, merges or
 * renumbers a clause would have the renter agree to different terms depending
 * on the language they read, and the contract points at clauses by number.
 * So every language must have the German's articles, clauses, lettered items
 * and table rows, in the German's order, and name the same amounts, periods
 * and references in each clause.
 */

const TRANSLATIONS = ["en", "fr"] as const;

/** "Art. 4", "4.1", "4.2", "4.3", "4.3 a)", … in reading order. */
function outline(doc: GtcDocument): string[] {
  return doc.sections.flatMap((section) => {
    let clause = section.num;
    const parts = section.blocks.flatMap((block) => {
      switch (block.kind) {
        case "clause":
          clause = block.num;
          return [block.num];
        case "lettered":
          return block.items.map((item) => `${clause} ${item.split(" ")[0]}`);
        case "table":
          return block.rows.map((_, i) => `${clause} table row ${i + 1}`);
        default:
          return [];
      }
    });
    return [`Art. ${section.num}`, ...parts];
  });
}

/**
 * Every figure each clause states, with what it was written in — "CHF
 * 100.00", "24", "163 3" for Art. 163 Abs. 3 OR — keyed by clause. Sorted
 * within a clause, since a translation may order a sentence differently.
 */
function figures(doc: GtcDocument): Record<string, string> {
  const texts: Record<string, string[]> = {};
  for (const section of doc.sections) {
    let clause = section.num;
    for (const block of section.blocks) {
      if (block.kind === "clause") clause = block.num;
      const words =
        block.kind === "clause" || block.kind === "p"
          ? [block.text]
          : block.kind === "lettered" || block.kind === "list"
          ? block.items
          : block.kind === "table"
          ? block.rows.flat()
          : [];
      (texts[clause] ??= []).push(...words);
    }
  }
  texts.intro = doc.intro;

  return Object.fromEntries(
    Object.entries(texts).map(([clause, parts]) => [
      clause,
      (parts.join(" ").match(/\d+(?:[.,]\d+)*/g) ?? []).sort().join(" "),
    ])
  );
}

describe("GTC translations", () => {
  it("the German clauses run 1, 2, 3 … within each article", () => {
    for (const section of gtc.de.sections) {
      const numbers = section.blocks.flatMap((block) =>
        block.kind === "clause" ? [block.num] : []
      );
      expect(numbers, `Art. ${section.num}`).toEqual(
        numbers.map((_, i) => `${section.num}.${i + 1}`)
      );
    }
  });

  it.each(TRANSLATIONS)(
    "the %s terms have the German articles, clauses, items and rows, in order",
    (language) => {
      expect(outline(gtc[language]), `${language} against de`).toEqual(
        outline(gtc.de)
      );
    }
  );

  it.each(TRANSLATIONS)(
    "the %s terms state the German figures in each clause",
    (language) => {
      expect(figures(gtc[language]), `${language} against de`).toEqual(
        figures(gtc.de)
      );
    }
  );
});
