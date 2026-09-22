import { describe, expect, it } from "vitest";
import {
  OFF_ROAD,
  carSlug,
  newCarSchema,
  newRepairSchema,
  resolveDoneOn,
  statusChangeAllowed,
  updateCarSchema,
  updateRepairSchema,
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

describe("colour", () => {
  it("accepts a slug from the list and a cleared field", () => {
    expect(updateCarSchema.safeParse({ colour: "white" }).success).toBe(true);
    // Empty clears it, exactly as it does for a date, and for the same reason:
    // a colour entered by mistake has to be removable.
    expect(updateCarSchema.safeParse({ colour: "" }).success).toBe(true);
  });

  it("refuses free text", () => {
    // The pickers paint a swatch from this value, and nothing can turn
    // "Perlmuttweiss" into a colour. An unrecognised value stored here would
    // render as an empty chip — which reads as "no colour recorded" while the
    // database says otherwise.
    expect(updateCarSchema.safeParse({ colour: "Perlmuttweiss" }).success).toBe(
      false
    );
    expect(updateCarSchema.safeParse({ colour: "WHITE" }).success).toBe(false);
  });

  it("is accepted when a car is added", () => {
    const parsed = newCarSchema.parse({
      model: "Toyota Prius",
      plate: "zh 123 456",
      colour: "silver",
      mfkLastDate: "2026-03-05",
    });
    expect(parsed.colour).toBe("silver");
    expect(parsed.mfkLastDate).toBe("2026-03-05");
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

  it("accepts the previous inspection on the same terms as the next one", () => {
    expect(updateCarSchema.safeParse({ mfkLastDate: "2026-03-05" }).success).toBe(
      true
    );
    expect(updateCarSchema.safeParse({ mfkLastDate: "" }).success).toBe(true);
    expect(
      updateCarSchema.safeParse({ mfkLastDate: "05.03.2026" }).success
    ).toBe(false);
    expect(
      updateCarSchema.safeParse({ mfkLastDate: "2026-02-31" }).success
    ).toBe(false);
  });

  it("does not insist the two dates agree", () => {
    // Deliberately no cross-field rule. A patch carries one field at a time,
    // so a rule comparing them would fire against whatever is already stored
    // and refuse a correction halfway through being made. The dialogs warn
    // instead — the office is holding the certificate and the schema is not.
    expect(
      updateCarSchema.safeParse({
        mfkDate: "2026-01-01",
        mfkLastDate: "2027-01-01",
      }).success
    ).toBe(true);
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

describe("updateCarSchema — the service book", () => {
  it("reads an odometer typed with the separators a Swiss keyboard makes", () => {
    const parsed = updateCarSchema.safeParse({ currentMileageKm: "100'000" });
    expect(parsed.success && parsed.data.currentMileageKm).toBe(100_000);
    // A spreadsheet paste and a phone keypad produce the other two.
    expect(
      updateCarSchema.safeParse({ currentMileageKm: "100.000" }).success &&
        updateCarSchema.parse({ currentMileageKm: "100.000" }).currentMileageKm
    ).toBe(100_000);
    expect(
      updateCarSchema.parse({ currentMileageKm: "100 000" }).currentMileageKm
    ).toBe(100_000);
  });

  it("treats an empty figure as cleared, not as zero", () => {
    // Zero would be a reading, and the service warning would act on it.
    const parsed = updateCarSchema.parse({ serviceDueKm: "" });
    expect(parsed.serviceDueKm).toBeNull();
  });

  it("refuses a reading that is not a whole number of kilometres", () => {
    expect(updateCarSchema.safeParse({ currentMileageKm: "97'0o0" }).success).toBe(
      false
    );
    expect(updateCarSchema.safeParse({ currentMileageKm: -5 }).success).toBe(false);
    expect(updateCarSchema.safeParse({ currentMileageKm: 12.5 }).success).toBe(false);
  });

  it("refuses a figure no car in this fleet could have covered", () => {
    // The case this exists for: a stuck key on the dashboard figure, which
    // would park every service warning permanently out of reach.
    expect(updateCarSchema.safeParse({ serviceDueKm: 9_000_000 }).success).toBe(false);
  });

  it("refuses a service date that does not exist", () => {
    // 2026-13-45 parses in JavaScript by rolling forward into a real day.
    expect(updateCarSchema.safeParse({ serviceDoneOn: "2026-13-45" }).success).toBe(
      false
    );
    expect(updateCarSchema.safeParse({ serviceDoneOn: "2026-02-29" }).success).toBe(
      false
    );
    expect(updateCarSchema.safeParse({ serviceDoneOn: "2026-11-30" }).success).toBe(
      true
    );
  });

  it("still refuses an edit that changes nothing", () => {
    expect(updateCarSchema.safeParse({}).success).toBe(false);
  });
});

describe("newRepairSchema", () => {
  it("defaults to planned, which is what the office is usually entering", () => {
    const parsed = newRepairSchema.parse({ details: "Windschutzscheibe" });
    expect(parsed.status).toBe("planned");
  });

  it("insists on a description — a repair nobody described is not a record", () => {
    expect(newRepairSchema.safeParse({ details: "   " }).success).toBe(false);
  });

  it("reads a cost in francs and stores cents", () => {
    expect(newRepairSchema.parse({ details: "Stossstange", costChf: "1'250.50" }).costChf).toBe(
      125_050
    );
  });

  it("leaves the cost null when the invoice has not arrived", () => {
    // A zero would claim the repair was free.
    expect(newRepairSchema.parse({ details: "Stossstange", costChf: "" }).costChf).toBeNull();
  });

  it("refuses an amount that is not one", () => {
    expect(
      newRepairSchema.safeParse({ details: "Stossstange", costChf: "ca. 300" }).success
    ).toBe(false);
  });
});

describe("updateRepairSchema", () => {
  it("accepts the one-field edit the row's button sends", () => {
    expect(updateRepairSchema.safeParse({ status: "done" }).success).toBe(true);
  });

  it("refuses an edit that changes nothing", () => {
    expect(updateRepairSchema.safeParse({}).success).toBe(false);
  });
});

describe("resolveDoneOn", () => {
  const today = "2026-09-19";

  it("dates a repair that is being marked done", () => {
    // Otherwise a done row with no date is invisible in a history read as a
    // chronology.
    expect(
      resolveDoneOn({ status: "done", currentStatus: "planned", today })
    ).toEqual(new Date("2026-09-19T00:00:00.000Z"));
  });

  it("does not move a date already recorded when nothing changes", () => {
    // Undefined means "leave the column alone" — re-saving a done repair to
    // fix a typo in its description must not re-date it to today.
    expect(
      resolveDoneOn({ status: "done", currentStatus: "done", today })
    ).toBeUndefined();
    expect(resolveDoneOn({ currentStatus: "done", today })).toBeUndefined();
  });

  it("lets the office name the day instead", () => {
    expect(
      resolveDoneOn({
        status: "done",
        currentStatus: "planned",
        doneOn: "2026-09-12",
        today,
      })
    ).toEqual(new Date("2026-09-12T00:00:00.000Z"));
  });

  it("clears the date when a repair goes back to planned", () => {
    // A planned repair still carrying a completion date reads as done to
    // everything that sorts on it.
    expect(
      resolveDoneOn({ status: "planned", currentStatus: "done", today })
    ).toBeNull();
  });

  it("honours an explicit clear even on a repair staying done", () => {
    expect(
      resolveDoneOn({ currentStatus: "done", doneOn: "", today })
    ).toBeNull();
  });
});
