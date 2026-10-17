import { describe, expect, it } from "vitest";
import { moveItem } from "./reorder";

describe("moveItem", () => {
  const cars = ["a", "b", "c", "d"];

  it("moves a car down the list", () => {
    expect(moveItem(cars, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a car up the list", () => {
    expect(moveItem(cars, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves the list as it was for a move onto itself or off either end", () => {
    expect(moveItem(cars, 1, 1)).toEqual(cars);
    expect(moveItem(cars, 0, -1)).toEqual(cars);
    expect(moveItem(cars, 3, 4)).toEqual(cars);
  });

  it("never changes the list it was given", () => {
    const before = [...cars];
    moveItem(cars, 0, 3);
    expect(cars).toEqual(before);
  });
});
