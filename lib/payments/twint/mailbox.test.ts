import { describe, expect, it } from "vitest";
import { readMailboxConfig } from "./mailbox";

describe("readMailboxConfig", () => {
  it("is off without a user or password", () => {
    expect(readMailboxConfig({})).toBeNull();
    expect(readMailboxConfig({ TWINT_IMAP_USER: "payments@zuriauto.ch" })).toBeNull();
  });

  it("defaults to Hostinger's IMAP, the inbox and 14 days", () => {
    expect(readMailboxConfig({ TWINT_IMAP_USER: "payments@zuriauto.ch", TWINT_IMAP_PASS: "pw" })).toEqual({
      host: "imap.hostinger.com",
      port: 993,
      user: "payments@zuriauto.ch",
      pass: "pw",
      mailbox: "INBOX",
      lookbackDays: 14,
    });
  });
});
