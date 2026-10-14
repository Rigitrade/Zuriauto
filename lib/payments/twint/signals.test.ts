import { describe, expect, it } from "vitest";
import { printedPlate, weekOf } from "./signals";

describe("weekOf", () => {
  it.each([
    ["ZH 513 925 W2", 2],
    ["ZH513925 w 12", 12],
    ["Miete Woche 3 ZH 513 925", 3],
    ["ZH 513 925", null],
    ["Auto vermieten", null],
    ["W0", null],
  ])("%s → %s", (message, week) => {
    expect(weekOf(message)).toBe(week);
  });
});

describe("printedPlate", () => {
  it.each([
    ["Auto vermieten\nZH918747", "ZH918747"],
    ["zh.513.925 W2", "zh.513.925"],
    ["Danke!", null],
  ])("%s → %s", (message, plate) => {
    expect(printedPlate(message)).toBe(plate);
  });
});
