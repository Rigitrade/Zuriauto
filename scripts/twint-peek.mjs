// A read-only look at TWINT's payment notifications in the mailbox.
//
// Opens the mailbox read-only (nothing is marked read, moved or deleted),
// takes only mail from no-reply@twintpay.ch, never follows a link in it,
// checks TWINT's DKIM signature the way the site will, and prints the fields.
// Payer names are masked: this checks the email's format, not who paid.
//
//   pnpm twint:peek                 the last 50, with a summary
//   pnpm twint:peek -- --html 1234  the raw HTML of message uid 1234, to save
//                                   as an anonymised test fixture
//
// Reads TWINT_IMAP_* from .env.local (see docs/PAYMENTS-SETUP.md).

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { dkimVerify } from "mailauth/lib/dkim/verify.js";

const SENDER = "no-reply@twintpay.ch";
const LABELS = ["Betrag", "Transaktionsdatum", "Transaktions-Nr.", "Name des Stores", "Name", "Kontakt", "Nachricht"];

const user = process.env.TWINT_IMAP_USER;
const pass = process.env.TWINT_IMAP_PASS;
if (!user || !pass) throw new Error("Set TWINT_IMAP_USER and TWINT_IMAP_PASS in .env.local");

const htmlUid = process.argv.includes("--html") ? Number(process.argv[process.argv.indexOf("--html") + 1]) : null;

function lines(html) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|p|div|h[1-6]|li|table|b|strong|span)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function fields(all) {
  const out = {};
  for (let i = 0; i < all.length; i++) {
    const label = LABELS.find((l) => all[i] === l);
    if (!label || out[label]) continue;
    const value = [];
    for (let j = i + 1; j < all.length && !LABELS.includes(all[j]); j++) {
      if (/^Kundeninformation$|^Die Kundin oder/i.test(all[j])) break;
      value.push(all[j]);
    }
    out[label] = value;
  }
  return out;
}

const mask = (s) => s.split(" ").map((w) => (w.length <= 2 ? w : w[0] + "***")).join(" ");

const client = new ImapFlow({
  host: process.env.TWINT_IMAP_HOST || "imap.hostinger.com",
  port: Number(process.env.TWINT_IMAP_PORT || 993),
  secure: true,
  auth: { user, pass },
  logger: false,
});

await client.connect();
const lock = await client.getMailboxLock(process.env.TWINT_IMAP_MAILBOX || "INBOX", { readOnly: true });
try {
  const uids = (await client.search({ from: SENDER }, { uid: true })) || [];
  const pick = htmlUid ? [htmlUid] : uids.slice(-50);
  if (!htmlUid) console.log(`${uids.length} mails from ${SENDER}; reading the last ${pick.length}\n`);
  const stats = { read: 0, signed: 0, withPlate: 0, withWeek: 0, emptyMessage: 0 };

  if (pick.length > 0) {
    for await (const msg of client.fetch(pick.join(","), { source: true }, { uid: true })) {
      const mail = await simpleParser(msg.source);
      if (htmlUid) {
        process.stdout.write(mail.html || mail.textAsHtml || "");
        continue;
      }
      const dkim = await dkimVerify(msg.source);
      const pass = dkim.results.find((r) => r.status.result === "pass" && r.signingDomain === "twintpay.ch");
      const f = fields(lines(mail.html || mail.textAsHtml || ""));
      const message = (f["Nachricht"] ?? []).join(" / ");
      const plate = /ZH[\s.\-]*\d(?:[\s.\-]?\d){2,6}/i.exec(message)?.[0];
      const week = /(?:^|[^A-Z])W(?:oche)?\s?(\d{1,2})(?!\d)/i.exec(message)?.[1];

      stats.read++;
      if (pass) stats.signed++;
      if (plate) stats.withPlate++;
      if (week) stats.withWeek++;
      if (!message) stats.emptyMessage++;

      console.log(`uid ${msg.uid} · ${mail.date?.toISOString()} · DKIM ${pass ? "pass" : "NONE"}`);
      if (pass) {
        console.log(`  body limited: ${pass.canonBodyLengthLimited} · signed headers: ${JSON.stringify(pass.signingHeaders?.keys)}`);
      } else {
        console.log(`  dkim: ${dkim.results.map((r) => r.info).join(" | ")}`);
      }
      for (const label of LABELS) {
        const value = f[label];
        const shown = label === "Name" || label === "Kontakt" ? (value ? mask(value.join(" ")) : "?") : value?.join(" | ") ?? "?";
        console.log(`  ${label.padEnd(18)} ${shown}`);
      }
      console.log(`  -> plate ${plate ?? "none"} · week ${week ?? "none"}\n`);
    }
  }
  if (!htmlUid) console.log("Summary", stats);
} finally {
  lock.release();
  await client.logout();
}
