/**
 * Loads the pre-backend contracts into the database.
 *
 *   pnpm db:import-legacy              # dry run: says what it would do
 *   pnpm db:import-legacy --apply      # writes
 *
 * Run by hand against a live database, possibly more than once. Idempotent on
 * `Contract.contractNumber`, which is unique per organisation and comes off
 * the PDF rather than from `allocateContractNumber` — so a re-run after a
 * half-finished attempt completes it instead of duplicating it. Nothing is
 * ever updated: an entry whose contract number is already present is skipped
 * whole, because the row in the database may since have been corrected by the
 * office and this file is not the authority on it.
 *
 * The data, and every judgement call behind it, is in
 * `scripts/legacy-contracts.json` — gitignored, because it holds real
 * renters' personal data. `docs/LEGACY-IMPORT.md` explains the shape and
 * the decisions without repeating any of it.
 *
 * WHAT THIS WRITES, AND WHY IT IS SHAPED THIS WAY
 *
 * Rentals are imported COMPLETED. The PDFs record a handover — car, renter,
 * mileage, fuel, signature — and nothing about the term or the money: no start
 * date, no end date, no weekly rate, no deposit. So these rows are history, not
 * live agreements, and three consequences follow:
 *
 *   - `type` is FIXED_TERM, which the schema defines as "explicit endAt".
 *     WEEKLY would imply a weeklyAmountCents, totalWeeks and billingWeekday
 *     that no document states.
 *   - No Charge rows. `generateWeeklyCharges` needs an amount and a term;
 *     inventing either would put fabricated money in front of a customer.
 *   - Car status is left exactly as it is. `Car.status` is owned by the office
 *     — the same rule the seed follows — and a completed rental has no claim
 *     on it.
 *
 * COMPLETED also keeps the daily pass quiet. `runDailyPasses` mails every
 * ACTIVE rental whose endAt has passed (scheduler.ts:435) and chases charges on
 * rentals that are not COMPLETED or CANCELLED. Importing four-week-old rentals
 * as ACTIVE would send overdue notices to six real customers on the next cron
 * run. This is the single most important reason not to loosen the status here.
 *
 * WHAT THIS DOES NOT WRITE
 *
 * No Assets. The identity photographs are embedded in the PDFs but were never
 * uploaded to the object store, and there are no objects to point rows at. The
 * consequence is real and worth stating: the retention sweep only knows about
 * Asset rows, so these customers' ID images live on inside PDFs that are
 * outside the policy in docs/DATA-RETENTION.md.
 *
 * No pdfKey, for the same reason — the PDFs are on a desktop, not in R2. A
 * contract with a null pdfKey renders in the dashboard; its PDF link does not.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
import { normalisePhone } from "../lib/rental/phone";
import { normaliseEmail } from "../lib/rental/customers";

const APPLY = process.argv.includes("--apply");

/**
 * Zurich local time, as an instant.
 *
 * Every timestamp in the source PDFs is a wall-clock time printed by the
 * office in Zurich, all of them between 17.08. and 13.09.2026 — inside CEST,
 * so the offset is +02:00 throughout. Written explicitly rather than parsing a
 * bare "2026-08-17T10:13", which Node reads in the importing machine's zone
 * and would silently shift every row by however many hours separate that
 * machine from Zurich.
 */
function zurich(local: string): Date {
  return new Date(`${local.replace(" ", "T")}:00.000+02:00`);
}

/** A date with no time — a birthday, a payment day. UTC midnight, as `upsertCustomer` stores it. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------
// The data file
//
// Read and validated at run time rather than imported as a module, and that
// is deliberate. It holds seven real renters' names, birth dates, addresses,
// phone numbers and email addresses, so it is gitignored — and a TypeScript
// `import` of a gitignored file would break `tsc --noEmit` on any clean
// clone, which is exactly the CI that is supposed to be cheap to run. Reading
// JSON keeps this tool committable and the personal data out of the history.
//
// Validated rather than cast: the file is edited by hand between runs, and a
// mistyped fuel level or a missing email should stop the run with a readable
// error rather than reach Postgres as a constraint violation halfway through.
// ---------------------------------------------------------------------

const FUEL = z.enum(["empty", "quarter", "half", "three_quarter", "full"]);
/** "YYYY-MM-DD HH:MM", Zurich wall-clock. */
const LOCAL = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const customerSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: DAY,
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string(),
  phone: z.string(),
  notes: z.array(z.string()).default([]),
});

const pickupSchema = z.object({
  contractNumber: z.string().min(1),
  sourcePdf: z.string(),
  vehicleSlug: z.string().min(1),
  customerEmail: z.string().email(),
  signedAt: LOCAL,
  acceptedAt: LOCAL,
  mileageKm: z.number().int().nonnegative(),
  fuelLevel: FUEL,
  damageNotes: z.string(),
  gtcVersion: z.string(),
  gtcLanguage: z.enum(["de", "en", "fr"]),
  notes: z.array(z.string()).default([]),
});

const returnSchema = z.object({
  contractNumber: z.string().min(1),
  sourcePdf: z.string(),
  matchesPickup: z.string().nullable(),
  stub: z
    .object({
      vehicleSlug: z.string().min(1),
      customerEmail: z.string().email(),
      pickupMileageKm: z.number().int().nonnegative(),
      startAt: LOCAL,
    })
    .optional(),
  signedAt: LOCAL,
  mileageKm: z.number().int().nonnegative(),
  fuelLevel: FUEL,
  damageNotes: z.string(),
  cleanliness: z.enum(["clean", "needsWash"]),
  papersInside: z.boolean(),
  keyReturned: z.boolean(),
  tickets: z.boolean(),
  ticketsNote: z.string(),
  fullyPaid: z.boolean(),
  paymentMethods: z.array(z.string()),
  paidAmountCents: z.number().int(),
  paidOn: DAY.nullable(),
  hasDuePayment: z.boolean(),
  dueAmountCents: z.number().int().nullable(),
  dueDate: DAY.nullable(),
  dueMethod: z.string().nullable(),
  depositBack: z.boolean(),
  notes: z.array(z.string()).default([]),
});

const fileSchema = z.object({
  customers: z.array(customerSchema),
  pickups: z.array(pickupSchema),
  returns: z.array(returnSchema),
  excluded: z.array(z.object({ sourcePdf: z.string(), reason: z.string() })),
});

type LegacyCustomer = z.infer<typeof customerSchema>;

const DATA_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "legacy-contracts.json"
);

function loadData() {
  let raw: string;
  try {
    raw = readFileSync(DATA_FILE, "utf8");
  } catch {
    throw new Error(
      `Cannot read ${DATA_FILE}.
` +
        "This file is gitignored because it holds real renters' personal " +
        "data — see the note in .gitignore. Restore it from wherever the " +
        "signed PDFs are archived before running the import."
    );
  }

  const parsed = fileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `${DATA_FILE} is not valid:
${z.prettifyError(parsed.error)}`
    );
  }
  return parsed.data;
}

const { customers: CUSTOMERS, pickups: PICKUPS, returns: RETURNS, excluded: EXCLUDED } =
  loadData();

/** Everything the run did or would do, printed at the end. */
const plan: string[] = [];
const warnings: string[] = [];

function note(line: string) {
  plan.push(line);
  console.log(line);
}

function warn(line: string) {
  warnings.push(line);
  console.warn(`  ! ${line}`);
}

function customerByEmail(email: string): LegacyCustomer {
  const found = CUSTOMERS.find((c) => c.email === email);
  if (!found) throw new Error(`No customer entry for ${email}`);
  return found;
}

async function main() {
  config({ path: ".env.local" });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  // Printed so an operator can see which database they are about to change
  // before the writes start. Credentials stripped: this output gets pasted
  // into chat windows and tickets.
  const target = new URL(connectionString);
  console.log(
    `[import] ${APPLY ? "APPLY" : "DRY RUN"} against ` +
      `${target.host}${target.pathname}\n`
  );

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const org = await client.organisation.findFirst({
      select: { id: true, name: true },
    });
    if (!org) {
      throw new Error(
        "No organisation row. Run `pnpm db:seed` first — it also creates the " +
          "cars these contracts refer to."
      );
    }
    console.log(`[import] organisation: ${org.name} (${org.id})\n`);

    // --- Cars ----------------------------------------------------------
    // Resolved up front so a missing vehicle stops the run before anything is
    // written, rather than half-way through. The seed owns these rows; this
    // script never creates one.
    const slugs = new Set<string>([
      ...PICKUPS.map((p) => p.vehicleSlug),
      ...RETURNS.flatMap((r) => (r.stub ? [r.stub.vehicleSlug] : [])),
    ]);
    const cars = new Map<string, string>();
    for (const slug of slugs) {
      const car = await client.car.findUnique({
        where: { organisationId_slug: { organisationId: org.id, slug } },
        select: { id: true, plate: true },
      });
      if (!car) {
        throw new Error(
          `Car "${slug}" is not in the database. Run \`pnpm db:seed\` first.`
        );
      }
      cars.set(slug, car.id);
    }
    console.log(`[import] resolved ${cars.size} cars\n`);

    // --- Customers -----------------------------------------------------
    // Mirrors upsertCustomer: same email normalisation, same phoneKey, same
    // UTC-midnight birth date. Not a call to it, because that function takes a
    // ContractDetails and these rows are corrected rather than transcribed.
    console.log("[import] customers");
    const customers = new Map<string, string>();
    for (const entry of CUSTOMERS) {
      const email = normaliseEmail(entry.email);
      const phoneKey = normalisePhone(entry.phone);

      if (entry.phone && !phoneKey) {
        warn(
          `${email}: phone "${entry.phone}" will not normalise, so the desk ` +
            "lookup cannot find this customer."
        );
      }
      if (!entry.phone) {
        warn(`${email}: no phone number at all — not findable at the desk.`);
      }

      const existing = await client.customer.findUnique({
        where: { organisationId_email: { organisationId: org.id, email } },
        select: { id: true },
      });

      if (existing) {
        // Left alone on purpose. The office may have fixed an address since,
        // and a re-run of an import script must not undo that.
        note(`  = ${email} (already present, untouched)`);
        customers.set(entry.email, existing.id);
        continue;
      }

      note(`  + ${email}  ${entry.firstName} ${entry.lastName}`);
      for (const line of entry.notes) console.log(`      · ${line}`);

      if (!APPLY) {
        customers.set(entry.email, `dry-run:${email}`);
        continue;
      }

      const created = await client.customer.create({
        data: {
          organisationId: org.id,
          email,
          firstName: entry.firstName,
          lastName: entry.lastName,
          phone: entry.phone,
          phoneKey,
          birthDate: day(entry.birthDate),
          street: entry.street,
          postalCode: entry.postalCode,
          city: entry.city,
          country: entry.country,
        },
        select: { id: true },
      });
      customers.set(entry.email, created.id);
    }

    // --- Pickups -------------------------------------------------------
    console.log("\n[import] pickup contracts");
    const rentalByContract = new Map<string, string>();

    for (const pickup of PICKUPS) {
      const existing = await client.contract.findUnique({
        where: {
          organisationId_contractNumber: {
            organisationId: org.id,
            contractNumber: pickup.contractNumber,
          },
        },
        select: { rentalId: true },
      });
      if (existing) {
        note(`  = ${pickup.contractNumber} (already imported)`);
        rentalByContract.set(pickup.contractNumber, existing.rentalId);
        continue;
      }

      const signedAt = zurich(pickup.signedAt);
      note(
        `  + ${pickup.contractNumber}  ${pickup.vehicleSlug}  ` +
          `${pickup.customerEmail}  ${signedAt.toISOString()}`
      );
      for (const line of pickup.notes) warn(`${pickup.contractNumber}: ${line}`);

      if (!APPLY) continue;

      // The return, if one exists, is what says when this rental actually
      // ended. Without one there is nothing in any document to go on, so the
      // rental is a point in time rather than a span reaching forward to an
      // invented date.
      const closing = RETURNS.find(
        (r) => r.matchesPickup === pickup.contractNumber
      );
      const endAt = closing ? zurich(closing.signedAt) : signedAt;

      // One transaction per contract, not one for the whole run. A failure on
      // the eighth contract should leave the first seven standing — they are
      // independent facts, and the re-run skips what is already there.
      const rentalId = await client.$transaction(async (tx) => {
        const rental = await tx.rental.create({
          data: {
            organisationId: org.id,
            carId: cars.get(pickup.vehicleSlug)!,
            customerId: customers.get(pickup.customerEmail)!,
            // Not "office", which every row written by the live wizard says.
            // These were typed into a build that recorded nothing, and
            // reconstructed from a PDF a month later; a dispute reaching back
            // into one of these rows should be able to see that immediately.
            createdBy: "import:legacy-pdf",
            type: "FIXED_TERM",
            status: "COMPLETED",
            startAt: signedAt,
            endAt,
            currency: "chf",
            depositCents: 0,
            totalAmountCents: null,
          },
          select: { id: true },
        });

        await tx.contract.create({
          data: {
            organisationId: org.id,
            rentalId: rental.id,
            contractNumber: pickup.contractNumber,
            createdBy: "import:legacy-pdf",
            kind: "PICKUP",
            mileageKm: pickup.mileageKm,
            fuelLevel: pickup.fuelLevel,
            damageNotes: pickup.damageNotes,
            gtcVersion: pickup.gtcVersion,
            gtcLanguage: pickup.gtcLanguage,
            acceptedAt: zurich(pickup.acceptedAt),
            place: "Zurich",
            signedAt,
            pdfKey: null,
            // Stamped, although this import sends nothing.
            //
            // The build the office used between 17.08 and 13.09 produced the
            // PDF and mailed it; it only failed to write a row. So the mail
            // did leave, a month ago, and `mailSentAt: null` would assert the
            // opposite — which the Overview reads as "chase this", offering a
            // button that re-sends a month-old contract to a real customer.
            //
            // `signedAt` because the old flow mailed on signature; nothing
            // records the delivery to the minute, and inventing a more precise
            // moment would be a worse lie than an approximate true one. The
            // row is marked `import:legacy-pdf`, so anybody reading this
            // timestamp can see which system it came from.
            mailSentAt: signedAt,
          },
        });

        // The provenance, kept beside the rental rather than only in this
        // file. Whoever opens this rental in five years should be able to see
        // that it was reconstructed and from which document.
        await tx.rentalEvent.create({
          data: {
            rentalId: rental.id,
            type: "import.legacy-pickup",
            payload: {
              contractNumber: pickup.contractNumber,
              sourcePdf: pickup.sourcePdf,
              importedAt: new Date().toISOString(),
              termUnknown: true,
              notes: pickup.notes,
            } as Prisma.InputJsonValue,
          },
        });

        return rental.id;
      });

      rentalByContract.set(pickup.contractNumber, rentalId);
    }

    // --- Returns -------------------------------------------------------
    console.log("\n[import] return protocols");
    for (const ret of RETURNS) {
      const existing = await client.contract.findUnique({
        where: {
          organisationId_contractNumber: {
            organisationId: org.id,
            contractNumber: ret.contractNumber,
          },
        },
        select: { id: true },
      });
      if (existing) {
        note(`  = ${ret.contractNumber} (already imported)`);
        continue;
      }

      const signedAt = zurich(ret.signedAt);
      note(`  + ${ret.contractNumber}  ${signedAt.toISOString()}`);
      for (const line of ret.notes) warn(`${ret.contractNumber}: ${line}`);

      if (!APPLY) continue;

      let rentalId: string;

      if (ret.matchesPickup) {
        const found = rentalByContract.get(ret.matchesPickup);
        if (!found) {
          throw new Error(
            `${ret.contractNumber} closes ${ret.matchesPickup}, which was ` +
              "neither imported nor already present."
          );
        }
        rentalId = found;
      } else {
        const stub = ret.stub;
        if (!stub) {
          throw new Error(
            `${ret.contractNumber} has no matchesPickup and no stub.`
          );
        }
        // A rental with no PICKUP contract. Deliberate — see the note on this
        // entry in the data file.
        const rental = await client.rental.create({
          data: {
            organisationId: org.id,
            carId: cars.get(stub.vehicleSlug)!,
            customerId: customers.get(stub.customerEmail)!,
            createdBy: "import:legacy-pdf",
            type: "FIXED_TERM",
            status: "COMPLETED",
            startAt: zurich(stub.startAt),
            endAt: signedAt,
            currency: "chf",
            depositCents: 0,
          },
          select: { id: true },
        });
        rentalId = rental.id;

        await client.rentalEvent.create({
          data: {
            rentalId,
            type: "import.legacy-stub-rental",
            payload: {
              reason: "Return protocol supplied without its pickup contract",
              sourcePdf: ret.sourcePdf,
              pickupMileageKm: stub.pickupMileageKm,
              importedAt: new Date().toISOString(),
              notes: ret.notes,
            } as Prisma.InputJsonValue,
          },
        });
      }

      await client.$transaction(async (tx) => {
        await tx.contract.create({
          data: {
            organisationId: org.id,
            rentalId,
            contractNumber: ret.contractNumber,
            createdBy: "import:legacy-pdf",
            kind: "RETURN_ADDENDUM",
            mileageKm: ret.mileageKm,
            fuelLevel: ret.fuelLevel,
            damageNotes: ret.damageNotes,
            cleanliness: ret.cleanliness,
            papersInside: ret.papersInside,
            keyReturned: ret.keyReturned,
            tickets: ret.tickets,
            ticketsNote: ret.ticketsNote,
            fullyPaid: ret.fullyPaid,
            paymentMethods: ret.paymentMethods,
            paidAmountCents: ret.paidAmountCents,
            paidOn: ret.paidOn ? day(ret.paidOn) : null,
            // A claim, not a debt — no Charge row, exactly as persistReturn
            // does. Nobody is chased over a number a customer typed and
            // nobody reviewed.
            hasDuePayment: ret.hasDuePayment,
            dueAmountCents: ret.dueAmountCents,
            dueDate: ret.dueDate ? day(ret.dueDate) : null,
            dueMethod: ret.dueMethod,
            depositBack: ret.depositBack,
            // An addendum is not a second acceptance of the terms. Empty, as
            // persistReturn writes them — the columns are not nullable.
            gtcVersion: "",
            gtcLanguage: "",
            acceptedAt: signedAt,
            place: "Zurich",
            signedAt,
            pdfKey: null,
            // Same reasoning as the pickup above: the old build mailed this
            // protocol when it was signed, so the stamp records something that
            // happened rather than something this import did.
            mailSentAt: signedAt,
          },
        });

        await tx.rentalEvent.create({
          data: {
            rentalId,
            type: "import.legacy-return",
            payload: {
              contractNumber: ret.contractNumber,
              sourcePdf: ret.sourcePdf,
              matchesPickup: ret.matchesPickup,
              importedAt: new Date().toISOString(),
              notes: ret.notes,
            } as Prisma.InputJsonValue,
          },
        });
      });
    }

    // --- Summary -------------------------------------------------------
    console.log("\n[import] not imported");
    for (const skipped of EXCLUDED) {
      console.log(`  - ${skipped.sourcePdf}: ${skipped.reason}`);
    }

    const added = plan.filter((l) => l.trim().startsWith("+")).length;
    const kept = plan.filter((l) => l.trim().startsWith("=")).length;

    console.log(
      `\n[import] ${APPLY ? "wrote" : "would write"} ${added} rows, ` +
        `${kept} already present, ${warnings.length} warnings.`
    );

    if (warnings.length > 0) {
      console.log("\n[import] warnings, in full:");
      for (const line of warnings) console.log(`  ! ${line}`);
    }

    if (!APPLY) {
      console.log("\n[import] Dry run. Nothing was written. Re-run with --apply.");
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
