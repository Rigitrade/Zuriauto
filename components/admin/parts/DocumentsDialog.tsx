"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, ImageIcon, Lock } from "lucide-react";
import { Dialog } from "./Dialog";
import { day } from "@/components/admin/format";
import type { Labels, Rental } from "@/components/admin/types";

/**
 * The documents behind a rental — contract PDFs, identity images, signatures.
 *
 * Until this existed they were reachable only through the Cloudflare console.
 * When a traffic fine arrived and the office needed the contract plus the
 * licence for that date, that is where they went.
 *
 * Two things it deliberately does not do:
 *
 *  - **It does not show the images.** It lists what is on file and opens one
 *    when somebody asks. Rendering six thumbnails would mean fetching six
 *    passports — and logging six views — every time anybody glanced at a
 *    rental. The common question is "is the licence on file?", which this
 *    answers without anybody seeing it.
 *  - **It does not hide deleted ones.** A row that says the ID was checked
 *    and the image has since been deleted under the retention policy is a
 *    different fact from no row at all, and the office needs to tell them
 *    apart when somebody asks what was verified.
 */

interface AssetRow {
  id: string;
  kind: string;
  contentType: string;
  bytes: number;
  deletedAt: string | null;
}

interface ContractRow {
  id: string;
  kind: string;
  contractNumber: string;
  signedAt: string;
  hasPdf: boolean;
  assets: AssetRow[];
}

export function DocumentsDialog({
  rental,
  L,
  open,
  onClose,
}: {
  rental: Rental;
  L: Labels;
  open: boolean;
  onClose: () => void;
}) {
  const [contracts, setContracts] = useState<ContractRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Fetched when the dialog opens, not with the rentals list: this is a
  // per-rental question, and pulling it for every row would be a query per
  // rental to answer something nobody asked.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    fetch(`/api/admin/rentals/${rental.id}/documents/`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (!cancelled) setContracts(body.contracts as ContractRow[]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rental.id]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${L.docs.heading} · ${rental.customerName}`}
      closeLabel={L.rentals.cancel}
    >
      <div className="flex flex-col gap-4">
        {failed && (
          <p className="rounded-md bg-[var(--admin-crit-soft)] px-3 py-2 text-sm text-[var(--admin-crit)]">
            {L.errors.generic}
          </p>
        )}

        {contracts === null && !failed && (
          <p className="text-sm text-[var(--admin-faint)]">…</p>
        )}

        {contracts?.length === 0 && (
          <p className="text-sm text-[var(--admin-faint)]">{L.docs.none}</p>
        )}

        {contracts?.map((contract) => (
          <section key={contract.id}>
            <h3 className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
              <span>
                {contract.kind === "PICKUP" ? L.docs.contract : L.docs.returnProtocol}
              </span>
              <span className="font-mono text-[0.6875rem] normal-case tracking-normal">
                {contract.contractNumber} · {day(contract.signedAt)}
              </span>
            </h3>

            <ul className="divide-y divide-[var(--admin-rule)] overflow-hidden rounded-lg border border-[var(--admin-rule)]">
              {contract.hasPdf && (
                <Row
                  icon={<FileText className="h-4 w-4" aria-hidden="true" />}
                  label={`${contract.contractNumber}.pdf`}
                  href={`/api/admin/contracts/${contract.id}/pdf/`}
                  L={L}
                />
              )}
              {contract.assets.map((asset) => (
                <Row
                  key={asset.id}
                  icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
                  label={
                    L.docs.kinds[asset.kind as keyof typeof L.docs.kinds] ??
                    asset.kind
                  }
                  href={
                    asset.deletedAt ? undefined : `/api/admin/assets/${asset.id}/`
                  }
                  deletedAt={asset.deletedAt}
                  L={L}
                />
              ))}
            </ul>
          </section>
        ))}

        <p className="flex items-start gap-1.5 text-xs text-[var(--admin-faint)]">
          <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {L.docs.audited} {L.docs.retentionNote}
          </span>
        </p>
      </div>
    </Dialog>
  );
}

function Row({
  icon,
  label,
  href,
  deletedAt,
  L,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  deletedAt?: string | null;
  L: Labels;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--admin-faint)]">{icon}</span>
        <span className={deletedAt ? "text-[var(--admin-faint)] line-through" : ""}>
          {label}
        </span>
      </span>

      {deletedAt ? (
        <span className="shrink-0 text-xs text-[var(--admin-faint)]">
          {L.docs.deletedOn} {day(deletedAt)}
        </span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          // noreferrer as well as noopener: the URL of a licence image has no
          // business appearing in another origin's referrer log.
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--admin-rule-strong)] px-2.5 py-1 text-xs text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          {L.docs.open}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : (
        <span className="shrink-0 text-xs text-[var(--admin-faint)]">
          {L.docs.pdf}
        </span>
      )}
    </li>
  );
}
