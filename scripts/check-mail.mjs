/**
 * Checks the contract mailer's configuration without going through the form.
 *
 * Usage:
 *   node --env-file=.env.local scripts/check-mail.mjs           # connect only
 *   node --env-file=.env.local scripts/check-mail.mjs --send    # also send one
 *
 * Exists because diagnosing SMTP through the rental form means filling in four
 * steps, photographing two documents and signing before you learn the password
 * was wrong. This does the same handshake in two seconds and translates the
 * provider's error codes into what to actually change.
 */

import nodemailer from "nodemailer";

/**
 * Pulls the address out of `Name <addr@host>`, so a display name can be set
 * without tripping the sender-mismatch check below.
 */
function addressOf(value) {
  const match = String(value ?? "").match(/<([^>]+)>/);
  return (match ? match[1] : String(value ?? "")).trim().toLowerCase();
}

/** Shows enough of a secret to spot a typo, never enough to leak it. */
function mask(value) {
  if (!value) return "(empty)";
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(value.length - 4)}${value.slice(-2)}`;
}

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_OFFICE,
  MAIL_ARCHIVE,
} = process.env;

console.log("Configuration");
console.log("  SMTP_HOST    ", SMTP_HOST || "(empty)");
console.log("  SMTP_PORT    ", SMTP_PORT || "(empty, defaults to 587)");
console.log("  SMTP_USER    ", SMTP_USER || "(empty)");
console.log("  SMTP_PASS    ", mask(SMTP_PASS));
console.log("  MAIL_FROM    ", MAIL_FROM || "(empty, falls back to SMTP_USER)");
console.log("  MAIL_OFFICE  ", MAIL_OFFICE || "(empty)");
console.log("  MAIL_ARCHIVE ", MAIL_ARCHIVE || "(empty — no backup copy)");
console.log();

const missing = [
  !SMTP_HOST && "SMTP_HOST",
  !SMTP_USER && "SMTP_USER",
  !SMTP_PASS && "SMTP_PASS",
  !MAIL_OFFICE && "MAIL_OFFICE",
].filter(Boolean);

if (missing.length) {
  console.error(`FAIL  Missing: ${missing.join(", ")}`);
  console.error("      Fill these in .env.local, then run this again.");
  process.exit(1);
}

// Gmail replaces a mismatched sender, so the contract would appear to come
// from somewhere the customer does not recognise.
// A display name is fine — only the address inside the angle brackets has to
// match the authenticated mailbox, or the provider rejects it and SPF
// alignment fails.
const from = MAIL_FROM || SMTP_USER;
if (addressOf(from) !== addressOf(SMTP_USER)) {
  console.warn(`WARN  MAIL_FROM address (${addressOf(from)}) differs from`);
  console.warn(`      SMTP_USER (${addressOf(SMTP_USER)}). Most providers reject this.`);
  console.warn(`      To show a friendly name, keep the address and write it as:`);
  console.warn(`        MAIL_FROM=ZURIAUTO <${SMTP_USER}>\n`);
}

if (SMTP_HOST.includes("gmail") && /\s/.test(SMTP_PASS ?? "")) {
  console.log("NOTE  App Password contains spaces. That is fine — Gmail accepts it.\n");
}

const port = Number(SMTP_PORT ?? 587);
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

/** Turns a provider error into the thing to change. */
function explain(error) {
  const code = error?.code ?? "";
  const response = String(error?.response ?? error?.message ?? "");

  if (code === "EAUTH" || /5\.7\.(8|9|14)|Username and Password not accepted/i.test(response)) {
    return [
      "Authentication was refused.",
      SMTP_HOST.includes("gmail")
        ? "  Gmail: this is almost always the account password being used instead\n" +
          "  of an App Password. App Passwords need 2-Step Verification switched on\n" +
          "  first, then are generated at myaccount.google.com/apppasswords"
        : "  Check SMTP_USER and SMTP_PASS. Many hosts want the full email address\n" +
          "  as the username.",
    ].join("\n");
  }

  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET") {
    return [
      "Could not reach the mail server.",
      `  Check SMTP_HOST (${SMTP_HOST}) and SMTP_PORT (${port}).`,
      "  Port 587 is STARTTLS, port 465 is implicit TLS. A firewall or",
      "  corporate network blocking outbound SMTP causes this too.",
    ].join("\n");
  }

  if (code === "EENVELOPE") {
    return "The server rejected a sender or recipient address. Check MAIL_FROM and MAIL_OFFICE.";
  }

  return `${code || "Unknown error"}: ${response}`;
}

try {
  await transport.verify();
  console.log("OK    SMTP connection and login succeeded.");
} catch (error) {
  console.error("FAIL  " + explain(error));
  process.exit(1);
}

if (!process.argv.includes("--send")) {
  console.log("\nRun again with --send to deliver a real test message.");
  process.exit(0);
}

// A tiny valid PDF, so the attachment path is exercised rather than assumed.
const pdf = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAw" +
    "IG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8" +
    "PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA5OSA5OV0+PgplbmRvYmoKdHJh" +
    "aWxlcgo8PC9Sb290IDEgMCBSPj4K",
  "base64"
);

try {
  const info = await transport.sendMail({
    from,
    to: MAIL_OFFICE,
    bcc: MAIL_ARCHIVE || undefined,
    subject: "ZURIAUTO — mailer test",
    text:
      "If you are reading this, the rental contract mailer is configured correctly.\n\n" +
      "The attachment confirms PDFs survive the trip.",
    attachments: [
      { filename: "test.pdf", content: pdf, contentType: "application/pdf" },
    ],
  });

  console.log(`OK    Sent to ${MAIL_OFFICE}${MAIL_ARCHIVE ? ` (bcc ${MAIL_ARCHIVE})` : ""}`);
  console.log(`      Message id: ${info.messageId}`);
  if (info.rejected?.length) {
    console.warn(`WARN  Rejected: ${info.rejected.join(", ")}`);
  }
  console.log("\nCheck the inbox, including the spam folder.");
} catch (error) {
  console.error("FAIL  " + explain(error));
  process.exit(1);
}
