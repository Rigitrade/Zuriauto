import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory";

describe("memory store copy", () => {
  it("copies an object to a new key, leaving the source in place", async () => {
    const store = createMemoryStore();
    await store.put("from.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    await store.copy("from.jpg", "to.jpg", "image/jpeg");

    expect(store.objects.size).toBe(2);
    expect(store.objects.get("to.jpg")?.body).toEqual(new Uint8Array([1, 2, 3]));
    // The source contract keeps its own files; nothing is moved.
    expect(store.objects.get("from.jpg")).toBeDefined();
  });

  it("throws when the source is missing", async () => {
    const store = createMemoryStore();
    // Loud rather than silent: a missing source means a contract would be
    // written claiming documents that are not there.
    await expect(store.copy("nope.jpg", "to.jpg", "image/jpeg")).rejects.toThrow(
      /nope\.jpg/
    );
  });
});
