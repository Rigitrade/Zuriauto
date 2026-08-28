"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  ADMIN_LANGUAGE_KEY,
  asAdminLanguage,
  labelsFor,
  messageForCode,
  type AdminLanguage,
} from "@/lib/admin/labels";
import { USERNAME_PATTERN } from "@/lib/admin/users";

/**
 * The office's fleet page.
 *
 * One GET paints everything; three small writes change it, and each one
 * refetches rather than patching local state. The list is eight cars, so
 * re-reading is cheaper than keeping two copies of the truth in agreement —
 * and it means a change made on the desk phone shows up on the office laptop.
 */

interface Car {
  id: string;
  slug: string;
  model: string;
  plate: string;
  vin: string | null;
  status: string;
  activeRentalId: string | null;
}

interface Rental {
  id: string;
  carPlate: string;
  carModel: string;
  customerName: string;
  startAt: string;
  endAt: string;
  contractNumber: string | null;
  returnSubmittedAt: string | null;
  returnContractNumber: string | null;
}

interface Account {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "staff";
  disabledAt: string | null;
  lastSignInAt: string | null;
}

type Me = { id: string; username: string; displayName: string; role: "owner" | "staff" };

interface Overview {
  /** The same shape the sign-in response carries — one type for "who am I",
   *  populated from either. */
  me: Me;
  cars: Car[];
  rentals: Rental[];
  counts: {
    available: number;
    retired: number;
    rented: number;
    activeRentals: number;
    returnsAwaiting: number;
    contracts: number;
    mailFailed: number;
  };
  latestContractAt: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-900",
  rented: "bg-sky-100 text-sky-900",
  maintenance: "bg-amber-100 text-amber-900",
  retired: "bg-slate-200 text-slate-700",
};

function day(iso: string): string {
  const [date] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export default function AdminDashboard() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<AdminLanguage>("de");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [draft, setDraft] = useState({
    displayName: "",
    username: "",
    password: "",
    role: "staff" as "owner" | "staff",
  });

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

  function chooseLanguage(next: AdminLanguage) {
    setLanguage(next);
    try {
      localStorage.setItem(ADMIN_LANGUAGE_KEY, next);
    } catch {
      // Not worth telling anybody: the choice simply will not persist.
    }
  }

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

  // The cookie may already be valid from this morning, so the page tries
  // before asking — the office should not sign in again on every reload.
  useEffect(() => {
    void load();
  }, [load]);

  /** Owners only — the section is not rendered at all for staff, and the
   *  endpoint refuses them anyway, so this is a convenience rather than the
   *  fence. Depends on `me?.role` rather than being called inline right
   *  after `setMe`: a state setter does not update the `me` this closure
   *  already captured, so a call fired synchronously in the same function
   *  would still see the *previous* role and quietly skip the fetch on a
   *  fresh sign-in. Reading it through the dependency array instead means
   *  this always runs against the role React has actually committed. */
  const loadAccounts = useCallback(async () => {
    if (me?.role !== "owner") return;
    const response = await fetch("/api/admin/users/", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { users: Account[] };
    setAccounts(body.users);
  }, [me?.role]);

  // Fires after sign-in and after a reload that restores an owner's session
  // alike, since both simply change `me?.role` to "owner" and this effect
  // reacts to that rather than being threaded through every place `load()`
  // is called.
  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
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
        setPassword("");
        return;
      }

      const body = (await response.json()) as { user: Me };
      setMe(body.user);
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session/", { method: "DELETE" });
    setSignedIn(false);
    setMe(null);
    setData(null);
  }

  /** Every write goes through here, so one place reports failure and
   *  refetches. The failure message comes from the response's own `code` via
   *  `messageForCode` — not a static string per call site — so a duplicate
   *  plate, a refused status change and a stale session each read as what
   *  they are instead of one shared "something went wrong". */
  async function write(url: string, init: RequestInit) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.code === "unauthorised") {
          // The cookie died mid-session (expiry, a password reset, being
          // disabled). Sent back to the sign-in screen rather than left
          // looking at a dashboard that can no longer write anything.
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
  }

  function deleteCar(id: string) {
    return write(`/api/admin/cars/${id}/`, { method: "DELETE" });
  }

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

  /** Available to any signed-in user, not just an owner: `PATCH
   *  /api/admin/users/[id]/` lets a staff member change exactly their own
   *  password, and this is the only place in the UI that reaches it. Kept
   *  outside `write()` on purpose — a self password change always ends the
   *  session that made the request (`credentialsChangedAt` moves past the
   *  cookie's `issuedAt`), and `write()`'s own follow-up `load()` would hit
   *  that 401 silently, via its own bare `signedIn(false)` branch, and drop
   *  the caller on the sign-in screen with no explanation. Handled here
   *  instead, so the sign-out carries `L.accounts.passwordChangedSignOut`. */
  async function changeMyPassword(password: string): Promise<boolean> {
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
      setSignedIn(false);
      setMe(null);
      setData(null);
      setMessage(L.accounts.passwordChangedSignOut);
      return true;
    } finally {
      setBusy(false);
    }
  }

  const LanguageToggle = (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {(["de", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => chooseLanguage(code)}
          aria-pressed={language === code}
          className={
            language === code
              ? "bg-slate-900 px-3 py-1.5 text-white"
              : "px-3 py-1.5 text-slate-700"
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (signedIn === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p className="text-sm text-slate-500">…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex justify-end">{LanguageToggle}</div>
          <form
            onSubmit={signIn}
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

            {/* One message for a wrong username, a wrong password and a
                disabled account: a caller learns only that they are not in.
                Rate-limiting gets its own message — that is a "wait", not a
                "wrong". */}
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

  const counts = data?.counts;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{L.signIn.heading}</h1>
            {me && (
              <p className="text-sm text-slate-500">
                {me.displayName} · {L.accounts.roles[me.role]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {LanguageToggle}
            <button type="button" onClick={signOut} className="text-sm text-slate-600 underline">
              {L.nav.signOut}
            </button>
          </div>
        </header>

        {me && (
          <SelfPasswordForm L={L} busy={busy} onChangePassword={changeMyPassword} />
        )}

        {message && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {message}
          </p>
        )}

        {counts && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                [L.counts.available, counts.available],
                [L.counts.rented, counts.rented],
                [L.counts.retired, counts.retired],
                [L.counts.activeRentals, counts.activeRentals],
                [L.counts.returnsAwaiting, counts.returnsAwaiting],
                [L.counts.contracts, counts.contracts],
                [L.counts.mailFailed, counts.mailFailed],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-xl font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </section>
        )}

        {data && data.latestContractAt && (
          <p className="text-xs text-slate-500">
            {L.fleet.latestContract}: {day(data.latestContractAt)}
          </p>
        )}

        <AddCar
          L={L}
          busy={busy}
          onAdd={(body) =>
            write("/api/admin/cars/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            })
          }
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
            {L.fleet.heading}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="p-3 font-medium">{L.fleet.model}</th>
                  <th className="p-3 font-medium">{L.fleet.plate}</th>
                  <th className="p-3 font-medium">{L.fleet.vin}</th>
                  <th className="p-3 font-medium">{L.fleet.status}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {data?.cars.map((car) => (
                  <CarRow
                    key={car.id}
                    car={car}
                    L={L}
                    busy={busy}
                    onSave={(body) =>
                      write(`/api/admin/cars/${car.id}/`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                      })
                    }
                    onDelete={() => deleteCar(car.id)}
                  />
                ))}
                {data?.cars.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-sm text-slate-500">
                      {L.fleet.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
            {L.rentals.heading}
          </h2>
          {data?.rentals.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{L.rentals.none}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.rentals.map((rental) => (
                <RentalRow
                  key={rental.id}
                  rental={rental}
                  L={L}
                  busy={busy}
                  onClose={() =>
                    write(`/api/admin/rentals/${rental.id}/close/`, { method: "POST" })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-400">{L.rentals.closeHint}</p>

        {me?.role === "owner" && (
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
                      <td className="p-3 text-slate-600">
                        {L.accounts.roles[account.role]}
                      </td>
                      <td className="p-3 text-slate-500">
                        {account.lastSignInAt
                          ? day(account.lastSignInAt)
                          : L.accounts.never}
                      </td>
                      <td className="p-3">
                        <AccountActions
                          account={account}
                          L={L}
                          onChanged={loadAccounts}
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
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder={L.accounts.newPassword}
                autoComplete="new-password"
                className="h-10 rounded-md border border-input px-3 text-sm"
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
        )}
      </div>
    </main>
  );
}

type Labels = ReturnType<typeof labelsFor>;

function AddCar({
  L,
  busy,
  onAdd,
}: {
  L: Labels;
  busy: boolean;
  onAdd: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onAdd({ model, plate, vin })) {
          setModel("");
          setPlate("");
          setVin("");
        }
      }}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
    >
      <Input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={L.fleet.model}
      />
      <Input
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder={L.fleet.platePlaceholder}
      />
      <Input
        value={vin}
        onChange={(e) => setVin(e.target.value)}
        placeholder={L.fleet.vinOptional}
      />
      <button
        type="submit"
        disabled={busy || !model.trim() || !plate.trim()}
        className="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {L.fleet.add}
      </button>
    </form>
  );
}

function CarRow({
  car,
  L,
  busy,
  onSave,
  onDelete,
}: {
  car: Car;
  L: Labels;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rented = car.status === "rented";
  const retired = car.status === "retired";
  const dirty = model !== car.model || plate !== car.plate || vin !== (car.vin ?? "");
  const style = STATUS_STYLE[car.status] ?? "bg-slate-100 text-slate-700";
  const statusLabel =
    L.fleet.statuses[car.status as keyof typeof L.fleet.statuses] ?? car.status;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="p-3 align-middle">
        <Input value={model} onChange={(e) => setModel(e.target.value)} className="h-10" />
      </td>
      <td className="p-3 align-middle tabular-nums">
        <Input value={plate} onChange={(e) => setPlate(e.target.value)} className="h-10 tabular-nums" />
      </td>
      <td className="p-3 align-middle">
        <Input value={vin} onChange={(e) => setVin(e.target.value)} className="h-10" />
      </td>
      <td className="p-3 align-middle">
        <span className={`rounded-full px-2 py-0.5 text-xs ${style}`}>{statusLabel}</span>
      </td>
      <td className="p-3 align-middle whitespace-nowrap">
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <>
              <button
                type="button"
                disabled={busy}
                // The row's own state already matches what is being sent; the
                // refetch behind onSave replaces it with the server's copy.
                onClick={() => onSave({ model, plate, vin })}
                className="h-10 rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {L.fleet.save}
              </button>
              <button
                type="button"
                // Discards the typed edit and goes back to what the server
                // last reported — the only way to undo a typo, since the
                // fields are always editable rather than behind an edit mode.
                onClick={() => {
                  setModel(car.model);
                  setPlate(car.plate);
                  setVin(car.vin ?? "");
                }}
                className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
              >
                {L.fleet.cancel}
              </button>
            </>
          )}

          {/* A rented car has no toggle at all: it is freed by closing its
              rental, so offering a disabled button here would only invite
              the question of why it does not work. */}
          {!rented && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave({ status: retired ? "available" : "retired" })}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
            >
              {retired ? L.fleet.reactivate : L.fleet.retire}
            </button>
          )}

          {!rented &&
            (confirmingDelete ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!(await onDelete())) setConfirmingDelete(false);
                  }}
                  className="h-10 rounded-md bg-red-600 px-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {L.fleet.deleteConfirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
                >
                  {L.fleet.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-10 rounded-md px-3 text-sm text-slate-600 underline"
              >
                {L.fleet.delete}
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}

function RentalRow({
  rental,
  L,
  busy,
  onClose,
}: {
  rental: Rental;
  L: Labels;
  busy: boolean;
  onClose: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-medium text-slate-900">
          {rental.carPlate} · {rental.customerName}
          {/* The renter has filled in the return form; the car stays marked
              rented until somebody here confirms it. */}
          {rental.returnSubmittedAt && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {L.rentals.returned}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {day(rental.startAt)} – {day(rental.endAt)}
          {rental.contractNumber ? ` · ${rental.contractNumber}` : ""}
          {rental.returnSubmittedAt
            ? ` · ${L.rentals.returnedOn} ${day(rental.returnSubmittedAt)}${
                rental.returnContractNumber ? ` · ${rental.returnContractNumber}` : ""
              }`
            : ""}
        </p>
      </div>

      {/* Confirmed, because it moves two rows and is an override rather than
          the return protocol. */}
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
          >
            {L.rentals.closeConfirm}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-10 rounded-md px-3 text-sm text-slate-500 underline"
          >
            {L.rentals.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-10 rounded-md px-3 text-sm text-slate-600 underline"
        >
          {L.rentals.close}
        </button>
      )}
    </li>
  );
}

function AccountActions({
  account,
  L,
  onChanged,
  onError,
}: {
  account: Account;
  L: Labels;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch(`/api/admin/users/${account.id}/`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        onError(messageForCode(L, result.code));
        return;
      }
      setNewPassword("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={L.accounts.newPassword}
        autoComplete="new-password"
        className="h-10 w-40 rounded-md border border-input px-2 text-sm"
      />
      <button
        type="button"
        disabled={busy || newPassword.length < 10}
        onClick={() => patch({ password: newPassword })}
        className="h-10 rounded-md bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
      >
        {L.accounts.setPassword}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ disabled: !account.disabledAt })}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
      >
        {account.disabledAt ? L.accounts.enable : L.accounts.disable}
      </button>
    </div>
  );
}

/** Visible to any signed-in user — owner or staff — since the endpoint it
 *  calls lets either change their own password. There is no owner gate on
 *  this component; the fence is `PATCH /api/admin/users/[id]/`'s own
 *  self-password-only carve-out for staff. */
function SelfPasswordForm({
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
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={L.accounts.newPassword}
        autoComplete="new-password"
        className="h-10 w-40 rounded-md border border-input px-2 text-sm"
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
