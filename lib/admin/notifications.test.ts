import { describe, expect, it } from "vitest";
import { shouldRefresh, titleWithCount } from "./notifications";

/**
 * The tab title is the one place the count reaches somebody working in another
 * tab, so it has to be right in both directions: a count when there is work,
 * and nothing at all when there is none. A stale "(1)" on a clean console
 * teaches the office to ignore the title, which is the only thing it is for.
 */
describe("titleWithCount", () => {
  it("leaves the title alone when nothing is waiting", () => {
    expect(titleWithCount("Fleet — ZURIAUTO", 0)).toBe("Fleet — ZURIAUTO");
  });

  it("puts the count in front when something is waiting", () => {
    expect(titleWithCount("Fleet — ZURIAUTO", 2)).toBe("(2) Fleet — ZURIAUTO");
  });

  it("replaces an earlier count rather than stacking a second one", () => {
    expect(titleWithCount("(2) Fleet — ZURIAUTO", 3)).toBe("(3) Fleet — ZURIAUTO");
  });

  it("removes the count once the work is done", () => {
    expect(titleWithCount("(1) Fleet — ZURIAUTO", 0)).toBe("Fleet — ZURIAUTO");
  });
});

/**
 * A refetch repaints every section. Firing one while a write is in flight can
 * paint the table from before the write landed, and firing one into a hidden
 * tab spends a request nobody will look at.
 */
describe("shouldRefresh", () => {
  it("refreshes a visible, idle console", () => {
    expect(shouldRefresh({ hidden: false, busy: false })).toBe(true);
  });

  it("waits while the tab is hidden", () => {
    expect(shouldRefresh({ hidden: true, busy: false })).toBe(false);
  });

  it("waits while a save is in flight", () => {
    expect(shouldRefresh({ hidden: false, busy: true })).toBe(false);
  });
});
