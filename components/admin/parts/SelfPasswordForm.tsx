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
      className="flex flex-wrap items-end gap-2"
    >
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
        className="h-10 shrink-0 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {L.accounts.setPassword}
      </button>
    </form>
  );
}
