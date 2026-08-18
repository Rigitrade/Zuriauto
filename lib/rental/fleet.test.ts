import { describe, expect, it } from "vitest";
import {
  FUEL_LEVELS,
  dbToFuelLevel,
  fuelLevelToDb,
  fuelLevelToFraction,
} from "./fleet";

describe("fuel level storage mapping", () => {
  it("maps every displayed level to a database value", () => {
    expect(FUEL_LEVELS.map(fuelLevelToDb)).toEqual([
      "empty",
      "quarter",
      "half",
      "three_quarter",
      "full",
    ]);
  });

  it("round-trips every level without loss", () => {
    for (const level of FUEL_LEVELS) {
      expect(dbToFuelLevel(fuelLevelToDb(level))).toBe(level);
    }
  });

  it("leaves the printed fraction untouched", () => {
    // The contract keeps printing fractions; only storage differs.
    expect(fuelLevelToFraction("empty")).toBe("0/4");
    expect(fuelLevelToFraction("3/4")).toBe("3/4");
    expect(fuelLevelToFraction("full")).toBe("4/4");
  });
});
