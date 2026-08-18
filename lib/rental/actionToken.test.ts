import { describe, expect, it } from "vitest";
import {
  generateToken,
  hashToken,
  hashesMatch,
  manageUrl,
  tokenIsUsable,
} from "./actionToken";

describe("generateToken", () => {
  it("is URL-safe, so it survives being pasted into WhatsApp", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, generateToken));
    expect(seen.size).toBe(500);
  });

  it("carries at least 256 bits", () => {
    // 32 bytes in base64url is 43 characters.
    expect(generateToken().length).toBeGreaterThanOrEqual(43);
  });
});

describe("hashToken", () => {
  it("is stable", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("does not contain the token", () => {
    // What goes in the database must not be usable as a link.
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });

  it("separates two tokens", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("hashesMatch", () => {
  it("accepts identical hashes", () => {
    const h = hashToken("x");
    expect(hashesMatch(h, h)).toBe(true);
  });

  it("rejects different hashes", () => {
    expect(hashesMatch(hashToken("x"), hashToken("y"))).toBe(false);
  });

  it("rejects a length mismatch without throwing", () => {
    expect(hashesMatch("abc", hashToken("x"))).toBe(false);
  });
});

describe("tokenIsUsable", () => {
  const now = new Date("2026-08-18T09:00:00Z");

  it("accepts a fresh, unused token", () => {
    expect(
      tokenIsUsable(
        { expiresAt: new Date("2026-08-25T09:00:00Z"), usedAt: null },
        now
      )
    ).toBe(true);
  });

  it("refuses one already used", () => {
    expect(
      tokenIsUsable(
        {
          expiresAt: new Date("2026-08-25T09:00:00Z"),
          usedAt: new Date("2026-08-18T08:00:00Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("refuses one that has expired", () => {
    expect(
      tokenIsUsable(
        { expiresAt: new Date("2026-08-17T09:00:00Z"), usedAt: null },
        now
      )
    ).toBe(false);
  });

  it("refuses one expiring exactly now", () => {
    expect(tokenIsUsable({ expiresAt: now, usedAt: null }, now)).toBe(false);
  });
});

describe("manageUrl", () => {
  it("builds a slashed path, because trailingSlash is on", () => {
    expect(manageUrl("https://zuriauto.ch", "abc")).toBe(
      "https://zuriauto.ch/rental/manage/?t=abc"
    );
  });

  it("tolerates a base URL with a trailing slash", () => {
    expect(manageUrl("https://zuriauto.ch/", "abc")).toBe(
      "https://zuriauto.ch/rental/manage/?t=abc"
    );
  });
});
