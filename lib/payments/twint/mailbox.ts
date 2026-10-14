/**
 * TWINT's emails, fetched read-only.
 *
 * Read-only is the point: the mailbox is the office's, and a payment the site
 * failed to store must still be there for the next run — so nothing is
 * flagged as seen, moved or deleted. Each run re-reads the last
 * `lookbackDays`; the unique transaction number makes that harmless, and a
 * handful of emails a day makes it cheap.
 */

import { ImapFlow } from "imapflow";
import { TWINT_SENDER } from "./authentic";
import type { RawMail } from "./ingest";

export interface MailboxConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  mailbox: string;
  lookbackDays: number;
}

export function readMailboxConfig(
  env: Record<string, string | undefined> = process.env
): MailboxConfig | null {
  const user = env.TWINT_IMAP_USER?.trim();
  const pass = env.TWINT_IMAP_PASS;
  if (!user || !pass) return null;
  return {
    host: env.TWINT_IMAP_HOST?.trim() || "imap.hostinger.com",
    port: Number(env.TWINT_IMAP_PORT || 993),
    user,
    pass,
    mailbox: env.TWINT_IMAP_MAILBOX?.trim() || "INBOX",
    lookbackDays: Number(env.TWINT_LOOKBACK_DAYS || 14),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchTwintMails(config: MailboxConfig, now: Date): Promise<RawMail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(config.mailbox, { readOnly: true });
    try {
      const since = new Date(now.getTime() - config.lookbackDays * DAY_MS);
      const uids = (await client.search({ from: TWINT_SENDER, since }, { uid: true })) || [];
      if (uids.length === 0) return [];
      const mails: RawMail[] = [];
      for await (const message of client.fetch(uids.join(","), { source: true }, { uid: true })) {
        if (message.source) mails.push({ uid: message.uid, source: message.source });
      }
      return mails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
