"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_LANGUAGE_KEY,
  asAdminLanguage,
  labelsFor,
  messageForCode,
  type AdminLanguage,
} from "@/lib/admin/labels";
import type { Account, Me, Overview } from "@/components/admin/types";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { attentionItems } from "@/lib/admin/attention";
import { AdminProvider } from "./AdminContext";
import { LanguageToggle } from "./LanguageToggle";
import { isCurrent, Rail, railItems } from "./Rail";
import { SignIn } from "./SignIn";

/**
 * The office's fleet console.
 *
 * Owns exactly three things, and nothing a section could own instead:
 * identity, the overview payload, and the language. Sections read them from
 * `useAdmin()`.
 *
 * One GET still paints everything, and each write refetches rather than
 * patching local state. The list is nine cars, so re-reading is cheaper than
 * keeping two copies of the truth in agreement — and it means a change made on
 * the desk phone shows up on the office laptop.
 *
 * Why the overview lives here rather than in each section: there is one
 * endpoint, and it returns cars, rentals and counters together. Splitting the
 * fetch per section would mean splitting the endpoint first, which is stage 3
 * work. Until then the shell fetches once and shares it, which is exactly what
 * the single-file dashboard did.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<AdminLanguage>("de");
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const L = labelsFor(language);

  // Restored before first paint of the shell, so the form does not flash
  // German at somebody who chose English yesterday. The default state above
  // is German so the server-rendered markup and the client's first paint
  // always agree — the switch to English, if any, happens after mount.
  useEffect(() => {
    try {
      setLanguage(asAdminLanguage(localStorage.getItem(ADMIN_LANGUAGE_KEY)));
    } catch {
      // A private window can throw on access; German is the right fallback.
    }
  }, []);

  const chooseLanguage = useCallback((next: AdminLanguage) => {
    setLanguage(next);
    try {
      localStorage.setItem(ADMIN_LANGUAGE_KEY, next);
    } catch {
      // Not worth telling anybody: the choice simply will not persist.
    }
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/overview/");
    if (response.status === 401) {
      setSignedIn(false);
      setData(null);
      return;
    }
    setSignedIn(true);
    const body = (await response.json()) as Overview;
    setData(body);
    // Restores the header on a reload with an already-valid cookie: sign-in
    // is not the only place the identity comes from once a session exists.
    setMe(body.me);
  }, []);

  // The cookie may already be valid from this morning, so the console tries
  // before asking — the office should not sign in again on every reload.
  useEffect(() => {
    void load();
  }, [load]);

  /** Owners only — the endpoint refuses staff anyway, so this is a
   *  convenience rather than the fence. Depends on `me?.role` rather than
   *  being called inline right after `setMe`: a state setter does not update
   *  the `me` this closure already captured, so a call fired synchronously in
   *  the same function would still see the *previous* role and quietly skip
   *  the fetch on a fresh sign-in. */
  const loadAccounts = useCallback(async () => {
    if (me?.role !== "owner") return;
    const response = await fetch("/api/admin/users/", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { users: Account[] };
    setAccounts(body.users);
  }, [me?.role]);

  // Fires after sign-in and after a reload that restores an owner's session
  // alike, since both simply change `me?.role` to "owner".
  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const response = await fetch("/api/admin/session/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (response.status === 429) {
          setMessage(L.signIn.rateLimited);
          return;
        }
        if (!response.ok) {
          setMessage(L.signIn.failed);
          return;
        }

        const body = (await response.json()) as { user: Me };
        setMe(body.user);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [L, load]
  );

  const signOut = useCallback(async () => {
    await fetch("/api/admin/session/", { method: "DELETE" });
    setSignedIn(false);
    setMe(null);
    setData(null);
  }, []);

  /** Every write goes through here, so one place reports failure and
   *  refetches. The failure message comes from the response's own `code` via
   *  `messageForCode` — not a static string per call site — so a duplicate
   *  plate, a refused status change and a stale session each read as what
   *  they are instead of one shared "something went wrong". */
  const write = useCallback(
    async (url: string, init: RequestInit) => {
      setBusy(true);
      setMessage(null);
      try {
        const response = await fetch(url, init);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (body.code === "unauthorised") {
            // The cookie died mid-session (expiry, a password reset, being
            // disabled). The whole console returns to sign-in rather than
            // leaving somebody looking at a screen that can no longer write.
            setSignedIn(false);
            setMe(null);
            setData(null);
            setMessage(L.errors.signedOut);
            return false;
          }
          setMessage(messageForCode(L, body.code));
          return false;
        }
        await load();
        return true;
      } catch {
        setMessage(L.errors.generic);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [L, load]
  );

  /** Shared by every path that ends the signed-in user's own session after
   *  their own password changed — the My password section and the per-row
   *  account actions when the row is their own. Pulled out so both read as the
   *  same event instead of one showing a message and the other going silently
   *  stale. */
  const endOwnSession = useCallback(() => {
    setSignedIn(false);
    setMe(null);
    setData(null);
    setMessage(L.accounts.passwordChangedSignOut);
  }, [L]);

  /** Available to any signed-in user, not just an owner: `PATCH
   *  /api/admin/users/[id]/` lets a staff member change exactly their own
   *  password. Kept outside `write()` on purpose — a self password change
   *  always ends the session that made the request (`credentialsChangedAt`
   *  moves past the cookie's `issuedAt`), and `write()`'s own follow-up
   *  `load()` would hit that 401 silently and drop the caller on the sign-in
   *  screen with no explanation. */
  const changeMyPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!me) return false;
      setBusy(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/admin/users/${me.id}/`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          setMessage(messageForCode(L, result.code));
          return false;
        }
        endOwnSession();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [L, me, endOwnSession]
  );

  if (signedIn === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--admin-ground)] p-6">
        <p className="text-sm text-[var(--admin-faint)]">…</p>
      </main>
    );
  }

  if (!signedIn || !me) {
    return (
      <SignIn
        L={L}
        language={language}
        onChooseLanguage={chooseLanguage}
        busy={busy}
        message={message}
        onSubmit={signIn}
      />
    );
  }

  // The same selector the band renders from, so the badge and the band can
  // never disagree about how much work there is. A badge saying 3 above a band
  // showing 2 would teach the office to stop believing both.
  const attention = data ? attentionItems(data, new Date()).length : 0;

  const items = railItems(L, me, attention);
  const current = items.find((item) => isCurrent(pathname, item.href));

  return (
    <AdminProvider
      value={{
        me,
        data,
        accounts,
        L,
        language,
        chooseLanguage,
        busy,
        message,
        setMessage,
        write,
        reload: load,
        loadAccounts,
        endOwnSession,
        changeMyPassword,
      }}
    >
      <div className="flex min-h-screen bg-[var(--admin-ground)] text-[var(--admin-ink)]">
        {/* The sidebar is its own scroll container pinned to the viewport, so
            a long vehicle list scrolls under a navigation that stays put. */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[var(--admin-rule)] bg-[var(--admin-surface)] md:flex lg:w-60">
          <div className="px-5 py-5">
            <p className="text-[0.9375rem] font-bold tracking-tight">ZURIAUTO</p>
            <p className="text-xs text-[var(--admin-faint)]">{L.signIn.heading}</p>
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            <Rail L={L} me={me} attention={attention} variant="sidebar" />
          </div>

          {/* Who you are, at the bottom, where an application puts it. */}
          <div className="border-t border-[var(--admin-rule)] px-5 py-4">
            <p className="truncate text-sm font-medium">{me.displayName}</p>
            <p className="text-xs text-[var(--admin-faint)]">
              {L.accounts.roles[me.role]}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-[var(--admin-muted)] underline-offset-2 transition-colors hover:text-[var(--admin-ink)] hover:underline"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {L.nav.signOut}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-[var(--admin-rule)] bg-[var(--admin-surface)]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="min-w-0">
                {/* The brand only appears here below md, where the sidebar
                    carrying it is not on screen. */}
                <p className="text-sm font-bold tracking-tight md:hidden">
                  ZURIAUTO
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {current?.label ?? L.nav.overview}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <LanguageToggle language={language} onChoose={chooseLanguage} />
                <button
                  type="button"
                  onClick={signOut}
                  aria-label={L.nav.signOut}
                  className="grid h-9 w-9 place-items-center rounded-md text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)] md:hidden"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <Rail L={L} me={me} attention={attention} variant="bar" />
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* Wide, but not edge to edge: a table stretched across a 27-inch
                monitor is harder to read across, not easier. */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
              {message && (
                <p
                  role="status"
                  className="rounded-lg border border-[var(--admin-attn-rule)] bg-[var(--admin-attn-soft)] px-4 py-3 text-sm text-[var(--admin-attn)]"
                >
                  {message}
                </p>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
