/**
 * The daily run.
 *
 * Six passes in order, each idempotent by construction. Two mechanisms do the
 * work, and neither is a boolean flag:
 *
 *   1. A send is claimed by inserting a `Notification` row whose unique key is
 *      `[rentalId, kind, dedupeKey]`. The insert happens before the send, so
 *      two concurrent runs race on the insert and exactly one wins.
 *   2. A status transition is a conditional `updateMany` whose WHERE repeats
 *      the precondition the pure predicate just checked. The predicate can be
 *      true twice; the update can only succeed once.
 *
 * `now` is threaded through everything rather than read from the clock, which
 * is what lets the tests drive a rental through three weeks in milliseconds.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { PAYMENT_URL } from "@/lib/payment";
import { getPaymentProvider } from "@/lib/payments";
import {
  MANAGE_TOKEN_TTL_HOURS,
  generateToken,
  hashToken,
  manageUrl,
} from "./actionToken";
import { asRentalLanguage, type RentalLanguage } from "./labels";
import {
  chargeDueMail,
  mfkDueMail,
  officeAlertMail,
  readLifecycleMailConfig,
  rentalEndingMail,
  sendMail,
  type LifecycleMailConfig,
} from "./lifecycleMail";
import { endAtDedupeKey, sendOnce, weekDedupeKey } from "./notify";
import { mfkDedupeKey, sendOnceForCar } from "./carNotify";
import {
  AVAILABILITY_BATCH,
  availabilityMail,
  unsubscribeUrl,
} from "./availability";
import {
  endingSoonWindow,
  isDueForChargeOverdue,
  isDueForChargeReminder,
  isDueForChargeRequest,
  isMfkDueSoon,
  isMfkExpired,
  isRentalEndingSoon,
  isRentalOverdue,
  mfkDueWindow,
} from "./passes";

export interface PassSummary {
  reminded: number;
  charged: number;
  chargeReminded: number;
  chargeOverdue: number;
  rentalOverdue: number;
  mfkDue: number;
  /** People on the waiting list written to because a car is free. */
  availabilityNotified: number;
  mailRetried: number;
}

export interface SchedulerDeps {
  client: PrismaClient;
  now: Date;
  /** Absolute base for links in emails, e.g. `https://zuriauto.ch`. */
  baseUrl: string;
  mail: LifecycleMailConfig | null;
}

const REMIND_AFTER_HOURS = Number(
  process.env.CHARGE_REMIND_AFTER_HOURS ?? 72
);
const ALERT_AFTER_HOURS = Number(process.env.CHARGE_ALERT_AFTER_HOURS ?? 48);

/** How many attempts `mailRetryPass` makes before giving up on a message. */
const MAX_MAIL_ATTEMPTS = 3;

/**
 * How long a failed message is left alone before the office is told.
 *
 * Without this, mailRetryPass runs last in the same daily pass that failed and
 * escalates within milliseconds — so a transient SMTP blip, which is the
 * common case on a serverless mailer, would bother the office instead of
 * simply succeeding on the next run.
 */
const RETRY_MIN_AGE_HOURS = 1;

const rentalInclude = {
  customer: true,
  car: true,
  /**
   * The signed contract, for its language.
   *
   * A renter who read and signed the German terms should be written to in
   * German, whatever their browser was set to afterwards. The stored
   * gtcLanguage is the version they actually saw, so it is the honest
   * source — and it is why this include exists rather than defaulting
   * everybody to German.
   */
  contracts: {
    where: { kind: "PICKUP" },
    orderBy: { signedAt: "asc" },
    take: 1,
    select: { gtcLanguage: true },
  },
} as const;

/** The language the renter signed in, falling back to German. */
function languageOf(rental: {
  contracts: { gtcLanguage: string }[];
}): RentalLanguage {
  return asRentalLanguage(rental.contracts[0]?.gtcLanguage);
}

function renterName(customer: { firstName: string; lastName: string }): string {
  return `${customer.firstName} ${customer.lastName}`;
}

// ---------------------------------------------------------------------
// 1. The client's headline ask: tell the renter their rental is ending.
// ---------------------------------------------------------------------

export async function preEndReminderPass(deps: SchedulerDeps): Promise<number> {
  const { client, now, baseUrl, mail } = deps;
  const { from, to } = endingSoonWindow(now);

  // The coarse filter matches the index built in Phase 2 for exactly this
  // query: [organisationId, status, endAt].
  const candidates = await client.rental.findMany({
    where: { status: "ACTIVE", endAt: { gt: from, lte: to } },
    include: rentalInclude,
  });

  let count = 0;

  for (const rental of candidates) {
    // Belt and braces: the window above and the predicate here agree, but the
    // predicate is the one under test.
    if (!isRentalEndingSoon(rental, now)) continue;

    const sent = await sendOnce(
      client,
      {
        organisationId: rental.organisationId,
        rentalId: rental.id,
        kind: "RENTAL_ENDING",
        // The Zurich day of endAt. An extension moves endAt to a different
        // day, which is exactly when a fresh reminder should be allowed.
        dedupeKey: endAtDedupeKey(rental.endAt),
        to: rental.customer.email,
      },
      now,
      async () => {
        if (!mail) throw new Error("mail-not-configured");

        // Minted inside the send, so a rental whose claim was lost to a
        // concurrent run does not leave an unused token behind.
        const token = generateToken();
        const minted = await client.actionToken.create({
          data: {
            organisationId: rental.organisationId,
            rentalId: rental.id,
            purpose: "MANAGE_RENTAL",
            tokenHash: hashToken(token),
            expiresAt: new Date(
              now.getTime() + MANAGE_TOKEN_TTL_HOURS * 3_600_000
            ),
          },
          select: { id: true },
        });

        const message = rentalEndingMail({
          firstName: rental.customer.firstName,
          carModel: rental.car.model,
          plate: rental.car.plate,
          endAt: rental.endAt,
          language: languageOf(rental),
          manageUrl: manageUrl(baseUrl, token),
        });

        try {
          await sendMail(mail, { to: rental.customer.email, ...message });
        } catch (error) {
          // The token has to be created before the send, because the email
          // carries its link. If the send then fails, nobody will ever hold
          // this token — so withdraw it rather than leaving a live
          // credential in the table for a fortnight.
          await client.actionToken.delete({ where: { id: minted.id } });
          throw error;
        }
      }
    );

    if (sent) {
      await client.rentalEvent.create({
        data: { rentalId: rental.id, type: "reminder.sent" },
      });
      count += 1;
    }
  }

  return count;
}

// ---------------------------------------------------------------------
// 2–4. Weekly charges, ported from the old repo's issue/remind/alert passes.
// ---------------------------------------------------------------------

/**
 * The rental statuses whose charges are still chased.
 *
 * RETURN_SUBMITTED is in the list and that is the whole point of the list.
 * From Phase 4 the renter can move their own rental into it by submitting the
 * return form, and money owed for a week already driven does not stop being
 * owed because the car is back — so filtering on ACTIVE alone would let a
 * renter switch off their own payment reminders.
 *
 * COMPLETED is deliberately absent: closing a rental is the office's own act,
 * and stopping the chasing is part of what they mean by it.
 */
const CHARGEABLE_RENTAL_STATUSES = ["ACTIVE", "RETURN_SUBMITTED"] as const;

export async function weeklyChargePass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.charge.findMany({
    where: {
      status: "SCHEDULED",
      rental: { status: { in: [...CHARGEABLE_RENTAL_STATUSES] } },
    },
    include: { rental: { include: rentalInclude } },
  });

  let count = 0;

  for (const charge of candidates) {
    if (!isDueForChargeRequest(charge, now)) continue;

    const { rental } = charge;
    const reference = `${rental.car.plate} W${charge.weekNumber}`;

    // Claim the transition BEFORE talking to the provider. The provider call is
    // the one step here that is not idempotent — a real processor would issue
    // two invoices for two concurrent runs — so the conditional update has to
    // be what gates it, not what records it afterwards.
    const claimed = await client.charge.updateMany({
      where: { id: charge.id, status: "SCHEDULED" },
      data: { status: "REQUESTED", requestedAt: now },
    });
    if (claimed.count === 0) continue;

    let request: { url: string; providerRef: string | null };
    try {
      request = await getPaymentProvider().createRequest({
        amountCents: charge.amountCents,
        currency: charge.currency,
        reference,
        description: `${rental.car.model} — week ${charge.weekNumber}`,
      });
    } catch (error) {
      // The charge is already REQUESTED, which is true — it is owed. Fall back
      // to the standing payment page so the renter can still pay, and let the
      // office reconcile by reference.
      console.error(
        `[scheduler] payment request failed for charge ${charge.id}:`,
        error
      );
      request = { url: PAYMENT_URL, providerRef: null };
    }

    await client.charge.update({
      where: { id: charge.id },
      data: { paymentUrl: request.url, providerRef: request.providerRef },
    });

    const sent = await sendOnce(
      client,
      {
        organisationId: charge.organisationId,
        rentalId: rental.id,
        kind: "CHARGE_REQUESTED",
        dedupeKey: weekDedupeKey(charge.weekNumber),
        to: rental.customer.email,
      },
      now,
      async () => {
        if (!mail) throw new Error("mail-not-configured");
        const message = chargeDueMail({
          firstName: rental.customer.firstName,
          carModel: rental.car.model,
          plate: rental.car.plate,
          weekNumber: charge.weekNumber,
          amountCents: charge.amountCents,
          paymentUrl: request.url,
          reference,
          language: languageOf(rental),
          isReminder: false,
        });
        await sendMail(mail, { to: rental.customer.email, ...message });
      }
    );

    // Counted whether or not the email landed. The charge is genuinely
    // requested — the link exists and the office can quote it — and
    // mailRetryPass owns the undelivered message from here.
    void sent;
    count += 1;
  }

  return count;
}

export async function chargeReminderPass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.charge.findMany({
    where: {
      status: "REQUESTED",
      rental: { status: { in: [...CHARGEABLE_RENTAL_STATUSES] } },
    },
    include: { rental: { include: rentalInclude } },
  });

  let count = 0;

  for (const charge of candidates) {
    if (!isDueForChargeReminder(charge, now, REMIND_AFTER_HOURS)) continue;

    const { rental } = charge;

    await sendOnce(
      client,
      {
        organisationId: charge.organisationId,
        rentalId: rental.id,
        kind: "CHARGE_REMINDER",
        dedupeKey: weekDedupeKey(charge.weekNumber),
        to: rental.customer.email,
      },
      now,
      async () => {
        if (!mail) throw new Error("mail-not-configured");
        const message = chargeDueMail({
          firstName: rental.customer.firstName,
          carModel: rental.car.model,
          plate: rental.car.plate,
          weekNumber: charge.weekNumber,
          amountCents: charge.amountCents,
          // Stored when the charge was requested. The fallback matters only
          // for rows written before paymentUrl existed.
          paymentUrl: charge.paymentUrl ?? PAYMENT_URL,
          reference: `${rental.car.plate} W${charge.weekNumber}`,
          language: languageOf(rental),
          isReminder: true,
        });
        await sendMail(mail, { to: rental.customer.email, ...message });
      }
    );

    const updated = await client.charge.updateMany({
      where: { id: charge.id, status: "REQUESTED" },
      data: { status: "REMINDED", remindedAt: now },
    });
    count += updated.count;
  }

  return count;
}

export async function chargeOverduePass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.charge.findMany({
    where: {
      status: "REMINDED",
      rental: { status: { in: [...CHARGEABLE_RENTAL_STATUSES] } },
    },
    include: { rental: { include: rentalInclude } },
  });

  let count = 0;

  for (const charge of candidates) {
    if (!isDueForChargeOverdue(charge, now, ALERT_AFTER_HOURS)) continue;

    const { rental } = charge;

    await sendOnce(
      client,
      {
        organisationId: charge.organisationId,
        rentalId: rental.id,
        kind: "CHARGE_OVERDUE",
        dedupeKey: weekDedupeKey(charge.weekNumber),
        to: mail?.office ?? "office",
      },
      now,
      async () => {
        if (!mail) throw new Error("mail-not-configured");
        const message = officeAlertMail({
          kind: "chargeOverdue",
          renterName: renterName(rental.customer),
          renterEmail: rental.customer.email,
          renterPhone: rental.customer.phone,
          carModel: rental.car.model,
          plate: rental.car.plate,
          endAt: rental.endAt,
          detail: `Woche ${charge.weekNumber}, Betrag in Rappen: ${charge.amountCents}`,
        });
        await sendMail(mail, {
          to: mail.office,
          replyTo: rental.customer.email,
          ...message,
        });
      }
    );

    const updated = await client.charge.updateMany({
      where: { id: charge.id, status: "REMINDED" },
      data: { status: "OVERDUE", officeAlertedAt: now },
    });
    count += updated.count;
  }

  return count;
}

// ---------------------------------------------------------------------
// 5. The car is late.
// ---------------------------------------------------------------------

export async function rentalOverduePass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.rental.findMany({
    where: { status: "ACTIVE", endAt: { lt: now } },
    include: rentalInclude,
  });

  let count = 0;

  for (const rental of candidates) {
    if (!isRentalOverdue(rental, now)) continue;

    const sent = await sendOnce(
      client,
      {
        organisationId: rental.organisationId,
        rentalId: rental.id,
        kind: "RENTAL_OVERDUE",
        dedupeKey: endAtDedupeKey(rental.endAt),
        to: mail?.office ?? "office",
      },
      now,
      async () => {
        if (!mail) throw new Error("mail-not-configured");
        const message = officeAlertMail({
          kind: "overdue",
          renterName: renterName(rental.customer),
          renterEmail: rental.customer.email,
          renterPhone: rental.customer.phone,
          carModel: rental.car.model,
          plate: rental.car.plate,
          endAt: rental.endAt,
        });
        await sendMail(mail, {
          to: mail.office,
          replyTo: rental.customer.email,
          ...message,
        });
      }
    );

    if (sent) count += 1;
  }

  return count;
}

// ---------------------------------------------------------------------
// 6. The mitigation both earlier specs promised for SMTP-from-serverless.
// ---------------------------------------------------------------------

export async function mailRetryPass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;
  if (!mail) return 0;

  const staleBefore = new Date(now.getTime() - RETRY_MIN_AGE_HOURS * 3_600_000);

  const stuck = await client.notification.findMany({
    where: {
      sentAt: null,
      attempts: { lt: MAX_MAIL_ATTEMPTS },
      createdAt: { lte: staleBefore },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let count = 0;

  for (const row of stuck) {
    // Deliberately not rebuilt from the rental: re-deriving the body could
    // produce a different message from the one that was claimed, and this pass
    // exists to deliver *that* decision, not to make a new one. So the retry
    // is a short notice to the office that a message could not be delivered,
    // which is more useful than a stale reminder to a renter.
    try {
      await sendMail(mail, {
        to: mail.office,
        subject: `Zustellung fehlgeschlagen: ${row.kind}`,
        text: [
          `Eine automatische Nachricht konnte nicht zugestellt werden.`,
          "",
          `Art:        ${row.kind}`,
          `Empfänger:  ${row.to}`,
          `Versuche:   ${row.attempts}`,
          `Fehler:     ${row.error ?? "unbekannt"}`,
          `Miete:      ${row.rentalId}`,
          "",
          `Bitte manuell nachfassen.`,
        ].join("\n"),
      });
      // sentAt stops the retries, but the original message was never
      // delivered — only the office was told. Say so on the row rather
      // than leaving it claiming a delivery that did not happen.
      await client.notification.update({
        where: { id: row.id },
        data: {
          sentAt: now,
          attempts: { increment: 1 },
          error: `escalated to office; not delivered to ${row.to}`,
        },
      });
      count += 1;
    } catch (error) {
      await client.notification.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          error: String(error).slice(0, 500),
        },
      });
    }
  }

  return count;
}

// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// 7. The annual technical inspection (MFK).
//
// Unlike every pass above it, this one is about a car rather than a rental,
// which is why it claims its send through carNotify.ts — see the note there
// about why a nullable rentalId would have broken the idempotency silently.
// ---------------------------------------------------------------------

export async function mfkDuePass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;
  const { to } = mfkDueWindow(now);

  // The coarse filter matches the index on [organisationId, mfkDate]. Open at
  // the bottom on purpose: an inspection date that went by last month still
  // needs acting on, and a lower bound would let such a car slip back onto the
  // road unnoticed.
  const cars = await client.car.findMany({
    where: {
      mfkDate: { not: null, lte: to },
      // A retired car is already off the road, and moving it to maintenance
      // would misreport why — the office retired it deliberately.
      status: { in: ["available", "rented"] },
    },
    orderBy: { mfkDate: "asc" },
    select: {
      id: true,
      organisationId: true,
      model: true,
      plate: true,
      status: true,
      mfkDate: true,
      rentals: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        orderBy: { startAt: "desc" },
        take: 1,
        select: {
          endAt: true,
          customer: {
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
    },
  });

  let warned = 0;

  for (const car of cars) {
    const mfkDate = car.mfkDate;
    if (!mfkDate) continue;
    // The guard repeats what the query filtered on, so the calendar rule lives
    // in one pure function rather than half in SQL.
    if (!isMfkDueSoon(mfkDate, now)) continue;

    const rental = car.rentals[0] ?? null;

    /**
     * Take an idle car off the road.
     *
     * A conditional updateMany whose WHERE repeats the precondition, exactly
     * as the status transitions above do: it can only succeed on a car that is
     * still `available`, so it can never clobber a `rented` one and never
     * double-applies. Run on every pass rather than only alongside the mail —
     * a car freed without its inspection being recorded is still a car that
     * must not be rented, and re-asserting is the honest answer. The way out
     * is entering the new date.
     */
    let blocked = false;
    if (car.status === "available") {
      const moved = await client.car.updateMany({
        where: { id: car.id, status: "available" },
        data: { status: "maintenance" },
      });
      blocked = moved.count > 0;
    }

    if (!mail) continue;

    const message = mfkDueMail({
      carModel: car.model,
      plate: car.plate,
      mfkDate,
      expired: isMfkExpired(mfkDate, now),
      rental: rental
        ? {
            renterName: renterName(rental.customer),
            renterEmail: rental.customer.email,
            renterPhone: rental.customer.phone,
            endAt: rental.endAt,
          }
        : null,
      blocked,
    });

    const sent = await sendOnceForCar(
      client,
      {
        organisationId: car.organisationId,
        carId: car.id,
        kind: "MFK_DUE",
        dedupeKey: mfkDedupeKey(mfkDate),
        to: mail.office,
      },
      now,
      () => sendMail(mail, { to: mail.office, ...message })
    );

    if (sent) warned += 1;
  }

  return warned;
}

// ---------------------------------------------------------------------
// 8. The waiting list.
//
// The one pass that writes to somebody who is not a customer, and the only
// one whose trigger is a *state* rather than a date: a car becoming free is
// not an event this system observes. A rental ends when somebody presses
// "close", a car leaves the garage by an edit, and a new car arrives through
// the fleet form — three unrelated paths, none of which should have to
// remember to mail a waiting list.
//
// So the pass asks the question that is always answerable instead: is
// anything available right now, and is anybody still waiting to hear it. That
// makes it correct however the car became free, including by a route added
// later that nobody thought to wire up.
// ---------------------------------------------------------------------

export async function availabilityPass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail, baseUrl } = deps;

  // Nothing free, nothing to say. Asked first because it is one indexed count
  // and it is false on most days the list is non-empty.
  const available = await client.car.count({ where: { status: "available" } });
  if (available === 0) return 0;

  const waiting = await client.availabilityAlert.findMany({
    where: { notifiedAt: null, cancelledAt: null },
    // Longest wait first. If the batch cap truncates the run, the people who
    // have been waiting since last week hear before today's arrivals.
    orderBy: { createdAt: "asc" },
    take: AVAILABILITY_BATCH,
    select: {
      id: true,
      email: true,
      language: true,
      unsubscribeToken: true,
    },
  });

  if (waiting.length === 0) return 0;

  // Reported rather than silent: a fleet that is free and a list that is
  // waiting, with no mailer configured, is a state somebody should fix.
  if (!mail) {
    console.warn(
      `[scheduler] ${waiting.length} availability alert(s) waiting and no mailer configured`
    );
    return 0;
  }

  let sent = 0;

  for (const alert of waiting) {
    /**
     * The claim, before the send.
     *
     * A conditional updateMany whose WHERE repeats `notifiedAt: null`, exactly
     * as the status transitions above do — and for a sharper reason here.
     * Unlike a Notification row, which is inserted and so races on a unique
     * index, this row already exists; two concurrent runs would both read it
     * as waiting. Stamping it first means the loser's update matches nothing
     * and it does not send.
     *
     * The cost of claiming first is that a send which then fails leaves the
     * row marked notified, and that person waits for the next car rather than
     * being retried. That is the right way round: this is an unsolicited-ish
     * courtesy mail, and writing to somebody twice is a worse failure than
     * writing to them once, late.
     */
    const claimed = await client.availabilityAlert.updateMany({
      where: { id: alert.id, notifiedAt: null, cancelledAt: null },
      data: { notifiedAt: now },
    });
    if (claimed.count === 0) continue;

    const message = availabilityMail({
      language: asRentalLanguage(alert.language),
      available,
      bookUrl: `${baseUrl.replace(/\/$/, "")}/book/`,
      unsubscribeUrl: unsubscribeUrl(baseUrl, alert.unsubscribeToken),
    });

    try {
      await sendMail(mail, { to: alert.email, ...message });
      sent += 1;
    } catch (error) {
      // Logged, never rethrown: one bad address must not stop the rest of the
      // list, and must not fail a cron whose other six passes worked.
      console.error("[scheduler] availability mail failed:", error);
    }
  }

  return sent;
}

export async function runDailyPasses(
  deps: Omit<SchedulerDeps, "mail"> & { mail?: LifecycleMailConfig | null }
): Promise<PassSummary> {
  const full: SchedulerDeps = {
    ...deps,
    mail: deps.mail === undefined ? readLifecycleMailConfig() : deps.mail,
  };

  return {
    reminded: await preEndReminderPass(full),
    charged: await weeklyChargePass(full),
    chargeReminded: await chargeReminderPass(full),
    chargeOverdue: await chargeOverduePass(full),
    rentalOverdue: await rentalOverduePass(full),
    mfkDue: await mfkDuePass(full),
    availabilityNotified: await availabilityPass(full),
    mailRetried: await mailRetryPass(full),
  };
}
