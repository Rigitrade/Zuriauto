"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { AccountActions } from "@/components/admin/parts/AccountActions";
import { PasswordInput } from "@/components/admin/parts/PasswordInput";
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
      // construction instead of by accident.
      const result = await response.json().catch(() => ({}));
      setMessage(messageForCode(L, result.code));
      return;
    }

    setDraft({ displayName: "", username: "", password: "", role: "staff" });
    await loadAccounts();
  }

  return (
    <section className="flex flex-col gap-3 pb-6">
      <h2 className="text-lg font-medium text-slate-900">{L.accounts.heading}</h2>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 text-left">{L.accounts.displayName}</th>
              <th className="p-3 text-left">{L.accounts.username}</th>
              <th className="p-3 text-left">{L.accounts.role}</th>
              <th className="p-3 text-left">{L.accounts.lastSignIn}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-200">
                <td className="p-3 font-medium text-slate-900">
                  {account.displayName}
                  {account.disabledAt && (
                    <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      {L.accounts.disabled}
                    </span>
                  )}
                </td>
                <td className="p-3 text-slate-600">{account.username}</td>
                <td className="p-3 text-slate-600">{L.accounts.roles[account.role]}</td>
                <td className="p-3 text-slate-500">
                  {account.lastSignInAt ? day(account.lastSignInAt) : L.accounts.never}
                </td>
                <td className="p-3">
                  <AccountActions
                    account={account}
                    isSelf={me.id === account.id}
                    L={L}
                    onChanged={loadAccounts}
                    onSelfPasswordChanged={endOwnSession}
                    onError={setMessage}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createAccount} className="flex flex-wrap items-end gap-2">
        <input
          value={draft.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
          placeholder={L.accounts.displayName}
          className="h-10 rounded-md border border-input px-3 text-sm"
        />
        <input
          value={draft.username}
          onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          placeholder={L.accounts.username}
          autoCapitalize="none"
          spellCheck={false}
          className="h-10 rounded-md border border-input px-3 text-sm"
        />
        <PasswordInput
          value={draft.password}
          onChange={(password) => setDraft({ ...draft, password })}
          L={L}
          placeholder={L.accounts.newPassword}
          className="w-56"
        />
        <select
          value={draft.role}
          onChange={(e) =>
            setDraft({ ...draft, role: e.target.value as "owner" | "staff" })
          }
          className="h-10 rounded-md border border-input px-2 text-sm"
        >
          <option value="staff">{L.accounts.roles.staff}</option>
          <option value="owner">{L.accounts.roles.owner}</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white"
        >
          {L.accounts.create}
        </button>
      </form>
    </section>
  );
}
