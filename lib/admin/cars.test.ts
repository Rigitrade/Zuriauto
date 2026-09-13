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

  it("refuses every transition that would fake a handover", () => {
    // `maintenance` used to be refused here as deliberately unreachable — the
    // office had asked for a single off-road status. The MFK pass now sets it
    // by itself when an inspection falls due, so it has to be clearable from
    // the fleet screen too; see the MFK date suite below. What stays refused
    // is anything involving `rented`, which is only ever reached by a handover
    // and only ever left by a rental being closed.
    expect(statusChangeAllowed("available", "rented")).toBe(false);
    expect(statusChangeAllowed("rented", "available")).toBe(false);
    expect(statusChangeAllowed("retired", "rented")).toBe(false);
    expect(statusChangeAllowed("rented", "retired")).toBe(false);
  });
});

describe("MFK date", () => {
  it("accepts a day and a cleared field, but not a non-date", () => {
    expect(updateCarSchema.safeParse({ mfkDate: "2026-07-14" }).success).toBe(true);
    // Empty means "no date recorded", which is a real state: the car simply
    // never triggers a reminder.
    expect(updateCarSchema.safeParse({ mfkDate: "" }).success).toBe(true);
    expect(updateCarSchema.safeParse({ mfkDate: "14.07.2026" }).success).toBe(false);
    expect(updateCarSchema.safeParse({ mfkDate: "2026-13-45" }).success).toBe(false);
  });

  it("lets the office take a car to the garage and bring it back", () => {
    // The MFK pass moves a car to maintenance on its own; without these the
    // office could see the status but never clear it.
    expect(statusChangeAllowed("available", "maintenance")).toBe(true);
    expect(statusChangeAllowed("maintenance", "available")).toBe(true);
    expect(statusChangeAllowed("maintenance", "retired")).toBe(true);
    expect(statusChangeAllowed("maintenance", "maintenance")).toBe(true);
  });

  it("still refuses anything that would fake a handover", () => {
    expect(statusChangeAllowed("maintenance", "rented")).toBe(false);
    expect(statusChangeAllowed("rented", "maintenance")).toBe(false);
  });
});
