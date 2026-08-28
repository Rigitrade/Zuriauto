"use client";

import { useState } from "react";
import type { Labels } from "@/components/admin/types";
import { PasswordInput } from "./PasswordInput";

/** Visible to any signed-in user — owner or staff — since the endpoint it
 *  calls lets either change their own password. There is no owner gate on
 *  this component; the fence is `PATCH /api/admin/users/[id]/`'s own
 *  self-password-only carve-out for staff. */
export function SelfPasswordForm({
  L,
  busy,
  onChangePassword,
}: {
  L: Labels;
  busy: boolean;
  onChangePassword: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onChangePassword(password)) setPassword("");
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      <span className="text-sm text-slate-600">{L.accounts.myPassword}</span>
      <PasswordInput
        value={password}
        onChange={setPassword}
        L={L}
        placeholder={L.accounts.newPassword}
        className="w-56"
      />
      <button
        type="submit"
        disabled={busy || password.length < 10}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
      >
        {L.accounts.setPassword}
      </button>
    </form>
  );
}
