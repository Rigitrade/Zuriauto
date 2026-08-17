import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Two projects, because the two kinds of test have different prerequisites.
 *
 * `unit` runs anywhere, needs no services, and is what `pnpm test` runs.
 * `db` needs `pnpm db:up` first, and is not parallelised: the suites share one
 * database and truncate between tests, so running files concurrently would
 * have them delete each other's rows.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Root level, because Vitest 3 does not accept it per project. It costs
    // the unit suite nothing — those files run in milliseconds — and it is
    // what keeps two database files from truncating each other's rows.
    fileParallelism: false,
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // Order matters. `env.ts` must finish before `setup.ts` is
          // evaluated, because `setup.ts` imports the Prisma client and the
          // client reads DATABASE_URL as it is constructed — an import
          // hoisted above a `config()` call in the same file would build it
          // against an empty environment.
          setupFiles: ["./tests/db/env.ts", "./tests/db/setup.ts"],
          testTimeout: 20_000,
        },
      },
    ],
  },
});
