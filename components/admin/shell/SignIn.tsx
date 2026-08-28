"use client";

import { useState } from "react";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Labels } from "@/components/admin/types";
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
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
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
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-slate-900">{L.signIn.heading}</h1>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700">{L.signIn.username}</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                className="h-11 rounded-md border border-input px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700">{L.signIn.password}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 rounded-md border border-input px-3 text-base"
              />
            </label>
          </div>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="h-11 w-full rounded-md bg-slate-900 text-base font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "…" : L.signIn.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
