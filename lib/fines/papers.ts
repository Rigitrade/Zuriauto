/**
 * The rental's signed papers, sent to an authority with the driver's name.
 *
 * The owner's decision of 18.10.2026: the pickup contract and the return
 * protocol, as the renter received them. Between them they show who had the
 * car and from when to when, and the contract's copies of the ID and licence
 * answer what the authority's driver form asks beyond the email — place of
 * origin, where and when the licence was issued, its categories.
 *
 * A returning renter's contract may only refer to documents photographed at
 * an earlier handover (`documentsReusedFromId`); that earlier contract goes
 * too, or the authority would get the reference without the copies.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import type { AssetStore } from "@/lib/storage";
import { formatFineMoment } from "./mail";
import type { SentMail } from "./notify";

export interface Paper {
  contractNumber: string;
  filename: string;
  /** How the email names it, so the authority knows which file holds what. */
  line: string;
  pdfKey: string | null;
}

/**
 * Reuse can chain — a third handover reusing the second's documents, which
 * reused the first's — and only the first contract has the photographs in its
 * PDF. Bounded, so a chain that loops can never hang a send.
 */
const MAX_REUSE_HOPS = 10;

const ID_COPIES = "mit Kopien von Ausweis und Führerausweis";

const CONTRACT_FIELDS = {
  id: true,
  kind: true,
  contractNumber: true,
  signedAt: true,
  pdfKey: true,
  documentsReusedFromId: true,
} as const;

/** The contract whose PDF holds the photographs a reuse refers to. */
async function photographedContract(client: PrismaClient, id: string) {
  const find = (contractId: string) =>
    client.contract.findUnique({ where: { id: contractId }, select: CONTRACT_FIELDS });
  let current = await find(id);
  for (let hop = 0; current?.documentsReusedFromId && hop < MAX_REUSE_HOPS; hop++) {
    current = await find(current.documentsReusedFromId);
  }
  return current && !current.documentsReusedFromId ? current : null;
}

/** What goes to the authority for this rental, in the order it is listed. */
export async function papersFor(client: PrismaClient, rentalId: string | null): Promise<Paper[]> {
  if (!rentalId) return [];
  const contracts = await client.contract.findMany({
    where: { rentalId },
    orderBy: { signedAt: "asc" },
    select: CONTRACT_FIELDS,
  });

  const papers: Paper[] = [];
  const listed = new Set<string>();
  const add = (
    contract: { id: string; contractNumber: string; pdfKey: string | null },
    filename: string,
    line: string
  ) => {
    if (listed.has(contract.id)) return;
    listed.add(contract.id);
    papers.push({ contractNumber: contract.contractNumber, filename, line, pdfKey: contract.pdfKey });
  };
  const day = (at: Date) => formatFineMoment(at, false);

  for (const contract of contracts.filter((c) => c.kind === "PICKUP")) {
    const reused = contract.documentsReusedFromId;
    add(
      contract,
      `mietvertrag-${contract.contractNumber}.pdf`,
      `Mietvertrag ${contract.contractNumber} vom ${day(contract.signedAt)}${reused ? "" : `, ${ID_COPIES}`}`
    );
    const source = reused ? await photographedContract(client, reused) : null;
    if (source) {
      add(
        source,
        `mietvertrag-${source.contractNumber}.pdf`,
        `Mietvertrag ${source.contractNumber} vom ${day(source.signedAt)}, ${ID_COPIES} (frühere Miete)`
      );
    }
  }
  for (const contract of contracts.filter((c) => c.kind === "RETURN_ADDENDUM")) {
    add(
      contract,
      `rueckgabeprotokoll-${contract.contractNumber}.pdf`,
      `Rückgabeprotokoll ${contract.contractNumber} vom ${day(contract.signedAt)}`
    );
  }
  return papers;
}

/**
 * The papers' files from the store. One that is not there is left out and
 * reported, not allowed to stop the nomination: the driver's details are in
 * the email itself, and the office, copied on every one, sees what went.
 */
export async function loadPapers(store: AssetStore, papers: Paper[]) {
  const attachments: NonNullable<SentMail["attachments"]> = [];
  const sent: Paper[] = [];
  const missing: string[] = [];
  for (const paper of papers) {
    const object = paper.pdfKey ? await store.get(paper.pdfKey) : null;
    if (!object) {
      missing.push(paper.contractNumber);
      continue;
    }
    attachments.push({ filename: paper.filename, content: object.body, contentType: "application/pdf" });
    sent.push(paper);
  }
  return { attachments, sent, missing };
}
