import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorised } from "./auth";

const request = (authorization?: string) =>
  new Request("https://zuriauto.ch/api/cron/payments/", { headers: authorization ? { authorization } : {} });

describe("cronAuthorised", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("accepts the bearer secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronAuthorised(request("Bearer s3cret"))).toBe(true);
  });

  it("refuses a wrong or missing secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronAuthorised(request("Bearer nope"))).toBe(false);
    expect(cronAuthorised(request())).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(cronAuthorised(request("Bearer "))).toBe(false);
  });
});
