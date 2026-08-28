"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Labels } from "@/components/admin/types";

/**
 * A password field with a reveal toggle.
 *
 * One component for every password field in the console — signing in, setting
 * somebody else's password, creating an account, changing your own — because
 * the alternative was four fields with four slightly different behaviours.
 *
 * Why reveal is worth having here specifically: an owner setting a colleague's
 * password has to read it back to them, and a password typed blind and then
 * mistyped is a lockout that costs a command-line reset
 * (`pnpm admin:password`). Being able to see what you typed is the cheap fix.
 *
 * It always starts hidden, and it never persists the revealed state: a console
 * left open on a desk should not be showing a password because somebody
 * revealed one an hour ago.
 */
export function PasswordInput({
  value,
  onChange,
  L,
  placeholder,
  autoComplete = "new-password",
  className = "",
  id,
  autoFocus,
  large = false,
}: {
  value: string;
  onChange: (value: string) => void;
  L: Labels;
  placeholder?: string;
  autoComplete?: "new-password" | "current-password";
  className?: string;
  id?: string;
  autoFocus?: boolean;
  /** Sign-in card sizing: 44px and 16px type, which is what stops iOS zooming
   *  the viewport when the field takes focus. */
  large?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={`relative ${className}`}>
      <input
        id={inputId}
        // Not a controlled `type` swap on a re-created element: React keeps the
        // same input, so the caret position and any selection survive the
        // toggle. Swapping the element instead would send the caret to the end
        // mid-word.
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        className={`w-full rounded-md border border-input pl-3 pr-10 ${
          large ? "h-11 text-base" : "h-10 text-sm"
        }`}
      />
      <button
        type="button"
        // Never a submit: this sits inside forms whose submit button creates
        // accounts and signs people in.
        onClick={() => setRevealed((current) => !current)}
        // The label says what the button will do, not what state it is in,
        // which is what a screen reader user needs to hear before pressing it.
        aria-label={revealed ? L.accounts.hidePassword : L.accounts.showPassword}
        aria-pressed={revealed}
        aria-controls={inputId}
        title={revealed ? L.accounts.hidePassword : L.accounts.showPassword}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 transition-colors hover:text-slate-900"
      >
        {revealed ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
