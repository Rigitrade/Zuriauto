import { carColour, needsOutline, type ColourLanguage } from "@/lib/carColour";

/**
 * A car's colour, as a dot.
 *
 * Shared between the admin console and the rental wizards rather than written
 * twice, because the two have to agree: the colour the office picks in the
 * fleet screen is the colour the customer sees beside the car in the pickup
 * form, and two implementations of "paint a dot" is how those quietly come to
 * disagree about what beige looks like.
 *
 * Never colour alone. Every place this is used prints the colour's name next
 * to it or gives it a `title`, for the reason the status chips in the fleet
 * table carry a word: these screens get screenshotted into WhatsApp, about
 * eight percent of men cannot reliably separate the red one from the green
 * one, and a dot on its own is not a label.
 *
 * Renders nothing at all when no colour is recorded. A grey placeholder dot
 * would read as "this car is grey", which is a confident falsehood about a car
 * somebody is about to be handed the keys to.
 */
export function ColourDot({
  colour,
  language,
  className,
}: {
  /** A slug from `lib/carColour.ts`, or null/undefined when none is recorded. */
  colour: string | null | undefined;
  language: ColourLanguage;
  className?: string;
}) {
  const found = carColour(colour);
  if (!found) return null;

  return (
    <span
      // The name as a tooltip, so a dot beside a truncated line still says
      // what it is on hover — and `aria-hidden` is deliberately absent for the
      // same reason.
      title={found.names[language]}
      role="img"
      aria-label={found.names[language]}
      style={{ backgroundColor: found.swatch }}
      className={`inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ${
        // White, beige and silver vanish against a light panel, and a swatch
        // showing nothing reads as a missing value rather than as white.
        needsOutline(found.slug) ? "ring-slate-400/70" : "ring-black/15"
      } ${className ?? ""}`}
    />
  );
}
