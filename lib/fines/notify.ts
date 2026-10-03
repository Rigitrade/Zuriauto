/**
 * Telling people about a fine — once.
 *
 * Every send is claimed first by inserting a `FineNotification` row whose
 * key is (fine, kind, dedupe key), the scheduler's own pattern: two runs race
 * on the insert and one wins. A notice is sent once per fine, a reminder once
 * per reminder level.
 *
 * A renter mail that cannot be delivered — the server refuses it, or no
 * server is configured — puts the fine in front of the office (MAIL_FAILED)
 * and burns the link that never arrived.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { asRentalLanguage } from "@/lib/rental/labels";
import { sendMail, type LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import type { AssetStore } from "@/lib/storage";
import type { NotifyReason } from "./attach";
import { recordEvent } from "./events";
import {
  fineNoticeMail,
  fineReopenedMail,
  officeFineAlertMail,
  type FineMailContext,
  type OfficeFineAlertKind,
} from "./mail";
import { burnFineTokens, finePayUrl, issueFinePaymentToken } from "./token";

export interface SentMail {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
}

export interface NotifyDeps {
  client: PrismaClient;
  store: AssetStore;
  now: Date;
  mail: LifecycleMailConfig | null;
  baseUrl: string;
  /** Defaults to SMTP; tests capture instead. */
  send?: (config: LifecycleMailConfig, message: SentMail) => Promise<void>;
}

type FineNotificationKind =
  | "FINE_NOTICE"
  | "FINE_REMINDER"
  | "FINE_REOPENED"
  | "FINE_PAID"
  | "OFFICE_ALERT"
  | "OFFICE_DIGEST";

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

/** Claims, sends, records. True only when this call sent it. */
export async function sendFineOnce(
  deps: NotifyDeps,
  input: { fineId: string; kind: FineNotificationKind; dedupeKey: string; to: string },
  message: () => Promise<SentMail>
): Promise<"sent" | "already" | "failed"> {
  const { client, now, mail } = deps;
  if (!mail) return "failed";

  let claimId: string;
  try {
    claimId = (
      await client.fineNotification.create({
        data: { ...input, createdAt: now },
        select: { id: true },
      })
    ).id;
  } catch (error) {
    if (isUniqueViolation(error)) return "already";
    throw error;
  }

  try {
    await (deps.send ?? sendMail)(mail, await message());
    await client.fineNotification.update({
      where: { id: claimId },
      data: { sentAt: now, error: null, attempts: { increment: 1 } },
    });
    return "sent";
  } catch (error) {
    console.error(`[fines] ${input.kind} for fine ${input.fineId} failed:`, error);
    await client.fineNotification.update({
      where: { id: claimId },
      data: { error: String(error).slice(0, 500), attempts: { increment: 1 } },
    });
    return "failed";
  }
}

export function fineAdminUrl(baseUrl: string, fineId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/admin/fines/?fine=${fineId}`;
}

async function loadFine(client: PrismaClient, fineId: string) {
  return client.fine.findUniqueOrThrow({
    where: { id: fineId },
    include: {
      car: { select: { plate: true, model: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
      rental: {
        select: {
          contracts: { where: { kind: "PICKUP" }, select: { gtcLanguage: true }, take: 1 },
        },
      },
      documents: { select: { storageKey: true, uploadedAt: true }, orderBy: { uploadedAt: "asc" } },
    },
  });
}

type LoadedFine = Awaited<ReturnType<typeof loadFine>>;

async function letterAttachments(store: AssetStore, fine: LoadedFine, newestFirst: boolean) {
  const plate = (fine.car?.plate ?? "fahrzeug").replace(/\s/g, "");
  const documents = newestFirst ? [...fine.documents].reverse() : fine.documents;
  const attachments: SentMail["attachments"] = [];
  for (const [index, document] of documents.entries()) {
    const object = await store.get(document.storageKey);
    if (!object) continue;
    attachments.push({
      filename: index === 0 ? `busse-${plate}.pdf` : `busse-${plate}-${index + 1}.pdf`,
      content: object.body,
      contentType: "application/pdf",
    });
  }
  return attachments;
}

export async function alertOffice(
  deps: NotifyDeps,
  fine: LoadedFine,
  kind: OfficeFineAlertKind,
  detail?: string
): Promise<void> {
  if (!deps.mail) return;
  await sendFineOnce(
    deps,
    {
      fineId: fine.id,
      kind: "OFFICE_ALERT",
      dedupeKey: `${kind}-${fine.reminderLevel}`,
      to: deps.mail.office,
    },
    async () => ({
      to: deps.mail!.office,
      ...officeFineAlertMail({
        kind,
        plate: fine.car?.plate ?? "—",
        fineNumber: fine.fineNumber,
        renterName: fine.customer ? `${fine.customer.firstName} ${fine.customer.lastName}` : null,
        detail,
        fineUrl: fineAdminUrl(deps.baseUrl, fine.id),
      }),
    })
  );
}

export async function notifyRenter(
  deps: NotifyDeps,
  fineId: string,
  reason: NotifyReason
): Promise<void> {
  const { client, now } = deps;
  const fine = await loadFine(client, fineId);

  if (reason === "office") {
    await alertOffice(deps, fine, "closedReminder", "Eine Mahnung ist für diese Busse eingegangen.");
    return;
  }
  if (!fine.customer || !fine.car || !fine.rentalId || fine.violationAt === null) return;

  const kind: FineNotificationKind =
    reason === "notice" ? "FINE_NOTICE" : reason === "reminder" ? "FINE_REMINDER" : "FINE_REOPENED";
  const dedupeKey = reason === "notice" ? "notice" : `level-${fine.reminderLevel}`;
  const to = fine.customer.email;

  const outcome = await sendFineOnce(deps, { fineId, kind, dedupeKey, to }, async () => {
    const token = await issueFinePaymentToken(
      client,
      { id: fine.id, organisationId: fine.organisationId, rentalId: fine.rentalId!, dueDate: fine.dueDate },
      now
    );
    const ctx: FineMailContext = {
      language: asRentalLanguage(fine.rental?.contracts[0]?.gtcLanguage),
      firstName: fine.customer!.firstName,
      plate: fine.car!.plate,
      carModel: fine.car!.model,
      violationAt: fine.violationAt!,
      timeKnown: fine.violationTimeKnown,
      location: fine.location,
      offence: { de: fine.offenceTextDe ?? "—", en: fine.offenceTextEn ?? "—" },
      amountCents: fine.amountCents ?? 0,
      dueDate: fine.dueDate,
      issuerName: fine.issuerName,
      fineNumber: fine.fineNumber,
      feeCents: fine.handlingFeeStatus === "DUE" ? fine.handlingFeeCents : 0,
      payUrl: finePayUrl(deps.baseUrl, token),
      reminder: reason === "reminder" || fine.reminderLevel > 0,
    };
    const body = reason === "reopened" ? fineReopenedMail(ctx) : fineNoticeMail(ctx);
    return { to, ...body, attachments: await letterAttachments(deps.store, fine, reason !== "notice") };
  });

  if (outcome === "already") return;

  if (outcome === "failed") {
    await burnFineTokens(client, fineId, now);
    await client.fine.update({
      where: { id: fineId },
      data: { status: "NEEDS_REVIEW", reviewReason: "MAIL_FAILED" },
    });
    await recordEvent(client, fineId, "renter.mail-failed", { reason, to }, null, now);
    await alertOffice(deps, fine, "mailFailed", `Empfänger: ${to}`);
    return;
  }

  if (reason === "notice") {
    await client.fine.update({
      where: { id: fineId },
      data: { status: "NOTIFIED", reviewReason: null, notifiedAt: now },
    });
  } else if (reason === "reminder") {
    await client.fine.update({ where: { id: fineId }, data: { notifiedAt: now } });
  }
  await recordEvent(client, fineId, "renter.notified", { reason, to }, null, now);
  if (reason === "reopened") {
    await alertOffice(deps, fine, "reopened", "Der Absender meldet die Busse als unbezahlt.");
  }
}
