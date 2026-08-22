import { describe, expect, it } from "vitest";
import {
  OFF_ROAD,
  carSlug,
  newCarSchema,
  statusChangeAllowed,
  updateCarSchema,
} from "./cars";

describe("carSlug", () => {
  it("joins the model and the plate", () => {
    expect(carSlug("Toyota Prius Hybrid", "ZH 513 925")).toBe(
      "toyota-prius-hybrid-zh513925"
    );
  });

  it("folds diacritics rather than dropping them", () => {
    // Skoda arrives spelled Škoda. Dropping the letter would give "koda".
    expect(carSlug("Škoda Octavia", "ZH 886 530")).toBe(
      "skoda-octavia-zh886530"
    );
  });

  it("collapses punctuation into single hyphens", () => {
    expect(carSlug("VW  Golf / GTI", "ZH-1234")).toBe("vw-golf-gti-zh1234");
  });

  it("leaves no leading or trailing hyphen", () => {
    const slug = carSlug("  Prius  ", "  ZH 1  ");
    expect(slug).toBe("prius-zh1");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("newCarSchema", () => {
  it("accepts a car without a VIN", () => {
    const parsed = newCarSchema.parse({
      model: "Toyota Prius Hybrid",
      plate: "ZH 513 925",
    });
    expect(parsed.vin).toBeUndefined();
  });

  it("upper-cases and tidies the plate", () => {
    // A plate is printed on the contract, so it is stored the way it is worn.
    const parsed = newCarSchema.parse({
      model: "Toyota Prius",
      plate: "  zh 513   925 ",
    });
    expect(parsed.plate).toBe("ZH 513 925");
  });

  it("rejects an empty model or plate", () => {
    expect(newCarSchema.safeParse({ model: "", plate: "ZH 1" }).success).toBe(
      false
    );
    expect(
      newCarSchema.safeParse({ model: "Prius", plate: "   " }).success
    ).toBe(false);
  });

  it("rejects over-long values", () => {
    expect(
      newCarSchema.safeParse({ model: "x".repeat(101), plate: "ZH 1" }).success
    ).toBe(false);
    expect(
      newCarSchema.safeParse({ model: "Prius", plate: "x".repeat(41) }).success
    ).toBe(false);
  });
});

describe("updateCarSchema", () => {
  it("allows changing one field alone", () => {
    expect(updateCarSchema.parse({ vin: "JTDKB20U" }).vin).toBe("JTDKB20U");
  });

  it("allows the two on-road states", () => {
    expect(updateCarSchema.parse({ status: "available" }).status).toBe(
      "available"
    );
    expect(updateCarSchema.parse({ status: OFF_ROAD }).status).toBe("retired");
  });

  it("refuses to set rented directly", () => {
    // A car becomes rented by a handover and stops being rented by a rental
    // being closed. Neither is a field the office edits.
    expect(updateCarSchema.safeParse({ status: "rented" }).success).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(updateCarSchema.safeParse({}).success).toBe(false);
  });
});

describe("statusChangeAllowed", () => {
  it("lets a car go off the road and come back", () => {
    expect(statusChangeAllowed("available", "retired")).toBe(true);
    expect(statusChangeAllowed("retired", "available")).toBe(true);
  });

  it("never moves a rented car", () => {
    // Freeing a rented car here would leave a rental saying someone is driving
    // it while the picker offers it to the next customer — the double handover
    // persistPickup already refuses to create.
    expect(statusChangeAllowed("rented", "available")).toBe(false);
    expect(statusChangeAllowed("rented", "retired")).toBe(false);
  });

  it("never marks a car rented", () => {
    expect(statusChangeAllowed("available", "rented")).toBe(false);
    expect(statusChangeAllowed("retired", "rented")).toBe(false);
  });

  it("treats a no-op as allowed", () => {
    expect(statusChangeAllowed("available", "available")).toBe(true);
    expect(statusChangeAllowed("retired", "retired")).toBe(true);
  });

  it("refuses the unused maintenance state in both directions", () => {
    // Kept in the enum, deliberately unreachable from the UI: the office asked
    // for one off-road status.
    expect(statusChangeAllowed("available", "maintenance")).toBe(false);
    expect(statusChangeAllowed("maintenance", "available")).toBe(false);
  });
});
