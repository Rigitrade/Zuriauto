/**
 * The fines part of the daily run.
 *
 * Four passes, each idempotent the scheduler's way — a send is claimed
 * before it is made, so running the day twice sends nothing twice:
 *
 *   retry     letters left unread an hour after upload, failed, or whose
 *             reading died — one a run, three attempts each. Run by the cron
 *             route last, after retention, not by runDailyPasses: a letter
 *             that outlasts the time limit must not cost the day the rest
 *   due soon  the renter, once, a week before the deadline, if they have
 *             not confirmed payment
 *   overdue   the office, once, when a sent fine passes its deadline with no
 *             word from the renter
 *   digest    the office, once a day, the fines waiting for review
 */

import { labelsFor } from "@/lib/admin/labels";
import { sendMail } from "@/lib/rental/lifecycleMail";
import { zurichDayString } from "@/lib/rental/passes";
import { recordEvent } from "./events";
import { officeFineDigestMail } from "./mail";
import { alertOffice, fineAdminUrl, notifyRenter, type NotifyDeps } from "./notify";
import { claimable, processFineDocument } from "./process";
import type { FineReader } from "./reader";

export interface FinePassDeps extends NotifyDeps {
  reader: FineReader;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A letter is left to its own after() this long before the pass takes it. */
export const RETRY_AFTER_MS = HOUR_MS;
/**
 * One letter a run. Reading is slow — tens of seconds a page — and the cron
 * shares its time limit with everything else; the next day reads the next.
 */
export const RETRY_BATCH = 1;
export const DUE_SOON_DAYS = 7;

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export async function fineDocumentRetryPass(deps: FinePassDeps): Promise<number> {
  const documents = await deps.client.fineDocument.findMany({
    where: {
      ...claimable(deps.now),
      uploadedAt: { lte: new Date(deps.now.getTime() - RETRY_AFTER_MS) },
    },
    orderBy: { uploadedAt: "asc" },
    take: RETRY_BATCH,
    select: { id: true },
  });

  let processed = 0;
  for (const document of documents) {
    const outcome = await processFineDocument(
      {
        client: deps.client,
        store: deps.store,
        reader: deps.reader,
        now: deps.now,
        notify: async (fineId, reason) => {
          await notifyRenter(deps, fineId, reason);
        },
      },
      document.id
    );
    if (outcome === "processed") processed += 1;
  }
  return processed;
}

export async function fineDueSoonPass(deps: FinePassDeps): Promise<number> {
  const today = zurichDayString(deps.now);
  const fines = await deps.client.fine.findMany({
    where: {
      status: "NOTIFIED",
      dueDate: {
        gte: day(today),
        lte: new Date(day(today).getTime() + DUE_SOON_DAYS * DAY_MS),
      },
    },
    select: { id: true },
  });

  let sent = 0;
  for (const fine of fines) {
    if ((await notifyRenter(deps, fine.id, "dueSoon")) === "sent") sent += 1;
  }
  return sent;
}

export async function fineOverduePass(deps: FinePassDeps): Promise<number> {
  const today = zurichDayString(deps.now);
  const fines = await deps.client.fine.findMany({
    where: { status: "NOTIFIED", dueDate: { lt: day(today) } },
    select: {
      id: true,
      reminderLevel: true,
      fineNumber: true,
      dueDate: true,
      car: { select: { plate: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  let alerted = 0;
  for (const fine of fines) {
    const outcome = await alertOffice(
      deps,
      fine,
      "overdue",
      `Zahlbar bis ${fine.dueDate?.toISOString().slice(0, 10)}; keine Zahlungsbestätigung des Mieters.`
    );
    if (outcome === "sent") {
      alerted += 1;
      await recordEvent(deps.client, fine.id, "office.overdue-alert", {}, null, deps.now);
    }
  }
  return alerted;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

/**
 * One mail a day listing every fine in review. Claimed per fine for the day:
 * the digest goes out when at least one fine has not been listed today, so
 * a second run the same day sends nothing, and tomorrow everything still
 * waiting is listed again.
 */
export async function fineDigestPass(deps: FinePassDeps): Promise<number> {
  if (!deps.mail) return 0;
  const office = deps.mail.office;
  const dedupeKey = `digest-${zurichDayString(deps.now)}`;
  const waiting = await deps.client.fine.findMany({
    where: { status: "NEEDS_REVIEW" },
    orderBy: { createdAt: "asc" },
    select: { id: true, reviewReason: true, car: { select: { plate: true } } },
  });

  const claims: string[] = [];
  for (const fine of waiting) {
    try {
      const claim = await deps.client.fineNotification.create({
        data: { fineId: fine.id, kind: "OFFICE_DIGEST", dedupeKey, to: office, createdAt: deps.now },
        select: { id: true },
      });
      claims.push(claim.id);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (claims.length === 0) return 0;

  const F = labelsFor("de").fines as Record<string, string>;
  const mail = officeFineDigestMail(
    waiting.map((fine) => ({
      plate: fine.car?.plate ?? "—",
      reason: fine.reviewReason ? (F[`reason${fine.reviewReason}`] ?? fine.reviewReason) : "—",
      fineUrl: fineAdminUrl(deps.baseUrl, fine.id),
    })),
    `${deps.baseUrl.replace(/\/$/, "")}/admin/fines/?tab=review`
  );

  try {
    await (deps.send ?? sendMail)(deps.mail, { to: office, ...mail });
    await deps.client.fineNotification.updateMany({
      where: { id: { in: claims } },
      data: { sentAt: deps.now, attempts: { increment: 1 } },
    });
    return claims.length;
  } catch (error) {
    console.error("[fines] the review digest failed:", error);
    await deps.client.fineNotification.updateMany({
      where: { id: { in: claims } },
      data: { error: String(error).slice(0, 500), attempts: { increment: 1 } },
    });
    return 0;
  }
}
