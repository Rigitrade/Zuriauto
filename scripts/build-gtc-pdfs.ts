/**
 * Writes the downloadable GTC PDFs for the current version, one per language,
 * into `public/gtc-pdf/`. Run after changing `locales/gtc.ts`:
 *
 *   pnpm gtc:pdf
 *
 * Earlier versions' files are left in place: a contract signed under them, or
 * a link sent before the change, still opens the terms it referred to.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GTC_LANGUAGES, gtcPdfPath } from "@/locales/gtc";
import { buildGtcPdf } from "@/lib/rental/gtcPdf";

async function main() {
  for (const { code } of GTC_LANGUAGES) {
    const target = path.join("public", gtcPdfPath(code));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await buildGtcPdf(code));
    console.log(`wrote ${target}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
