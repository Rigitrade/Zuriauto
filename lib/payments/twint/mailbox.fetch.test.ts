import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A mailbox whose connection drops after login, the way imapflow reports
 * it: the socket's error is emitted on the client, the command in flight
 * rejects, and a later LOGOUT finds no connection.
 */
class DroppingClient extends EventEmitter {
  async connect() {}
  async getMailboxLock() {
    setImmediate(() => this.emit("error", Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    throw Object.assign(new Error("Connection not available"), { code: "NoConnection" });
  }
  async logout() {
    throw Object.assign(new Error("Connection not available"), { code: "NoConnection" });
  }
  close() {}
}

vi.mock("imapflow", () => ({ ImapFlow: vi.fn(() => new DroppingClient()) }));

const { fetchTwintMails } = await import("./mailbox");

const config = { host: "imap.example", port: 993, user: "u", pass: "p", mailbox: "INBOX", lookbackDays: 14 };

describe("fetchTwintMails", () => {
  afterEach(() => vi.clearAllMocks());

  it("turns a connection that drops mid-run into a failed run, not a crashed process", async () => {
    const uncaught = vi.fn();
    process.on("uncaughtException", uncaught);
    try {
      await expect(fetchTwintMails(config, new Date())).rejects.toThrow("read ECONNRESET");
      await new Promise((resolve) => setImmediate(resolve));
      expect(uncaught).not.toHaveBeenCalled();
    } finally {
      process.off("uncaughtException", uncaught);
    }
  });
});
