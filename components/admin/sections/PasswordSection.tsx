"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { SelfPasswordForm } from "@/components/admin/parts/SelfPasswordForm";
import { Panel } from "@/components/admin/parts/Panel";

/** Its own section rather than a strip above every screen, which is where it
 *  used to sit. Any signed-in user reaches it — the endpoint's self-password
 *  carve-out is what lets a staff member change theirs without an owner. */
export function PasswordSection() {
  const { L, me, busy, changeMyPassword } = useAdmin();

  return (
    <div className="max-w-lg">
      <Panel title={L.accounts.myPassword} meta={me.displayName}>
        <div className="px-4 py-4">
          <SelfPasswordForm L={L} busy={busy} onChangePassword={changeMyPassword} />
          <p className="mt-3 text-xs text-[var(--admin-faint)]">
            {L.accounts.passwordChangedSignOut}
          </p>
        </div>
      </Panel>
    </div>
  );
}
