"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
/**
 * How tall the panel may get, written once and applied to two elements.
 *
 * The `<dialog>` is what the browser centres and what carries the ceiling; the
 * wrapper inside it is what actually lays the three rows out, and a flex column
 * with no ceiling of its own would push the footer past the bottom of the
 * screen. A literal string rather than a computed one, because Tailwind reads
 * the source looking for class names and never runs it.
 */
const DIALOG_PANEL_MAX_H = "max-h-[calc(100dvh-3rem)]";

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

  /**
   * Whether the browser is running this, because the panel below is put at the
   * end of `<body>` and there is no body to put it in on the server.
   *
   * Nothing is lost by waiting a frame: a dialog is invisible until something
   * calls `showModal()`, and that call already happens in an effect.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open, mounted]);

  if (!mounted) return null;

  /**
   * At the end of `<body>`, wherever it was written.
   *
   * The fleet table declares three of these per row, which put a `<dialog>`
   * inside a `<tbody>` — markup no parser allows, and React says so: "In HTML,
   * <dialog> cannot be a child of <tbody>. This will cause a hydration error."
   * It survived because React builds the node rather than parsing it, so the
   * browser never got the chance to move it somewhere legal.
   *
   * A portal is the fix rather than asking every caller to declare its dialogs
   * somewhere else. A modal belongs at the end of the document whatever part
   * of the page opened it — that is what the top layer is for — and a rule
   * that has to be remembered at nine call sites is a rule that gets broken at
   * the tenth.
   */
  return createPortal(
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
      /**
       * NEVER put a display utility — `flex`, `grid`, `block` — on this
       * element. See DIALOG_PANEL below.
       *
       * `dvh`, not `vh`: on a phone `vh` is measured against the viewport with
       * the address bar hidden, so the footer sits below the fold until the
       * page is scrolled — on a dialog that cannot be scrolled past, that is
       * the Save button permanently off screen.
       */
      className={`
        ${DIALOG_PANEL_MAX_H} m-auto overflow-hidden rounded-2xl
        border border-[var(--admin-rule)]
        bg-[var(--admin-surface)] p-0 text-[var(--admin-ink)] shadow-xl
        backdrop:bg-[#14191A]/45
        ${wide ? "w-[min(60rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"}
      `}
    >
      {/*
        The column lives on a wrapper, not on the <dialog>.

        It has to. A closed `<dialog>` is hidden by one rule in the browser's
        own stylesheet — `dialog:not([open]) { display: none }` — and an author
        stylesheet beats the browser's whatever the specificity, so a single
        `flex` class on the element above unhides every closed dialog on the
        page. On the fleet screen that is three per car: eleven cars' worth of
        modals spilled down the page, which is exactly what shipped.

        `open:flex` would also work and is one class shorter. This is the
        version that cannot be undone by somebody adding a layout class without
        knowing why the variant was there.

        The two ends are pinned and only the middle scrolls, so Speichern stays
        on screen instead of sitting below everything the dialog contains.
      */}
      <div className={`${DIALOG_PANEL_MAX_H} flex flex-col`}>
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
            child's default minimum is its content, so without it the panel
            grows past the screen and the scrollbar lands on the page. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[var(--admin-rule)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </dialog>,
    document.body
  );
}
