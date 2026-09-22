/**
 * The colours a car may be recorded as.
 *
 * A closed list rather than free text, and the reason is the swatch. The
 * pickup and return pickers show the colour beside the car, because "the white
 * Prius" is how the office and the customer at the kerb both actually refer to
 * a fleet of six identical models — the plate is what the contract needs, not
 * what a person recognises. A swatch means something has to turn the recorded
 * value into a colour to paint, and no code can do that with "Perlmuttweiss".
 *
 * The cost is real and worth stating: a registration document reading
 * "grün-metallic" is recorded here as green, and the finish is lost. That is
 * acceptable because nothing in this system acts on the finish, while several
 * things act on the base colour — and the alternative was a field that renders
 * as a grey box for every car whose papers use a compound word.
 *
 * Shared between `lib/admin` and `lib/rental` rather than living in either:
 * the office types the colour in the admin console and the customer sees it in
 * the pickup wizard, and those two have separate label files that agree only
 * on the language codes.
 *
 * Pure data and pure functions — no React, no Prisma — so the parsing can be
 * exercised directly.
 */

/** The languages both label files carry. */
export type ColourLanguage = "de" | "en";

export interface CarColour {
  /** The stored value. Stable: it is written to the database and must survive
   *  a change of wording in either language. */
  slug: string;
  /**
   * What the swatch is painted with.
   *
   * A CSS colour, chosen to read as the colour named rather than to be a
   * physically accurate paint sample: `silver` and `grey` have to be
   * distinguishable at 12 pixels, which the real difference between them is
   * not. Hex rather than a CSS keyword so the value cannot drift with a
   * browser's idea of "gold".
   */
  swatch: string;
  names: Record<ColourLanguage, string>;
}

/**
 * Ordered as a Swiss registration document tends to list them: the three
 * achromatics that most of a rental fleet is, then the colours.
 *
 * `other` is last and is the escape hatch. Without it the office would pick
 * the nearest wrong colour for a car nobody anticipated, which is worse than
 * a neutral swatch and the word "other" — a wrong swatch is a confident lie
 * about the car somebody is about to be handed.
 */
export const CAR_COLOURS: CarColour[] = [
  { slug: "white", swatch: "#f8fafc", names: { de: "Weiss", en: "White" } },
  { slug: "black", swatch: "#1e293b", names: { de: "Schwarz", en: "Black" } },
  { slug: "silver", swatch: "#cbd5e1", names: { de: "Silber", en: "Silver" } },
  { slug: "grey", swatch: "#78716c", names: { de: "Grau", en: "Grey" } },
  { slug: "blue", swatch: "#2563eb", names: { de: "Blau", en: "Blue" } },
  { slug: "red", swatch: "#dc2626", names: { de: "Rot", en: "Red" } },
  { slug: "green", swatch: "#16a34a", names: { de: "Grün", en: "Green" } },
  { slug: "yellow", swatch: "#facc15", names: { de: "Gelb", en: "Yellow" } },
  { slug: "orange", swatch: "#ea580c", names: { de: "Orange", en: "Orange" } },
  { slug: "brown", swatch: "#78350f", names: { de: "Braun", en: "Brown" } },
  { slug: "beige", swatch: "#d6c7a8", names: { de: "Beige", en: "Beige" } },
  { slug: "gold", swatch: "#b8912f", names: { de: "Gold", en: "Gold" } },
  { slug: "violet", swatch: "#7c3aed", names: { de: "Violett", en: "Violet" } },
  { slug: "other", swatch: "#94a3b8", names: { de: "Andere", en: "Other" } },
];

const BY_SLUG = new Map(CAR_COLOURS.map((colour) => [colour.slug, colour]));

/** Every slug this system will store, for the schema to validate against. */
export const CAR_COLOUR_SLUGS = CAR_COLOURS.map((colour) => colour.slug);

/**
 * The colour a stored value names, or null.
 *
 * Null for the unrecorded case *and* for a value this build does not know,
 * which is the important one: a slug removed from the list above would
 * otherwise render as an empty swatch on every car still carrying it. Null
 * makes the screen fall back to "no colour recorded", which is a state it
 * already handles.
 */
export function carColour(slug: string | null | undefined): CarColour | null {
  if (!slug) return null;
  return BY_SLUG.get(slug) ?? null;
}

/** The colour's name in one language, or null when nothing is recorded. */
export function carColourName(
  slug: string | null | undefined,
  language: ColourLanguage
): string | null {
  return carColour(slug)?.names[language] ?? null;
}

/**
 * Whether a swatch needs a visible outline to be seen at all.
 *
 * White on a white panel is an invisible dot, and a colour chip that shows
 * nothing reads as a missing value rather than as white. Every swatch gets a
 * hairline ring in practice; this marks the ones that would disappear without
 * a stronger one.
 */
export function needsOutline(slug: string | null | undefined): boolean {
  return slug === "white" || slug === "beige" || slug === "silver";
}
