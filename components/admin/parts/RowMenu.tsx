"use client";

import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { EllipsisVertical } from "lucide-react";

/**
 * The actions for one row of a table, behind a single button.
 *
 * A row used to end in five controls laid side by side — two icons, a rule,
 * another icon and a text button — which came to about 300px of the width.
 * With eight columns of fleet data in front of them the table could not fit
 * the 72rem the admin shell gives it, so every screen scrolled sideways, and
 * the controls were the thing that scrolled out of sight. Collapsed to one
 * 32px button the table fits, and the actions are always where the eye ends.
 *
 * The cost is one extra click, and it is worth paying twice over: the icons
 * were a row of grey glyphs that had to be learned, and a menu says what each
 * one does in words. Nothing here is used often enough for the click to be
 * felt — the frequent job, reading the table, got faster.
 *
 * Built on Radix rather than by hand. A menu looks like a box with buttons in
 * it and is nothing of the sort: arrow keys must move between items and wrap,
 * Escape must close and hand focus back to the trigger, Home and End and
 * first-letter typeahead are expected, the open menu must not be clipped by
 * the scrolling box the table sits in, and a screen reader must be told all
 * of it. The rest of this folder is hand-written against the admin tokens
 * because a dialog and a panel are genuinely a div with a border; this is
 * not, and `@radix-ui/react-dropdown-menu` is already installed for the
 * booking side, so the correct version costs nothing to ship.
 *
 * `modal={false}`: the modal flavour freezes the page behind it, which is
 * right for a dialog and wrong for a menu that is often opened to glance at
 * what is possible and then dismissed.
 */
export function RowMenu({
  label,
  disabled,
  open,
  onOpenChange,
  children,
}: {
  /** Names the button for a screen reader; include the plate, because ten
   *  rows otherwise announce ten identical buttons. */
  label: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Menu.Trigger
        aria-label={label}
        disabled={disabled}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--admin-faint)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30 focus-visible:outline-none data-[state=open]:bg-[var(--admin-sunk)] data-[state=open]:text-[var(--admin-ink)] disabled:opacity-40"
      >
        <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          // Flips above the button near the bottom of the window by itself.
          // The last row of a long fleet is exactly where a menu that only
          // ever opened downwards would run off the screen.
          collisionPadding={12}
          className="z-50 min-w-[13rem] rounded-lg border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-1 text-[var(--admin-ink)] shadow-xl"
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function RowMenuItem({
  icon,
  onSelect,
  href,
  disabled,
  danger,
  /** Keeps the menu open after the click. For the first half of a two-step
   *  confirmation, which would otherwise close the menu it is asking in. */
  keepOpen,
  children,
}: {
  icon?: React.ReactNode;
  onSelect?: () => void;
  /**
   * Makes the item navigate rather than act.
   *
   * A real `<a>`, by way of `asChild`, and not a `router.push()` in an
   * `onSelect`. An item that goes somewhere should behave like every other
   * link in the console: middle-click opens a tab, the status bar shows where
   * it leads, and ctrl-click does what somebody expects. A handler that
   * navigates programmatically silently breaks all three, which is how a
   * "profile" entry becomes something the office cannot open beside the fleet
   * list they are working through.
   */
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
  children: React.ReactNode;
}) {
  const className = `flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 ${
    danger
      ? "text-[var(--admin-crit)] data-[highlighted]:bg-[var(--admin-crit-soft)]"
      : "text-[var(--admin-ink)] data-[highlighted]:bg-[var(--admin-sunk)]"
  }`;

  /* A fixed box whether or not there is a glyph in it, so the words of an
     item without an icon still line up with the words above it. */
  const body = (
    <>
      <span className="grid h-4 w-4 shrink-0 place-items-center text-[var(--admin-faint)]">
        {icon}
      </span>
      {children}
    </>
  );

  if (href) {
    return (
      <Menu.Item disabled={disabled} asChild>
        <Link href={href} className={className}>
          {body}
        </Link>
      </Menu.Item>
    );
  }

  return (
    <Menu.Item
      disabled={disabled}
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
        onSelect?.();
      }}
      className={className}
    >
      {body}
    </Menu.Item>
  );
}

export function RowMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-[var(--admin-rule)]" />;
}
