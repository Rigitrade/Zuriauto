import { describe, expect, it } from "vitest";
import {
  CAR_COLOURS,
  CAR_COLOUR_SLUGS,
  carColour,
  carColourName,
  needsOutline,
} from "./carColour";

describe("the colour list", () => {
  it("has a unique, stable slug for every entry", () => {
    // The slug is written to the database. A duplicate would make two entries
    // indistinguishable once stored, and the second would be unreachable.
    expect(new Set(CAR_COLOUR_SLUGS).size).toBe(CAR_COLOURS.length);
  });

  it("names every colour in both languages the label files carry", () => {
    for (const colour of CAR_COLOURS) {
      expect(colour.names.de.length).toBeGreaterThan(0);
      expect(colour.names.en.length).toBeGreaterThan(0);
    }
  });

  it("gives every colour a hex swatch rather than a CSS keyword", () => {
    // A keyword leaves it to the browser to decide what "gold" is, and two
    // browsers showing a fleet's colours differently is the thing the closed
    // list was chosen to avoid.
    for (const colour of CAR_COLOURS) {
      expect(colour.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("offers a way out for a colour nobody anticipated", () => {
    // Without it the office picks the nearest wrong colour, and a wrong swatch
    // is a confident lie about the car somebody is being handed.
    expect(CAR_COLOUR_SLUGS).toContain("other");
  });
});

describe("carColour", () => {
  it("finds a recorded colour", () => {
    expect(carColour("white")?.names.en).toBe("White");
  });

  it("treats nothing recorded as no colour", () => {
    expect(carColour(null)).toBeNull();
    expect(carColour(undefined)).toBeNull();
    expect(carColour("")).toBeNull();
  });

  it("treats a slug this build does not know as no colour", () => {
    // The case that matters: a slug retired from the list would otherwise
    // render as an empty swatch on every car still carrying it. Null makes the
    // screen fall back to "no colour recorded", which it already handles.
    expect(carColour("puce")).toBeNull();
  });
});

describe("carColourName", () => {
  it("answers in the language asked for", () => {
    expect(carColourName("green", "de")).toBe("Grün");
    expect(carColourName("green", "en")).toBe("Green");
  });

  it("answers null rather than a placeholder when nothing is recorded", () => {
    // The caller decides what a gap looks like. A string here would end up
    // printed as a colour.
    expect(carColourName(null, "de")).toBeNull();
  });
});

describe("needsOutline", () => {
  it("marks the colours that vanish against a light panel", () => {
    expect(needsOutline("white")).toBe(true);
    expect(needsOutline("beige")).toBe(true);
    expect(needsOutline("silver")).toBe(true);
  });

  it("leaves the rest alone", () => {
    expect(needsOutline("black")).toBe(false);
    expect(needsOutline("red")).toBe(false);
    expect(needsOutline(null)).toBe(false);
  });
});
