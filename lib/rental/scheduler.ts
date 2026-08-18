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
  officeAlertMail,
  readLifecycleMailConfig,
  rentalEndingMail,
  sendMail,
  type LifecycleMailConfig,
} from "./lifecycleMail";
import { endAtDedupeKey, sendOnce, weekDedupeKey } from "./notify";
import {
  endingSoonWindow,
  isDueForChargeOverdue,
  isDueForChargeReminder,
  isDueForChargeRequest,
  isRentalEndingSoon,
  isRentalOverdue,
} from "./passes";

export interface PassSummary {
  reminded: number;
  charged: number;
  chargeReminded: number;
  chargeOverdue: number;
  rentalOverdue: number;
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

export async function weeklyChargePass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.charge.findMany({
    where: { status: "SCHEDULED", rental: { status: "ACTIVE" } },
    include: { rental: { include: rentalInclude } },
  });

  let count = 0;

  for (const charge of candidates) {
    if (!isDueForChargeRequest(charge, now)) continue;

    const { rental } = charge;
    const reference = `${rental.car.plate} W${charge.weekNumber}`;

    const request = await getPaymentProvider().createRequest({
      amountCents: charge.amountCents,
      currency: charge.currency,
      reference,
      description: `${rental.car.model} — week ${charge.weekNumber}`,
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

    // The status moves whether or not the email landed. The charge is genuinely
    // requested — the payment link exists and the office can quote it — and
    // leaving it SCHEDULED would have the pass try again tomorrow while
    // mailRetryPass is already retrying the message.
    const updated = await client.charge.updateMany({
      where: { id: charge.id, status: "SCHEDULED" },
      data: {
        status: "REQUESTED",
        requestedAt: now,
        paymentUrl: request.url,
        providerRef: request.providerRef,
      },
    });

    if (updated.count > 0 || sent) count += 1;
  }

  return count;
}

export async function chargeReminderPass(deps: SchedulerDeps): Promise<number> {
  const { client, now, mail } = deps;

  const candidates = await client.charge.findMany({
    where: { status: "REQUESTED", rental: { status: "ACTIVE" } },
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
    where: { status: "REMINDED", rental: { status: "ACTIVE" } },
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
      await client.notification.update({
        where: { id: row.id },
        data: { sentAt: now, attempts: { increment: 1 } },
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
    mailRetried: await mailRetryPass(full),
  };
}
