import { beforeEach, describe, expect, it } from "vitest";
import {
  REUSE_TOKEN_TTL_MS,
  issueReuseToken,
  readReuseToken,
} from "./reuseToken";

const NOW = new Date("2026-08-22T10:00:00.000Z");

describe("reuse token", () => {
  beforeEach(() => {
    process.env.APPLY_SECRET = "test-secret-for-signing";
  });

  it("round-trips the contract id it was issued for", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    expect(readReuseToken(token, NOW)).toBe("ckcontract123");
  });

  it("is still valid one minute before it expires", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const almost = new Date(NOW.getTime() + REUSE_TOKEN_TTL_MS - 60_000);
    expect(readReuseToken(token, almost)).toBe("ckcontract123");
  });

  it("refuses an expired token", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const after = new Date(NOW.getTime() + REUSE_TOKEN_TTL_MS + 1);
    expect(readReuseToken(token, after)).toBeNull();
  });

  it("refuses a tampered signature", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    const [payload] = token.split(".");
    expect(readReuseToken(`${payload}.forged`, NOW)).toBeNull();
  });

  it("refuses a re-pointed payload", () => {
    // The whole point: a caller must not be able to name a different contract
    // and have its documents copied onto their own.
    const mine = issueReuseToken("ckcontract123", NOW);
    const [, signature] = mine.split(".");
    const theirs = Buffer.from(
      `ckSOMEONEELSE.${NOW.getTime() + 60_000}`
    ).toString("base64url");
    expect(readReuseToken(`${theirs}.${signature}`, NOW)).toBeNull();
  });

  it("refuses a token signed with a different secret", () => {
    const token = issueReuseToken("ckcontract123", NOW);
    process.env.APPLY_SECRET = "a-rotated-secret";
    expect(readReuseToken(token, NOW)).toBeNull();
  });

  it("refuses malformed input without throwing", () => {
    for (const bad of ["", ".", "no-dot", "a.b.c", "!!!.???"]) {
      expect(readReuseToken(bad, NOW)).toBeNull();
    }
  });

  it("refuses to issue without a configured secret", () => {
    delete process.env.APPLY_SECRET;
    expect(() => issueReuseToken("ckcontract123", NOW)).toThrow(/APPLY_SECRET/);
  });
});
