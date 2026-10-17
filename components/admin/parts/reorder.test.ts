import { describe, expect, it } from "vitest";
import { dropIndex, inDraftOrder, moveItem, sameOrder } from "./reorder";

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

describe("dropIndex", () => {
  // Four rows 40px high, so their middles are at 20, 60, 100 and 140.
  const rows = ["a", "b", "c", "d"].map((id, i) => ({ id, mid: 20 + i * 40 }));

  it("puts a car dragged just past the next row's middle one place down, not two", () => {
    expect(dropIndex(rows, "a", 61)).toBe(1);
    expect(moveItem(["a", "b", "c", "d"], 0, dropIndex(rows, "a", 61))).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("puts a car dragged just above the row before's middle one place up", () => {
    expect(dropIndex(rows, "d", 99)).toBe(2);
  });

  it("keeps a car where it is until the pointer crosses a neighbour's middle", () => {
    expect(dropIndex(rows, "b", 45)).toBe(1);
    expect(dropIndex(rows, "b", 95)).toBe(1);
  });

  it("goes to either end when the pointer is beyond the list", () => {
    expect(dropIndex(rows, "c", -500)).toBe(0);
    expect(dropIndex(rows, "a", 5000)).toBe(3);
  });
});

describe("inDraftOrder", () => {
  const server = [
    { id: "a", km: 1 },
    { id: "b", km: 2 },
    { id: "c", km: 3 },
  ];

  it("is the server's order when nothing is being moved", () => {
    expect(inDraftOrder(server, null)).toEqual(server);
  });

  it("keeps the order being dragged when the page refreshes its figures", () => {
    // The fault of 17.10.2026: the minute's refresh put every car back.
    const refreshed = server.map((car) => ({ ...car, km: car.km + 100 }));
    expect(inDraftOrder(refreshed, ["c", "a", "b"])).toEqual([
      { id: "c", km: 103 },
      { id: "a", km: 101 },
      { id: "b", km: 102 },
    ]);
  });

  it("adds a car that appeared meanwhile at the end, and drops one that went", () => {
    const now = [server[0], server[2], { id: "new", km: 0 }];
    expect(inDraftOrder(now, ["c", "b", "a"]).map((car) => car.id)).toEqual([
      "c",
      "a",
      "new",
    ]);
  });
});

describe("sameOrder", () => {
  it("tells an unchanged order from a moved one", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
  });
});
