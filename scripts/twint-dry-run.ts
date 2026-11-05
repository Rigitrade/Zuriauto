/**
 * What the payments cron would do with TWINT's emails, against the real
 * database, without doing any of it.
 *
 *   pnpm twint:dry-run                   the mailbox, last TWINT_LOOKBACK_DAYS (14)
 *   pnpm twint:dry-run -- --days 60      the mailbox, further back
 *   pnpm twint:dry-run -- --eml <folder> saved .eml files instead of the mailbox
 *
 * The mailbox is opened read-only, as the cron opens it. Every email goes
 * through lib/payments/twint/dryRun.ts: the cron's own steps inside a READ
 * ONLY transaction, so the database refuses any write. Nothing is stored,
 * booked or sent. Payers are masked; renters show as first name and initial.
 *
 * An .eml file must be the original message ("download" or "show source" in
 * webmail, or forwarded as an attachment) — a forwarded copy loses TWINT's
 * signature and reads as UNSIGNED.
 *
 * Reads TWINT_IMAP_* and DATABASE_URL from .env.local (docs/PAYMENTS-SETUP.md).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { dryRunMails, rentalLabels } from "../lib/payments/twint/dryRun";
import { formatDryRun } from "../lib/payments/twint/dryRunReport";
import type { RawMail } from "../lib/payments/twint/ingest";
import { fetchTwintMails, readMailboxConfig } from "../lib/payments/twint/mailbox";

const option = (name: string) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
};

async function savedMails(folder: string): Promise<RawMail[]> {
  const names = (await readdir(folder)).filter((name) => name.toLowerCase().endsWith(".eml")).sort();
  console.log(`${names.length} .eml file(s) in ${folder}\n`);
  return Promise.all(names.map(async (name, i) => ({ uid: i + 1, source: await readFile(join(folder, name)) })));
}

async function mailboxMails(): Promise<RawMail[]> {
  const mailbox = readMailboxConfig();
  if (!mailbox) throw new Error("Set TWINT_IMAP_USER and TWINT_IMAP_PASS in .env.local, or pass --eml <folder>");
  const days = option("--days");
  if (days) mailbox.lookbackDays = Number(days);
  const mails = await fetchTwintMails(mailbox, new Date());
  console.log(`${mails.length} TWINT email(s) in ${mailbox.user} from the last ${mailbox.lookbackDays} days\n`);
  return mails;
}

async function main() {
  config({ path: ".env.local" });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  console.log(`database: ${new URL(connectionString).hostname} (read only)`);

  const folder = option("--eml");
  const mails = folder ? await savedMails(folder) : await mailboxMails();
  if (mails.length === 0) return;

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = await dryRunMails(client, mails);
    console.log(formatDryRun(rows, await rentalLabels(client, rows)));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
