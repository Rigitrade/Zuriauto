/**
 * What the cron would do with these emails, without doing it.
 *
 * The same steps as ingestMail (TWINT's signature, the reader, the store
 * name, the evidence and the decision), but inside one READ ONLY
 * transaction, so Postgres itself refuses a write for as long as it runs.
 * That is what makes it safe against the live database before the feature
 * is switched on (scripts/twint-dry-run.ts): it shows which real payments
 * would book themselves and why the rest would wait, while nothing is
 * stored, booked or sent, and no issue is left for the office.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { decidePayment, type Decision } from "./decide";
import { gatherEvidence } from "./evidence";
import { readMail, type MailReading, type RawMail, type ReadOptions } from "./ingest";
import type { TwintNotification } from "./parse";

export type DryRunRow =
  | {
      uid: number | null;
      outcome: "unsigned" | "unreadable" | "other-store";
      detail: string | null;
      subject: string | null;
      receivedAt: Date | null;
    }
  /** Already in the Payment table: the cron would count it as "duplicate". */
  | { uid: number | null; outcome: "stored"; notification: TwintNotification; status: string }
  | { uid: number | null; outcome: "booked" | "review"; notification: TwintNotification; decision: Decision };

export async function dryRunMails(
  client: PrismaClient,
  mails: RawMail[],
  options: ReadOptions = {}
): Promise<DryRunRow[]> {
  // Outside the transaction: the DKIM check asks DNS, and a transaction
  // should not hold a connection while it waits.
  const readings: { uid: number | null; reading: MailReading }[] = [];
  for (const mail of mails) readings.push({ uid: mail.uid, reading: await readMail(mail, options) });

  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const organisation = await tx.organisation.findFirstOrThrow({ select: { id: true } });
      // Before the first deploy the live database has no Payment table yet.
      const [{ present }] = await tx.$queryRaw<{ present: boolean }[]>`
        SELECT to_regclass('"Payment"') IS NOT NULL AS present`;

      const rows: DryRunRow[] = [];
      for (const { uid, reading } of readings) {
        if (!reading.ok) {
          const { subject, receivedAt } = reading.about;
          rows.push({ uid, outcome: reading.outcome, detail: reading.detail, subject, receivedAt });
          continue;
        }
        const n = reading.notification;
        const stored = present
          ? await tx.payment.findUnique({
              where: { organisationId_externalId: { organisationId: organisation.id, externalId: n.externalId } },
              select: { status: true },
            })
          : null;
        if (stored) {
          rows.push({ uid, outcome: "stored", notification: n, status: stored.status });
          continue;
        }
        const decision = decidePayment(await gatherEvidence(tx, organisation.id, n));
        rows.push({ uid, outcome: decision.status === "BOOKED" ? "booked" : "review", notification: n, decision });
      }
      return rows;
    },
    // A remote database and a few dozen emails: Prisma's 5 s default is short.
    { maxWait: 20_000, timeout: 120_000 }
  );
}

const day = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short" });

/** "ZH 513 925 · Anna M. · 01.06.26– · ACTIVE" for every rental a row names. */
export async function rentalLabels(client: PrismaClient, rows: DryRunRow[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.outcome !== "booked" && row.outcome !== "review") continue;
    if (row.decision.rentalId) ids.add(row.decision.rentalId);
    for (const id of row.decision.candidates) ids.add(id);
  }
  if (ids.size === 0) return new Map();

  const rentals = await client.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.rental.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        car: { select: { plate: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });
  });
  return new Map(
    rentals.map((r) => {
      const renter = `${r.customer.firstName} ${r.customer.lastName.slice(0, 1)}.`.trim();
      const span = `${day.format(r.startAt)}–${r.endAt ? day.format(r.endAt) : ""}`;
      return [r.id, `${r.car.plate} · ${renter} · ${span} · ${r.status}`];
    })
  );
}
