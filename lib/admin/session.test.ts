import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_MS,
  adminSecretValid,
  adminSessionValid,
  issueAdminSession,
} from "./session";

const NOW = new Date("2026-08-23T09:00:00.000Z");

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = "office-admin-secret";
  });

  it("accepts the configured secret", () => {
    expect(adminSecretValid("office-admin-secret")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(adminSecretValid("guess")).toBe(false);
    expect(adminSecretValid("")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    // An unconfigured secret is a misconfiguration, not permission — the same
    // rule as applyKeyValid.
    delete process.env.ADMIN_SECRET;
    expect(adminSecretValid("anything")).toBe(false);
    expect(adminSecretValid("")).toBe(false);
  });

  it("round-trips a session token", () => {
    const token = issueAdminSession(NOW);
    expect(adminSessionValid(token, NOW)).toBe(true);
  });

  it("is still valid an hour before expiry", () => {
    const token = issueAdminSession(NOW);
    const almost = new Date(NOW.getTime() + ADMIN_SESSION_TTL_MS - 3_600_000);
    expect(adminSessionValid(token, almost)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = issueAdminSession(NOW);
    const after = new Date(NOW.getTime() + ADMIN_SESSION_TTL_MS + 1);
    expect(adminSessionValid(token, after)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = issueAdminSession(NOW);
    const [payload] = token.split(".");
    expect(adminSessionValid(`${payload}.forged`, NOW)).toBe(false);
  });

  it("rejects a token extended by rewriting its expiry", () => {
    // The signature covers the expiry, so a holder cannot grant themselves
    // longer than they were given.
    const token = issueAdminSession(NOW);
    const [, signature] = token.split(".");
    const longer = Buffer.from(`admin.${NOW.getTime() + 10 ** 12}`).toString(
      "base64url"
    );
    expect(adminSessionValid(`${longer}.${signature}`, NOW)).toBe(false);
  });

  it("rejects a token signed with a since-rotated secret", () => {
    const token = issueAdminSession(NOW);
    process.env.ADMIN_SECRET = "rotated";
    // Rotation signs everyone out, which is the point of rotating.
    expect(adminSessionValid(token, NOW)).toBe(false);
  });

  it("rejects a missing or malformed cookie without throwing", () => {
    for (const bad of [undefined, "", ".", "no-dot", "a.b.c", "!!!.???"]) {
      expect(adminSessionValid(bad, NOW)).toBe(false);
    }
  });

  it("refuses to issue without a configured secret", () => {
    delete process.env.ADMIN_SECRET;
    expect(() => issueAdminSession(NOW)).toThrow(/ADMIN_SECRET/);
  });
});
