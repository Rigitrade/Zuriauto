"use client";

import { useState } from "react";
import { messageForCode } from "@/lib/admin/labels";
import type { Account, Labels } from "@/components/admin/types";
import { PasswordInput } from "./PasswordInput";

export function AccountActions({
  account,
  isSelf,
  L,
  onChanged,
  onSelfPasswordChanged,
  onError,
  canDisable = true,
  disabledHint,
}: {
  account: Account;
  /** Whether this row is the signed-in user's own account. An owner appears
   *  in their own accounts list, so this path — not just the "my password"
   *  card above — can be how they change their own password. */
  isSelf: boolean;
  L: Labels;
  onChanged: () => Promise<void>;
  /** Called instead of `onChanged` when a self-password patch succeeds.
   *  That PATCH kills the caller's own session (`credentialsChangedAt` moves
   *  past the cookie's `issuedAt`), so the follow-up `loadAccounts()` would
   *  hit its own swallowed 401 and leave the owner on a dashboard that no
   *  longer works, with no message, until their next write. */
  onSelfPasswordChanged: () => void;
  onError: (message: string) => void;
  /** False for the last remaining owner. The API refuses that with
   *  409 last-owner; withholding the button says so before the click.
   *  Setting a password stays available — that rule is about role and
   *  disabled state, not credentials. */
  canDisable?: boolean;
  disabledHint?: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch(`/api/admin/users/${account.id}/`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        onError(messageForCode(L, result.code));
        return;
      }
      setNewPassword("");
      if (isSelf && body.password !== undefined) {
        onSelfPasswordChanged();
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <PasswordInput
        value={newPassword}
        onChange={setNewPassword}
        L={L}
        placeholder={L.accounts.newPassword}
        className="w-56"
      />
      <button
        type="button"
        disabled={busy || newPassword.length < 10}
        onClick={() => patch({ password: newPassword })}
        className="h-9 shrink-0 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {L.accounts.setPassword}
      </button>
      {canDisable ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ disabled: !account.disabledAt })}
          className="h-9 shrink-0 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] disabled:opacity-40"
        >
          {account.disabledAt ? L.accounts.enable : L.accounts.disable}
        </button>
      ) : (
        disabledHint && (
          <span className="text-xs text-[var(--admin-faint)]">{disabledHint}</span>
        )
      )}
    </div>
  );
}
