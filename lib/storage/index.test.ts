import { describe, expect, it, vi } from "vitest";

describe("getAssetStore without R2", () => {
  it("hands every module instance the same in-memory store", async () => {
    // A dev server re-evaluates modules on every edit. A store held in a
    // module variable became a new, empty store for whichever route was
    // recompiled — an upload landed in one, the register step read another.
    const first = (await import("./index")).getAssetStore();
    vi.resetModules();
    const second = (await import("./index")).getAssetStore();
    expect(second).toBe(first);
  });
});
