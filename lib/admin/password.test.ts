import { describe, expect, it } from "vitest";
import { hashPassword, passwordMatches, SCRYPT } from "./password";

describe("hashPassword", () => {
  it("produces a self-describing hash", async () => {
    const stored = await hashPassword("correct horse");
    const parts = stored.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(SCRYPT.N);
    expect(Number(parts[2])).toBe(SCRYPT.r);
    expect(Number(parts[3])).toBe(SCRYPT.p);
    expect(parts).toHaveLength(6);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(await passwordMatches("correct horse", a)).toBe(true);
    expect(await passwordMatches("correct horse", b)).toBe(true);
  });
});

describe("passwordMatches", () => {
  it("accepts the right password", async () => {
    const stored = await hashPassword("Sommer2026!");
    expect(await passwordMatches("Sommer2026!", stored)).toBe(true);
  });

  it("refuses the wrong one, including near misses", async () => {
    const stored = await hashPassword("Sommer2026!");
    expect(await passwordMatches("sommer2026!", stored)).toBe(false);
    expect(await passwordMatches("Sommer2026", stored)).toBe(false);
    expect(await passwordMatches("", stored)).toBe(false);
  });

  it("verifies a hash written at a lower cost, so the cost can be raised later", async () => {
    // The whole point of storing parameters: an old hash keeps working.
    const cheap = await hashPassword("Sommer2026!", { N: 1024, r: 8, p: 1 });
    expect(cheap).toContain("$1024$");
    expect(await passwordMatches("Sommer2026!", cheap)).toBe(true);
  });

  it("refuses a malformed stored value rather than throwing", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$16384$8$1$onlyfiveparts",
      "bcrypt$16384$8$1$aaaa$bbbb",
      "scrypt$notanumber$8$1$aaaa$bbbb",
    ]) {
      expect(await passwordMatches("Sommer2026!", bad)).toBe(false);
    }
  });

  it("refuses absurd parameters upfront", async () => {
    // N=2^30 exceeds MAX_N, caught by parseStored bounds check.
    const bomb = "scrypt$1073741824$32$16$aaaa$bbbb";
    expect(await passwordMatches("Sommer2026!", bomb)).toBe(false);
  });

  it("refuses parameters within bounds but still too large for maxmem", async () => {
    // N=2^20 (MAX_N) with r=32 is ~4 GiB total, within parseStored bounds but
    // beyond the maxmem ceiling. Rejected by Node's scrypt maxmem check, caught
    // and turned to false.
    const tooLarge = "scrypt$1048576$32$1$aaaa$bbbb";
    expect(await passwordMatches("Sommer2026!", tooLarge)).toBe(false);
  });
});
