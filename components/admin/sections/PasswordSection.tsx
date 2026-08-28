"use client";

import { useAdmin } from "@/components/admin/shell/AdminContext";
import { SelfPasswordForm } from "@/components/admin/parts/SelfPasswordForm";

/** Its own section rather than a strip above every screen, which is where it
 *  used to sit. Any signed-in user reaches it — the endpoint's self-password
 *  carve-out is what lets a staff member change theirs without an owner. */
export function PasswordSection() {
  const { L, busy, changeMyPassword } = useAdmin();

  return (
    <SelfPasswordForm L={L} busy={busy} onChangePassword={changeMyPassword} />
  );
}
