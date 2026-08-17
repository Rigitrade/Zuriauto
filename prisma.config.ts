import { config } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Configuration for the Prisma CLI — `generate`, `migrate`, `db`.
 *
 * Prisma 7 moved the datasource URL out of `schema.prisma` and into this file,
 * and it does not read `.env` files by itself.
 *
 * `.env.local` rather than `.env`: this is a Next.js project, `.env.local` is
 * where its secrets already live, and having the CLI read a second file would
 * mean two places to change a connection string.
 */
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
