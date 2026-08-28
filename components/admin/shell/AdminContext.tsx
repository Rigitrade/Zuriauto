"use client";

import { createContext, useContext } from "react";
import type { AdminLanguage } from "@/lib/admin/labels";
import type { Account, Labels, Me, Overview } from "@/components/admin/types";

/**
 * What the shell hands every section.
 *
 * The shell owns identity, the overview payload, the language and the one
 * `write` helper that reports failure and refetches. Sections read them from
 * here rather than receiving fifteen props through a layout that cannot pass
 * props to its children at all — a Next.js layout renders `children` opaquely,
 * so context is the only channel between the two.
 *
 * `me` is non-nullable on purpose. The shell renders the sign-in card instead
 * of `children` when nobody is signed in, so a section that is mounted at all
 * has an identity, and no section needs a null check that would never fire.
 */
export interface AdminContextValue {
  me: Me;
  data: Overview | null;
  accounts: Account[];

  L: Labels;
  language: AdminLanguage;
  chooseLanguage: (next: AdminLanguage) => void;

  busy: boolean;
  message: string | null;
  setMessage: (message: string | null) => void;

  /** Every write goes through here, so one place reports failure and
   *  refetches. See the note on the implementation in AdminShell. */
  write: (url: string, init: RequestInit) => Promise<boolean>;
  reload: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  endOwnSession: () => void;
  changeMyPassword: (password: string) => Promise<boolean>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export const AdminProvider = AdminContext.Provider;

/**
 * Throws rather than returning null when used outside the shell.
 *
 * A section rendered outside `app/admin/layout.tsx` is a routing mistake, and
 * a loud error at the first render is a far cheaper way to find it than a
 * page that silently shows nothing.
 */
export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) {
    throw new Error("useAdmin must be used inside the admin shell layout.");
  }
  return value;
}
