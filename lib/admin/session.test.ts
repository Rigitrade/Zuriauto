import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_MS,
  issueAdminSession,
  readAdminCookie,
} from "./session";

const NOW = new Date("2026-08-28T08:00:00.000Z");
const USER = "clx0000000000000000000000";

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("issueAdminSession", () => {
  it("round-trips the user id and the issue time", () => {
    const token = issueAdminSession(USER, NOW);
    const read = readAdminCookie(token, NOW);
    expect(read).toEqual({ userId: USER, issuedAt: NOW.getTime() });
  });

  it("expires", () => {
    const token = issueAdminSession(USER, NOW);
    const after = new Date(NOW.getTime() + ADMIN_SESSION_TTL_MS + 1000);
    expect(readAdminCookie(token, after)).toBeNull();
  });
});

describe("readAdminCookie", () => {
  it("refuses a rewritten expiry", () => {
    const token = issueAdminSession(USER, NOW);
    const [payload, signature] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const forged = decoded.replace(
      String(NOW.getTime() + ADMIN_SESSION_TTL_MS),
      String(NOW.getTime() + ADMIN_SESSION_TTL_MS + 10 * 365 * 24 * 3600 * 1000)
    );
    const tampered = `${Buffer.from(forged).toString("base64url")}.${signature}`;
    expect(readAdminCookie(tampered, NOW)).toBeNull();
  });

  it("refuses a rewritten user id", () => {
    const token = issueAdminSession(USER, NOW);
    const [payload, signature] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const forged = decoded.replace(USER, "clxSOMEBODYELSE000000000");
    const tampered = `${Buffer.from(forged).toString("base64url")}.${signature}`;
    expect(readAdminCookie(tampered, NOW)).toBeNull();
  });

  it("refuses a token signed with a different key", () => {
    const token = issueAdminSession(USER, NOW);
    process.env.ADMIN_SECRET = "rotated";
    expect(readAdminCookie(token, NOW)).toBeNull();
  });

  it("refuses nonsense and absence without throwing", () => {
    for (const bad of [undefined, "", "no-dot", "a.b.c", "...."]) {
      expect(readAdminCookie(bad, NOW)).toBeNull();
    }
  });

  it("refuses everything when ADMIN_SECRET is unset", () => {
    const token = issueAdminSession(USER, NOW);
    delete process.env.ADMIN_SECRET;
    expect(readAdminCookie(token, NOW)).toBeNull();
  });
});
