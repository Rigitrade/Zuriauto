"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  ADMIN_LANGUAGE_KEY,
  asAdminLanguage,
  labelsFor,
  type AdminLanguage,
} from "@/lib/admin/labels";

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

interface Overview {
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

type Me = { displayName: string; role: "owner" | "staff" };

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
    setData(await response.json());
  }, []);

  // The cookie may already be valid from this morning, so the page tries
  // before asking — the office should not sign in again on every reload.
  useEffect(() => {
    void load();
  }, [load]);

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

  /** Every write goes through here, so one place reports failure and refetches. */
  async function write(url: string, init: RequestInit, failure: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        setMessage(failure);
        return false;
      }
      await load();
      return true;
    } catch {
      setMessage(failure);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Deletion is narrower than the other writes: a car with rental history
   *  refuses with 409, and that refusal gets its own explanation rather than
   *  the generic failure message. */
  async function deleteCar(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/cars/${id}/`, { method: "DELETE" });
      if (response.status === 409) {
        setMessage(L.fleet.hasHistory);
        return false;
      }
      if (!response.ok) {
        setMessage(L.errors.generic);
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

        <AddCar
          L={L}
          busy={busy}
          onAdd={(body) =>
            write(
              "/api/admin/cars/",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              },
              L.errors.generic
            )
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
                      write(
                        `/api/admin/cars/${car.id}/`,
                        {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify(body),
                        },
                        L.errors.generic
                      )
                    }
                    onDelete={() => deleteCar(car.id)}
                  />
                ))}
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
                    write(
                      `/api/admin/rentals/${rental.id}/close/`,
                      { method: "POST" },
                      L.errors.generic
                    )
                  }
                />
              ))}
            </ul>
          )}
        </section>
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
        placeholder={L.fleet.plate}
      />
      <Input
        value={vin}
        onChange={(e) => setVin(e.target.value)}
        placeholder={L.fleet.vin}
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
                  {L.rentals.cancel}
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
