"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A modal for the jobs done a handful of times a year.
 *
 * Adding a vehicle and creating an account used to be forms wedged permanently
 * open above the lists they belong to — the rarest work holding the most
 * valuable space on the page. Behind a button they cost one click and give the
 * space back.
 *
 * Built on `<dialog>` rather than a div with a z-index, which buys three
 * things that are tedious to reproduce and easy to get subtly wrong: focus is
 * trapped inside while it is open, the rest of the page is inert to a screen
 * reader, and Escape closes it without a key handler.
 *
 * `showModal()` is called from an effect rather than rendering `open`: the
 * `open` attribute produces a non-modal dialog, which looks identical and does
 * none of the above.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  wide = false,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  /** For content that is itself a document — a PDF or a scan needs room that
   *  a form does not. */
  wide?: boolean;
  /**
   * The row of buttons that stays put while the content scrolls.
   *
   * A dialog taller than the laptop it is opened on used to scroll as one
   * piece, Speichern included, so the way to save a car was to scroll past
   * everything you had just decided not to change. A button that commits the
   * form belongs where the eye already is.
   *
   * A slot rather than a `saveLabel` prop, because the dialogs disagree about
   * what belongs down there: one has Speichern, one has Speichern and
   * Abbrechen, and the maintenance dialog has nothing at all and is left with
   * no footer to draw a line under.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Fires for Escape and for the form-method="dialog" close alike, so the
      // parent's state cannot drift out of step with what is on screen.
      onClose={onClose}
      // A click landing on the dialog element itself is a click on the
      // backdrop; anything inside the panel stops at the panel.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      // `max-h` and the column below it are what give the panel one scrolling
      // region instead of two. Left to itself a `<dialog>` caps its own height
      // and scrolls the whole panel, heading and buttons with it; pinning the
      // two ends and letting only the middle move is the behaviour every other
      // modal on the web has, and the one the office expects.
      //
      // `dvh`, not `vh`: on a phone `vh` is measured against the viewport with
      // the address bar hidden, so the footer sits below the fold until the
      // page is scrolled — on a dialog that cannot be scrolled past, that is
      // the Save button permanently off screen.
      className={`
        m-auto flex max-h-[calc(100dvh-3rem)] flex-col rounded-2xl
        border border-[var(--admin-rule)]
        bg-[var(--admin-surface)] p-0 text-[var(--admin-ink)] shadow-xl
        backdrop:bg-[#14191A]/45
        ${wide ? "w-[min(60rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"}
      `}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-rule)] px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--admin-faint)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* `min-h-0` is what lets this shrink inside the column at all: a flex
          child's default minimum is its content, so without it the panel grows
          past the screen and the scrollbar lands on the page instead. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-[var(--admin-rule)] px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
