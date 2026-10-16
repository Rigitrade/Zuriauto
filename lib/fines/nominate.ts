/**
 * Naming the driver of a police fine to the authority that issued it.
 *
 * The owner's decision of 16.10.2026, replacing "the renter pays and proves it"
 * for fines from the police: chasing payment screenshots cost the office more
 * than the fines were worth, and the authorities offer the alternative on the
 * letter itself — name the driver, and they deal with them. Private issuers
 * (parking companies) cannot be answered that way and keep the renter path.
 *
 * Sent automatically only when `decideNomination` finds nothing in doubt; a
 * fine it holds goes to the office's review list with the reason, and the
 * office sends it from there (`nominateDriver` with `to`), which also confirms
 * the address for that authority's next letter.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { asRentalLanguage } from "@/lib/rental/labels";
import { isPlaceholderEmail } from "@/lib/rental/placeholder";
import type { NotifyReason } from "./attach";
import { recordEvent, type Actor } from "./events";
import { driverNominationMail, renterNamedMail } from "./mail";
import {
  decideNomination,
  driverIsComplete,
  emailsOnLetter,
  isEmailAddress,
  nominationEnabled,
  type Driver,
  type NominationDecision,
} from "./nomination";
import { alertOffice, notifyRenter, sendFineOnce, type NotifyDeps } from "./notify";
import { burnFineTokens } from "./token";

export type NominationOutcome = "named" | "held" | "already" | "failed";

async function loadForNomination(client: PrismaClient, fineId: string) {
  return client.fine.findUniqueOrThrow({
    where: { id: fineId },
    include: {
      car: { select: { plate: true, model: true } },
      customer: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          street: true,
          postalCode: true,
          city: true,
          country: true,
          phone: true,
          email: true,
        },
      },
      rental: {
        select: {
          contracts: { where: { kind: "PICKUP" }, select: { gtcLanguage: true }, take: 1 },
        },
      },
      authority: { select: { id: true, email: true, confirmedAt: true } },
      documents: { select: { ocrText: true } },
    },
  });
}

type LoadedFine = Awaited<ReturnType<typeof loadForNomination>>;

/** The authority this fine's letters come from, created on first sight. */
async function authorityOf(client: PrismaClient, fine: LoadedFine) {
  if (fine.authority) return fine.authority;
  if (!fine.issuerIban) return null;
  const authority = await client.fineAuthority.upsert({
    where: { organisationId_iban: { organisationId: fine.organisationId, iban: fine.issuerIban } },
    create: {
      organisationId: fine.organisationId,
      iban: fine.issuerIban,
      name: fine.issuerName ?? fine.issuerIban,
    },
    update: {},
    select: { id: true, email: true, confirmedAt: true },
  });
  await client.fine.update({ where: { id: fine.id }, data: { authorityId: authority.id } });
  return authority;
}

/**
 * Names the driver, or holds the fine for the office with the reason.
 *
 * Without `to`, the address is decided by `decideNomination`. With `to` — the
 * office sending from the review list — that address is used and confirmed
 * for the authority, so its next letter goes out without anyone looking. The
 * driver and the Busse-Nr. are checked either way: the office cannot name a
 * driver the authority could not reach.
 */
export async function nominateDriver(
  deps: NotifyDeps,
  fineId: string,
  options: { to?: string; by?: Actor; dedupeKey?: string } = {}
): Promise<NominationOutcome> {
  const { client, now } = deps;
  const fine = await loadForNomination(client, fineId);
  const authority = await authorityOf(client, fine);
  const emails = [
    ...new Set(fine.documents.flatMap((document) => emailsOnLetter(document.ocrText ?? ""))),
  ];
  const driver: Driver | null = fine.customer;

  let decision: NominationDecision;
  if (options.to !== undefined) {
    const to = options.to.trim().toLowerCase();
    if (!isEmailAddress(to)) return "held";
    decision = !driverIsComplete(driver)
      ? { send: false, reason: "NOMINATION_DRIVER_INCOMPLETE", suggestion: null }
      : !fine.fineNumber?.trim()
        ? { send: false, reason: "NOMINATION_NO_NUMBER", suggestion: null }
        : { send: true, to };
  } else {
    decision = decideNomination({
      driver,
      fineNumber: fine.fineNumber,
      iban: fine.issuerIban,
      emailsOnLetter: emails,
      confirmedEmail: authority?.confirmedAt ? authority.email : null,
    });
  }

  if (!decision.send) {
    await client.fine.update({
      where: { id: fineId },
      data: {
        status: "NEEDS_REVIEW",
        reviewReason: decision.reason,
        authorityEmailRead: decision.suggestion,
      },
    });
    await recordEvent(client, fineId, "nomination.held", {
      reason: decision.reason,
      emailsOnLetter: emails,
    }, options.by ?? null, now);
    return "held";
  }

  // Confirmed before the send, by the person who typed it: the address is
  // theirs to vouch for whether or not this one message gets through.
  if (options.to !== undefined && authority && options.by) {
    await client.fineAuthority.update({
      where: { id: authority.id },
      data: { email: decision.to, confirmedAt: now, confirmedById: options.by.id },
    });
  }

  const to = decision.to;
  const car = fine.car!;
  const customer = fine.customer!;
  const outcome = await sendFineOnce(
    deps,
    {
      fineId,
      kind: "DRIVER_NOMINATION",
      dedupeKey: options.dedupeKey ?? "nomination",
      to,
    },
    async () => ({
      to,
      // The office sees every nomination in its own inbox, and the
      // authority's questions reach a person rather than the sender address.
      cc: deps.mail!.office,
      replyTo: deps.mail!.office,
      ...driverNominationMail({
        fineNumber: fine.fineNumber!.trim(),
        plate: car.plate,
        violationAt: fine.violationAt!,
        timeKnown: fine.violationTimeKnown,
        driver: {
          ...customer,
          birthDate: customer.birthDate,
          email: isPlaceholderEmail(customer.email) ? null : customer.email,
        },
      }),
    })
  );

  if (outcome === "already") return "already";
  if (outcome === "failed") {
    await client.fine.update({
      where: { id: fineId },
      data: { status: "NEEDS_REVIEW", reviewReason: "MAIL_FAILED" },
    });
    await recordEvent(client, fineId, "nomination.mail-failed", { to }, options.by ?? null, now);
    await alertOffice(deps, fine, "mailFailed", `Lenkerangabe an ${to}`);
    return "failed";
  }

  await client.fine.update({
    where: { id: fineId },
    data: {
      status: "DRIVER_NAMED",
      reviewReason: null,
      driverNamedAt: now,
      driverNamedTo: to,
      // No fee for a fine the authority now takes up with the renter (owner's
      // decision of 16.10.2026). One already paid stays paid.
      ...(fine.handlingFeeStatus === "DUE"
        ? { handlingFeeCents: 0, handlingFeeStatus: "NONE" as const }
        : {}),
    },
  });
  // A payment link from an earlier renter notice must stop working: there is
  // nothing left to prove to us.
  await burnFineTokens(client, fineId, now);
  await recordEvent(client, fineId, "driver.named", { to }, options.by ?? null, now);

  await tellRenter(deps, fine);
  return "named";
}

/** The renter's notice that they were named. Its failure never undoes the
 *  nomination, which is what counts; the office is told instead. */
async function tellRenter(deps: NotifyDeps, fine: LoadedFine): Promise<void> {
  const customer = fine.customer!;
  if (isPlaceholderEmail(customer.email)) return;
  const outcome = await sendFineOnce(
    deps,
    { fineId: fine.id, kind: "RENTER_NAMED", dedupeKey: "named", to: customer.email },
    async () => ({
      to: customer.email,
      ...renterNamedMail({
        language: asRentalLanguage(fine.rental?.contracts[0]?.gtcLanguage),
        firstName: customer.firstName,
        plate: fine.car!.plate,
        carModel: fine.car!.model,
        violationAt: fine.violationAt!,
        timeKnown: fine.violationTimeKnown,
        location: fine.location,
        offence: { de: fine.offenceTextDe ?? "—", en: fine.offenceTextEn ?? "—" },
        amountCents: fine.amountCents,
        issuerName: fine.issuerName,
        fineNumber: fine.fineNumber!.trim(),
      }),
    })
  );
  if (outcome === "failed") {
    await recordEvent(deps.client, fine.id, "renter.named-mail-failed", { to: customer.email }, null, deps.now);
    await alertOffice(deps, fine, "mailFailed", `Benachrichtigung an den Mieter (${customer.email}); der Lenker wurde der Behörde gemeldet.`);
  }
}

/**
 * A new fine that matched cleanly: named to the police, or sent to the
 * renter to pay — the first for a police letter while nomination is on.
 */
export async function deliverNewFine(deps: NotifyDeps, fineId: string): Promise<void> {
  const fine = await deps.client.fine.findUniqueOrThrow({
    where: { id: fineId },
    select: { issuerKind: true },
  });
  if (nominationEnabled() && fine.issuerKind === "POLICE") {
    await nominateDriver(deps, fineId);
    return;
  }
  await notifyRenter(deps, fineId, "notice");
}

/** What every automatic path calls: a new fine is delivered, the rest of the
 *  renter's mail is unchanged. */
export async function deliverFine(
  deps: NotifyDeps,
  fineId: string,
  reason: NotifyReason
): Promise<void> {
  if (reason === "notice") return deliverNewFine(deps, fineId);
  await notifyRenter(deps, fineId, reason);
}
