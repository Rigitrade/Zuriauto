"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, ImageIcon, Lock } from "lucide-react";
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
 * Two rules in how it behaves:
 *
 *  - **Nothing is shown until it is asked for.** The list says what is on
 *    file; picking one renders it. Thumbnailing six documents would mean
 *    fetching six passports — and writing six audit rows — every time anybody
 *    glanced at a rental. The common question is "is the licence on file?",
 *    which the list answers without anybody seeing it. One click, one view,
 *    one log entry.
 *  - **A deleted document is listed, not hidden.** "The ID was checked here
 *    and the image has since been deleted under the retention policy" is a
 *    different fact from no row at all, and the office has to be able to tell
 *    somebody which.
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

interface Viewing {
  href: string;
  label: string;
  isPdf: boolean;
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
  /** The one document on screen, or null for the list. */
  const [viewing, setViewing] = useState<Viewing | null>(null);

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

  // Reopening lands on the list, never on whatever passport was last on screen.
  useEffect(() => {
    if (!open) setViewing(null);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        viewing
          ? `${viewing.label} · ${rental.customerName}`
          : `${L.docs.heading} · ${rental.customerName}`
      }
      closeLabel={L.rentals.cancel}
      wide={viewing !== null}
    >
      {viewing ? (
        <Viewer viewing={viewing} L={L} onBack={() => setViewing(null)} />
      ) : (
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

          {contracts?.map((contract) => {
            const pdfHref = `/api/admin/contracts/${contract.id}/pdf/`;
            return (
              <section key={contract.id}>
                <h3 className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold uppercase tracking-wider text-[var(--admin-faint)]">
                  <span>
                    {contract.kind === "PICKUP"
                      ? L.docs.contract
                      : L.docs.returnProtocol}
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
                      href={pdfHref}
                      onView={() =>
                        setViewing({
                          href: pdfHref,
                          label: `${contract.contractNumber}.pdf`,
                          isPdf: true,
                        })
                      }
                      L={L}
                    />
                  )}

                  {contract.assets.map((asset) => {
                    const href = `/api/admin/assets/${asset.id}/`;
                    const label =
                      L.docs.kinds[asset.kind as keyof typeof L.docs.kinds] ??
                      asset.kind;
                    return (
                      <Row
                        key={asset.id}
                        icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
                        label={label}
                        href={asset.deletedAt ? undefined : href}
                        onView={
                          asset.deletedAt
                            ? undefined
                            : () =>
                                setViewing({
                                  href,
                                  label,
                                  isPdf: asset.contentType === "application/pdf",
                                })
                        }
                        deletedAt={asset.deletedAt}
                        L={L}
                      />
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <p className="flex items-start gap-1.5 text-xs text-[var(--admin-faint)]">
            <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {L.docs.audited} {L.docs.retentionNote}
            </span>
          </p>
        </div>
      )}
    </Dialog>
  );
}

/**
 * One document on screen.
 *
 * Both branches render through the same audited endpoints — an `<iframe>` and
 * an `<img>` send the session cookie on a same-origin request exactly as a
 * navigation does, so a view here is logged like any other.
 *
 * The PDF uses the browser's own viewer rather than a bundled one. pdf.js is
 * most of a megabyte to render something Chrome, Safari and Firefox already
 * display, and this is an internal tool where the browser is known.
 */
function Viewer({
  viewing,
  L,
  onBack,
}: {
  viewing: Viewing;
  L: Labels;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {L.docs.heading}
        </button>
        <a
          href={viewing.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          {L.docs.newTab}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      {viewing.isPdf ? (
        <iframe
          src={viewing.href}
          title={viewing.label}
          className="h-[70vh] w-full rounded-lg border border-[var(--admin-rule)] bg-[var(--admin-sunk)]"
        />
      ) : (
        /*
         * next/image is wrong here: it optimises through a loader that would
         * need its own access to a fenced, audited endpoint, and would cache
         * a passport at the edge. A direct same-origin request is the point.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={viewing.href}
          alt={viewing.label}
          className="max-h-[70vh] w-full rounded-lg border border-[var(--admin-rule)] bg-[var(--admin-sunk)] object-contain"
        />
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  href,
  onView,
  deletedAt,
  L,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onView?: () => void;
  deletedAt?: string | null;
  L: Labels;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--admin-faint)]">{icon}</span>
        <span
          className={`truncate ${
            deletedAt ? "text-[var(--admin-faint)] line-through" : ""
          }`}
        >
          {label}
        </span>
      </span>

      {deletedAt ? (
        <span className="shrink-0 text-xs text-[var(--admin-faint)]">
          {L.docs.deletedOn} {day(deletedAt)}
        </span>
      ) : href ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="rounded-md border border-[var(--admin-rule-strong)] px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--admin-sunk)]"
            >
              {L.docs.preview}
            </button>
          )}
          <a
            href={href}
            target="_blank"
            // noreferrer as well as noopener: the URL of a licence image has
            // no business appearing in another origin's referrer log.
            rel="noopener noreferrer"
            aria-label={L.docs.newTab}
            title={L.docs.newTab}
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--admin-faint)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </span>
      ) : (
        <span className="shrink-0 text-xs text-[var(--admin-faint)]">
          {L.docs.pdf}
        </span>
      )}
    </li>
  );
}
