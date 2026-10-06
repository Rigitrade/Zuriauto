import { describe, expect, it, vi } from "vitest";

describe("afterResponse", () => {
  it("hands the task to Next's after() inside a request", async () => {
    const after = vi.fn();
    vi.doMock("next/server", () => ({ after }));
    const { afterResponse } = await import("./schedule");
    const task = async () => undefined;
    expect(afterResponse(task)).toBe(true);
    expect(after).toHaveBeenCalledWith(task);
    vi.doUnmock("next/server");
    vi.resetModules();
  });

  it("does not throw outside a request, and says it did not schedule", async () => {
    vi.doMock("next/server", () => ({
      after: () => {
        throw new Error("`after` was called outside a request scope");
      },
    }));
    const { afterResponse } = await import("./schedule");
    expect(afterResponse(async () => undefined)).toBe(false);
    vi.doUnmock("next/server");
    vi.resetModules();
  });
});
