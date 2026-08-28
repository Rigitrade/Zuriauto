"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AccountActions } from "@/components/admin/parts/AccountActions";
import { PasswordInput } from "@/components/admin/parts/PasswordInput";
import { Dialog } from "@/components/admin/parts/Dialog";
import { Panel } from "@/components/admin/parts/Panel";
import { day } from "@/components/admin/format";
import { messageForCode } from "@/lib/admin/labels";
import { USERNAME_PATTERN } from "@/lib/admin/users";

/**
 * Owner-only. Staff never see the rail item, and a staff member who types the
 * URL is sent to Overview.
 *
 * That redirect is a courtesy, not the fence. `/api/admin/users/` answers
 * `403 forbidden` to a staff session however it is called, and this component
 * would render an empty table rather than anything sensitive even if the
 * redirect were removed.
 */
export function AccountsSection() {
  const { L, me, accounts, loadAccounts, endOwnSession, setMessage } = useAdmin();
  const router = useRouter();

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    displayName: "",
    username: "",
    password: "",
    role: "staff" as "owner" | "staff",
  });

  // In an effect, not in render: navigating during render is a side effect in
  // the render phase, which React is entitled to run twice or throw away. The
  // early return below is what actually keeps the table off the screen; this
  // only moves them somewhere useful afterwards.
  const isOwner = me.role === "owner";
  useEffect(() => {
    if (!isOwner) router.replace("/admin");
  }, [isOwner, router]);

  if (!isOwner) return null;

  const owners = accounts.filter(
    (account) => account.role === "owner" && !account.disabledAt
  ).length;

  /** Not routed through `write()`: the codes this endpoint returns —
   *  `username-taken` alongside the client-side password/username checks
   *  below — map onto the office's language directly, and a failure here
   *  should not sign anybody out or refetch the fleet. */
  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (draft.password.length < 10) {
      setMessage(L.accounts.passwordTooShort);
      return;
    }
    if (!USERNAME_PATTERN.test(draft.username.trim().toLowerCase())) {
      setMessage(L.accounts.usernameInvalid);
      return;
    }

    const response = await fetch("/api/admin/users/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      // Routed through the shared map rather than treating every 409 as
      // "username taken": that is the only 409 this endpoint returns today,
      // but reading the actual `code` is what keeps that true by
      // construction instead of by accident. The dialog stays open so the
      // typed name is still there to correct.
      const result = await response.json().catch(() => ({}));
      setMessage(messageForCode(L, result.code));
      return;
    }

    setDraft({ displayName: "", username: "", password: "", role: "staff" });
    setCreating(false);
    await loadAccounts();
  }

  return (
    <>
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={L.accounts.addHeading}
        closeLabel={L.accounts.close}
      >
        <form onSubmit={createAccount} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-[var(--admin-muted)]">{L.accounts.displayName}</span>
            <input
              value={draft.displayName}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              className="h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[var(--admin-muted)]">{L.accounts.username}</span>
            <input
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              autoCapitalize="none"
              spellCheck={false}
              className="h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
            />
            {/* The rule stated before it is broken, rather than as a refusal
                after the fact. */}
            <span className="text-xs text-[var(--admin-faint)]">
              {L.accounts.usernameInvalid}
            </span>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[var(--admin-muted)]">{L.accounts.newPassword}</span>
            <PasswordInput
              value={draft.password}
              onChange={(password) => setDraft({ ...draft, password })}
              L={L}
              placeholder={L.accounts.passwordTooShort}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[var(--admin-muted)]">{L.accounts.role}</span>
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({ ...draft, role: e.target.value as "owner" | "staff" })
              }
              className="h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-2 text-sm outline-none focus-visible:border-[var(--admin-accent)]"
            >
              <option value="staff">{L.accounts.roles.staff}</option>
              <option value="owner">{L.accounts.roles.owner}</option>
            </select>
          </label>
          <button
            type="submit"
            className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90"
          >
            {L.accounts.create}
          </button>
        </form>
      </Dialog>

      <Panel
        title={L.accounts.heading}
        meta={String(accounts.length)}
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {L.accounts.addHeading}
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{L.accounts.displayName}</th>
                <th className="px-4 py-2.5 text-left font-medium">{L.accounts.username}</th>
                <th className="px-4 py-2.5 text-left font-medium">{L.accounts.role}</th>
                <th className="px-4 py-2.5 text-left font-medium">{L.accounts.lastSignIn}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                // The API refuses to demote or disable the last remaining
                // owner with 409 last-owner. Saying so on the row is better
                // than letting somebody click and collect the refusal.
                const isLastOwner =
                  account.role === "owner" && !account.disabledAt && owners === 1;

                return (
                  <tr
                    key={account.id}
                    className={`border-t border-[var(--admin-rule)] transition-colors hover:bg-[var(--admin-sunk)]/50 ${
                      me.id === account.id
                        ? "shadow-[inset_3px_0_0_var(--admin-accent)]"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {account.displayName}
                      {me.id === account.id && (
                        <span className="ml-2 rounded-full bg-[var(--admin-accent-soft)] px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--admin-accent)]">
                          {L.accounts.you}
                        </span>
                      )}
                      {account.disabledAt && (
                        <span className="ml-2 rounded-full bg-[var(--admin-crit-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--admin-crit)]">
                          {L.accounts.disabled}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--admin-muted)]">
                      {account.username}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-muted)]">
                      {L.accounts.roles[account.role]}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--admin-faint)]">
                      {account.lastSignInAt ? day(account.lastSignInAt) : L.accounts.never}
                    </td>
                    <td className="px-4 py-3">
                      <AccountActions
                        account={account}
                        isSelf={me.id === account.id}
                        L={L}
                        onChanged={loadAccounts}
                        onSelfPasswordChanged={endOwnSession}
                        onError={setMessage}
                        canDisable={!isLastOwner}
                        disabledHint={L.accounts.lastOwnerHint}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
