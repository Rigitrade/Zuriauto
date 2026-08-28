/**
 * Sets an account's password from the command line.
 *
 * The way back in when an owner has forgotten theirs. The seed deliberately
 * refuses to overwrite an existing password — see seedOwner — so this is the
 * escape hatch, and it is a script rather than a page because anyone who can
 * run it already has the database credentials.
 *
 *   DATABASE_URL="..." pnpm admin:password chef 'NeuesPasswort2026!'
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/admin/password";

async function main(): Promise<void> {
  config({ path: ".env.local" });

  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: pnpm admin:password <username> <password>");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const user = await client.adminUser.findFirst({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, username: true },
    });
    if (!user) {
      console.error(`No account called ${username}.`);
      // process.exit() does not unwind `finally`, so the disconnect below
      // would otherwise be skipped on this path.
      await client.$disconnect();
      process.exit(1);
    }

    await client.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        // Signs the account out everywhere, which is what you want if the
        // reason for the reset is that somebody else knew the old one.
        credentialsChangedAt: new Date(),
        disabledAt: null,
      },
    });

    console.log(`[admin] password set for ${user.username}, other sessions ended`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
