/**
 * The fines pipeline with production's parts: the database, the bucket, the
 * free reader, SMTP. Routes and the scheduler call these; tests assemble
 * their own deps.
 */

import { prisma } from "@/lib/db";
import { readLifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { getAssetStore } from "@/lib/storage";
import type { FineDeps } from "./attach";
import { notifyRenter, type NotifyDeps } from "./notify";
import { processFineDocument } from "./process";
import { freeReader } from "./reader";

export function siteUrl(): string {
  return process.env.SITE_URL || "https://www.zuriauto.ch";
}

export function notifyDeps(now: Date = new Date()): NotifyDeps {
  return {
    client: prisma,
    store: getAssetStore(),
    now,
    mail: readLifecycleMailConfig(),
    baseUrl: siteUrl(),
  };
}

export function fineDeps(now: Date = new Date()): FineDeps {
  const notify = notifyDeps(now);
  return {
    client: prisma,
    store: notify.store,
    reader: freeReader,
    now,
    notify: async (fineId, reason) => {
      await notifyRenter(notify, fineId, reason);
    },
  };
}

export function runFineDocument(documentId: string) {
  return processFineDocument(fineDeps(), documentId);
}
