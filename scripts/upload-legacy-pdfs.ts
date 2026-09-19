/**
 * Puts the pre-backend contract PDFs into the object store and points the
 * imported contracts at them.
 *
 * `import-legacy-contracts.ts` deliberately wrote `pdfKey: null` on all twelve
 * rows: the documents were on somebody's desktop, and a row pointing at an
 * object that does not exist is worse than a row admitting it has none. The
 * consequence was that the imported rentals rendered in the dashboard but
 * their "open the contract" link returned `no-document`. This is the other
 * half of that job, run once the files are to hand.
 *
 *   pnpm db:upload-legacy-pdfs --from "D:/.../zuriauto"            # dry run
 *   pnpm db:upload-legacy-pdfs --from "D:/.../zuriauto" --apply
 *
 * Idempotent on `Contract.pdfKey`: a contract that already has one is skipped
 * and never re-uploaded, so a run that dies on the ninth file completes on the
 * next attempt instead of leaving eight orphaned objects in the bucket.
 *
 * **Object first, row second.** A crash between the two leaves an unreferenced
 * object in R2 — invisible, cheap, and removable by hand. The reverse order
 * would leave a contract whose PDF link is a 500 rather than an honest 409,
 * and nothing would ever revisit it, because the next run skips rows that
 * already have a key. `lib/admin/retention.ts` orders its deletes on the same
 * reasoning, in the opposite direction and for the same reason: crash into the
 * state a later run can still fix.
 *
 * The key is `assetKey(...)`, exactly as a live handover builds it, so these
 * objects are indistinguishable from any other contract PDF to the code that
 * serves them. The UUID in the path is generated here rather than being a
 * submission id, because no submission ever happened — and the whole point of
 * that helper is that a key carries nothing but an opaque identifier.
 *
 * What this does NOT do: create `Asset` rows. A contract PDF has never had
 * one, live or imported — `pdfKey` is a column, and `sweepExpiredAssets` walks
 * `Asset`. So these documents sit outside the five-year sweep, exactly like
 * every contract PDF the system has ever written. That is a real gap and it is
 * pre-existing; it is noted in docs/LEGACY-IMPORT.md and worth fixing for all
 * contract PDFs at once rather than inventing a special case here.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { assetKey } from "../lib/storage/keys";
import { createR2Store } from "../lib/storage/r2";

type Entry = { contractNumber: string; sourcePdf: string; kind: string };

function plan(file: {
  pickups?: { contractNumber?: string; sourcePdf?: string }[];
  returns?: { contractNumber?: string; sourcePdf?: string }[];
}): Entry[] {
  const out: Entry[] = [];
  for (const p of file.pickups ?? []) {
    if (p.contractNumber && p.sourcePdf) {
      out.push({ ...(p as Required<typeof p>), kind: "CONTRACT_PDF" });
    }
  }
  for (const r of file.returns ?? []) {
    if (r.contractNumber && r.sourcePdf) {
      out.push({ ...(r as Required<typeof r>), kind: "RETURN_PDF" });
    }
  }
  return out;
}

async function main(): Promise<void> {
  config({ path: ".env.local" });

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fromIndex = args.findIndex((a) => a === "--from");
  const from =
    fromIndex >= 0 ? args[fromIndex + 1] : args.find((a) => a.startsWith("--from="))?.slice(7);

  if (!from) {
    console.error('Usage: pnpm db:upload-legacy-pdfs --from "<folder of PDFs>" [--apply]');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  // Not `getAssetStore()`, which falls back to an in-memory store whenever
  // R2_BUCKET is unset and NODE_ENV is not "production". A script run from a
  // laptop is not production, so that fallback would make this whole run
  // report success, put the bytes in a Map, throw the Map away on exit, and
  // leave twelve contracts pointing at objects that were never written. That
  // is the one outcome worse than doing nothing.
  if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
    console.error(
      "R2 is not configured in .env.local (need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,\n" +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_JURISDICTION). Refusing to run: without\n" +
        "them the uploads would go to an in-memory store and be lost on exit, while\n" +
        "every contract was stamped as having a document."
    );
    process.exit(1);
  }

  const entries = plan(
    JSON.parse(await readFile("scripts/legacy-contracts.json", "utf8"))
  );

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const store = createR2Store();

  console.log(
    `[pdfs] ${apply ? "APPLY" : "DRY RUN"} — ${entries.length} documents, bucket ${process.env.R2_BUCKET}`
  );
  console.log(`[pdfs] reading from ${path.resolve(from)}`);

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;

  try {
    for (const entry of entries) {
      const contract = await prisma.contract.findFirst({
        where: { contractNumber: entry.contractNumber },
        select: { id: true, contractNumber: true, pdfKey: true },
      });

      if (!contract) {
        console.log(`  ? ${entry.contractNumber}  no such contract — skipped`);
        missing += 1;
        continue;
      }
      if (contract.pdfKey) {
        console.log(`  = ${entry.contractNumber}  already has a document`);
        skipped += 1;
        continue;
      }

      const file = path.join(from, entry.sourcePdf);
      if (!existsSync(file)) {
        console.log(`  ! ${entry.contractNumber}  ${entry.sourcePdf} NOT FOUND`);
        missing += 1;
        continue;
      }

      const bytes = await readFile(file);
      // A truncated download and a renamed Word document both arrive here
      // looking like a file. Checking the magic number costs nothing and is
      // the difference between finding out now and finding out when a customer
      // disputes a contract the office cannot open.
      if (bytes.length === 0 || bytes.subarray(0, 4).toString() !== "%PDF") {
        console.log(
          `  ! ${entry.contractNumber}  ${entry.sourcePdf} is not a PDF (${bytes.length} bytes) — skipped`
        );
        missing += 1;
        continue;
      }

      const key = assetKey(randomUUID(), entry.kind, "pdf");
      const size = (bytes.length / 1024).toFixed(0);

      if (!apply) {
        console.log(`  + ${entry.contractNumber}  ${entry.sourcePdf}  ${size} KB`);
        uploaded += 1;
        continue;
      }

      await store.put(key, bytes, "application/pdf");
      await prisma.contract.update({
        where: { id: contract.id },
        data: { pdfKey: key },
      });
      console.log(`  + ${entry.contractNumber}  ${entry.sourcePdf}  ${size} KB  stored`);
      uploaded += 1;
    }

    console.log(
      `[pdfs] ${apply ? "uploaded" : "would upload"} ${uploaded}, ${skipped} already present, ${missing} unusable.`
    );
    if (!apply) console.log("[pdfs] Dry run. Nothing was written. Re-run with --apply.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
