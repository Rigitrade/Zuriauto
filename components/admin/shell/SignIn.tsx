"use client";

import { useState } from "react";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Labels } from "@/components/admin/types";
import { PasswordInput } from "@/components/admin/parts/PasswordInput";
import { LanguageToggle } from "./LanguageToggle";

/**
 * The sign-in card.
 *
 * Lifted out of the dashboard unchanged, including the rule that matters: one
 * message for a wrong username, a wrong password and a disabled account, so a
 * caller learns only that they are not in. Rate-limiting gets its own message
 * because that is a "wait", not a "wrong".
 *
 * Owns the username and password fields itself. They exist only while this
 * card is on screen, and keeping them here means a signed-in session holds no
 * state that ever contained a password.
 */
export function SignIn({
  L,
  language,
  onChooseLanguage,
  busy,
  message,
  onSubmit,
}: {
  L: Labels;
  language: AdminLanguage;
  onChooseLanguage: (next: AdminLanguage) => void;
  busy: boolean;
  message: string | null;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--admin-ground)] p-6 text-[var(--admin-ink)]">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex justify-end">
          <LanguageToggle language={language} onChoose={onChooseLanguage} />
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit(username, password);
            setPassword("");
          }}
          className="space-y-5 rounded-2xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] p-6 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-faint)]">
              ZURIAUTO
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              {L.signIn.heading}
            </h1>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--admin-muted)]">{L.signIn.username}</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                className="h-11 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-base outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--admin-muted)]">{L.signIn.password}</span>
              <PasswordInput
                value={password}
                onChange={setPassword}
                L={L}
                autoComplete="current-password"
                large
              />
            </label>
          </div>

          {message && <p className="rounded-md bg-[var(--admin-crit-soft)] px-3 py-2 text-sm text-[var(--admin-crit)]">{message}</p>}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="h-11 w-full rounded-md bg-[var(--admin-accent)] text-base font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "…" : L.signIn.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
