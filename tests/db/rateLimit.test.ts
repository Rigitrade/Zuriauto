import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { RATE_LIMIT, hashIp, rateLimited } from "@/lib/rental/rateLimit";

describe("hashIp", () => {
  it("never returns the address it was given", () => {
    // The limiter must not itself become a store of personal data.
    expect(hashIp("203.0.113.9")).not.toContain("203.0.113.9");
  });

  it("is stable for the same address", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
  });

  it("separates different addresses", () => {
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });
});

describe("rateLimited", () => {
  const ip = "203.0.113.9";

  it("allows submissions up to the limit and blocks past it", async () => {
    for (let i = 0; i < RATE_LIMIT.max; i += 1) {
      expect(await rateLimited(prisma, ip)).toBe(false);
    }
    expect(await rateLimited(prisma, ip)).toBe(true);
  });

  it("counts across cold starts, which the in-memory version could not", async () => {
    // Nothing here holds state between calls: every call reads the table. The
    // old module-scope Map reset on every new serverless instance.
    for (let i = 0; i < RATE_LIMIT.max; i += 1) await rateLimited(prisma, ip);
    expect(await prisma.submissionAttempt.count()).toBe(RATE_LIMIT.max);
    expect(await rateLimited(prisma, ip)).toBe(true);
  });

  it("does not block a different address", async () => {
    for (let i = 0; i <= RATE_LIMIT.max; i += 1) await rateLimited(prisma, ip);
    expect(await rateLimited(prisma, "198.51.100.4")).toBe(false);
  });

  it("forgets attempts once the window has passed", async () => {
    const start = new Date("2026-08-17T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMIT.max; i += 1) {
      await rateLimited(prisma, ip, start);
    }
    expect(await rateLimited(prisma, ip, start)).toBe(true);

    const later = new Date(start.getTime() + RATE_LIMIT.windowMs + 1000);
    expect(await rateLimited(prisma, ip, later)).toBe(false);
  });

  it("prunes rows that can no longer matter", async () => {
    const start = new Date("2026-08-17T10:00:00.000Z");
    await rateLimited(prisma, ip, start);
    const later = new Date(start.getTime() + RATE_LIMIT.windowMs * 3);
    await rateLimited(prisma, ip, later);
    // The first row is outside the window and has been deleted on the way past.
    expect(await prisma.submissionAttempt.count()).toBe(1);
  });
});
