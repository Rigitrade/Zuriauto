import { prisma } from "@/lib/db";
import {
  readLifecycleMailConfig,
  extensionConfirmedMail,
  officeAlertMail,
  sendMail,
} from "./lifecycleMail";
import { asRentalLanguage } from "./labels";
import { endAtDedupeKey, sendOnce } from "./notify";

/**
 * The notifications the two renter actions send.
 *
 * Kept out of `manage.ts` so that module stays about the database transaction
 * and can be tested without mocking mail. Both sends go through `sendOnce`, so
 * a renter who double-taps a button does not send the office two alerts.
 *
 * Failures here are deliberately not fatal. The renter's action is already
 * committed, and telling them it failed would invite them to do it again — the
 * notification row records the failure and mailRetryPass picks it up.
 */

interface RentalForNotice {
  id: string;
  organisationId: string;
  endAt: Date;
  customerFirstName: string;
  customerEmail: string;
  carModel: string;
  carPlate: string;
  language: string;
}

export async function notifyReturnIntent(
  rental: RentalForNotice & { customerName: string; customerPhone: string },
  now: Date
): Promise<void> {
  const mail = readLifecycleMailConfig();
  if (!mail) return;

  await sendOnce(
    prisma,
    {
      organisationId: rental.organisationId,
      rentalId: rental.id,
      kind: "RETURN_INTENT",
      dedupeKey: endAtDedupeKey(rental.endAt),
      to: mail.office,
    },
    now,
    async () => {
      const message = officeAlertMail({
        kind: "returnIntent",
        renterName: rental.customerName,
        renterEmail: rental.customerEmail,
        renterPhone: rental.customerPhone,
        carModel: rental.carModel,
        plate: rental.carPlate,
        endAt: rental.endAt,
      });
      await sendMail(mail, {
        to: mail.office,
        replyTo: rental.customerEmail,
        ...message,
      });
    }
  );
}

export async function notifyExtension(
  rental: RentalForNotice & { customerName: string; customerPhone: string },
  detail: { weeks: number; newEndAt: Date; amountCents: number; paymentUrl: string },
  now: Date
): Promise<void> {
  const mail = readLifecycleMailConfig();
  if (!mail) return;

  // The renter's confirmation, with the amount and the pay link.
  await sendOnce(
    prisma,
    {
      organisationId: rental.organisationId,
      rentalId: rental.id,
      kind: "EXTENSION_CONFIRMED",
      // The new end date, so a second extension later is a distinct send.
      dedupeKey: endAtDedupeKey(detail.newEndAt),
      to: rental.customerEmail,
    },
    now,
    async () => {
      const message = extensionConfirmedMail({
        firstName: rental.customerFirstName,
        carModel: rental.carModel,
        plate: rental.carPlate,
        weeksAdded: detail.weeks,
        newEndAt: detail.newEndAt,
        amountCents: detail.amountCents,
        paymentUrl: detail.paymentUrl,
        language: asRentalLanguage(rental.language),
      });
      await sendMail(mail, { to: rental.customerEmail, ...message });
    }
  );

  // And the office copy. A different kind, so it has its own dedupe row.
  await sendOnce(
    prisma,
    {
      organisationId: rental.organisationId,
      rentalId: rental.id,
      kind: "RENTAL_OVERDUE",
      dedupeKey: `extension-${endAtDedupeKey(detail.newEndAt)}`,
      to: mail.office,
    },
    now,
    async () => {
      const message = officeAlertMail({
        kind: "extension",
        renterName: rental.customerName,
        renterEmail: rental.customerEmail,
        renterPhone: rental.customerPhone,
        carModel: rental.carModel,
        plate: rental.carPlate,
        endAt: detail.newEndAt,
        detail: `Verlängerung um ${detail.weeks} Woche(n). Betrag in Rappen: ${detail.amountCents}`,
      });
      await sendMail(mail, {
        to: mail.office,
        replyTo: rental.customerEmail,
        ...message,
      });
    }
  );
}
