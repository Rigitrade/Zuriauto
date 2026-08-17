import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

describe("database", () => {
  it("starts each test with an empty organisation table", async () => {
    expect(await prisma.organisation.count()).toBe(0);
  });

  it("accepts an organisation", async () => {
    const org = await prisma.organisation.create({ data: { name: "ZURIAUTO" } });
    expect(org.id).toMatch(/^c[a-z0-9]+$/);
    expect(await prisma.organisation.count()).toBe(1);
  });

  it("isolates one test from the next", async () => {
    // Proves the truncation in setup.ts actually runs: without it this would
    // see the row the previous test created and every later suite would be
    // reading another suite's leftovers.
    expect(await prisma.organisation.count()).toBe(0);
  });
});
