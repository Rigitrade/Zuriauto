"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

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
}

interface Overview {
  cars: Car[];
  rentals: Rental[];
  counts: {
    available: number;
    retired: number;
    rented: number;
    activeRentals: number;
    contracts: number;
    mailFailed: number;
  };
  latestContractAt: string | null;
}

function day(iso: string): string {
  const [date] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export default function AdminDashboard() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [signInError, setSignInError] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  // The cookie may already be valid from this morning, so the page tries before
  // asking — the office should not retype the secret on every reload.
  useEffect(() => {
    void load();
  }, [load]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSignInError(false);
    try {
      const response = await fetch("/api/admin/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) {
        setSignInError(true);
        return;
      }
      setSecret("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session/", { method: "DELETE" });
    setSignedIn(false);
    setData(null);
  }

  /** Every write goes through here, so one place reports failure and refetches. */
  async function write(url: string, init: RequestInit, failure: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(`${failure}${body.code ? ` (${body.code})` : ""}`);
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
        <form
          onSubmit={signIn}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-slate-900">ZURIAUTO Fleet</h1>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Zugangscode"
            autoFocus
            autoComplete="current-password"
          />
          {/* One message for a wrong code, a missing one and an unconfigured
              server: a caller learns only that they are not in. */}
          {signInError && (
            <p className="text-sm text-red-600">Zugang verweigert.</p>
          )}
          <button
            type="submit"
            disabled={busy || !secret}
            className="h-10 w-full rounded-md bg-slate-900 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "…" : "Anmelden"}
          </button>
        </form>
      </main>
    );
  }

  const counts = data?.counts;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            ZURIAUTO Fleet
          </h1>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-slate-600 underline"
          >
            Abmelden
          </button>
        </header>

        {message && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {message}
          </p>
        )}

        {counts && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Verfügbar", counts.available],
              ["Vermietet", counts.rented],
              ["Ausser Betrieb", counts.retired],
              ["Aktive Mieten", counts.activeRentals],
              ["Verträge", counts.contracts],
              ["Mail offen", counts.mailFailed],
            ].map(([label, value]) => (
              <div
                key={label as string}
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
            Letzter Vertrag: {day(data.latestContractAt)}
          </p>
        )}

        <AddCar
          busy={busy}
          onAdd={(body) =>
            write(
              "/api/admin/cars/",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              },
              "Fahrzeug konnte nicht hinzugefügt werden"
            )
          }
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
            Fahrzeuge
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {data?.cars.map((car) => (
                  <CarRow
                    key={car.id}
                    car={car}
                    busy={busy}
                    onSave={(body) =>
                      write(
                        `/api/admin/cars/${car.id}/`,
                        {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify(body),
                        },
                        "Änderung nicht möglich"
                      )
                    }
                  />
                ))}
                {data?.cars.length === 0 && (
                  <tr>
                    <td className="p-4 text-slate-500">
                      Noch keine Fahrzeuge erfasst.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900">
            Aktive Mieten
          </h2>
          {data?.rentals.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Keine Fahrzeuge unterwegs.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data?.rentals.map((rental) => (
                <RentalRow
                  key={rental.id}
                  rental={rental}
                  busy={busy}
                  onClose={() =>
                    write(
                      `/api/admin/rentals/${rental.id}/close/`,
                      { method: "POST" },
                      "Miete konnte nicht abgeschlossen werden"
                    )
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <p className="pb-6 text-xs text-slate-400">
          «Miete abschliessen» gibt das Fahrzeug frei und ersetzt nicht das
          Rückgabeprotokoll.
        </p>
      </div>
    </main>
  );
}

function AddCar({
  busy,
  onAdd,
}: {
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
        placeholder="Marke und Modell"
      />
      <Input
        value={plate}
        onChange={(e) => setPlate(e.target.value)}
        placeholder="ZH 123 456"
      />
      <Input
        value={vin}
        onChange={(e) => setVin(e.target.value)}
        placeholder="Fahrgestell-Nr. (optional)"
      />
      <button
        type="submit"
        disabled={busy || !model.trim() || !plate.trim()}
        className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        Hinzufügen
      </button>
    </form>
  );
}

function CarRow({
  car,
  busy,
  onSave,
}: {
  car: Car;
  busy: boolean;
  onSave: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(car.model);
  const [plate, setPlate] = useState(car.plate);
  const [vin, setVin] = useState(car.vin ?? "");

  const rented = car.status === "rented";
  const retired = car.status === "retired";

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="p-3 align-middle">
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
            <Input
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              placeholder="Fahrgestell-Nr."
            />
          </div>
        ) : (
          <div>
            <p className="font-medium text-slate-900">{car.plate}</p>
            <p className="text-xs text-slate-500">
              {car.model}
              {car.vin ? ` · ${car.vin}` : ""}
            </p>
          </div>
        )}
      </td>

      <td className="p-3 align-middle">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            rented
              ? "bg-blue-50 text-blue-700"
              : retired
                ? "bg-slate-100 text-slate-600"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {rented ? "Vermietet" : retired ? "Ausser Betrieb" : "Verfügbar"}
        </span>
      </td>

      <td className="p-3 text-right align-middle whitespace-nowrap">
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await onSave({ model, plate, vin })) setEditing(false);
              }}
              className="text-sm text-slate-900 underline disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setModel(car.model);
                setPlate(car.plate);
                setVin(car.vin ?? "");
                setEditing(false);
              }}
              className="ml-3 text-sm text-slate-500 underline"
            >
              Abbrechen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-slate-600 underline"
            >
              Bearbeiten
            </button>
            {/* A rented car has no toggle at all: it is freed by closing its
                rental, so offering a disabled button here would only invite
                the question of why it does not work. */}
            {!rented && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onSave({ status: retired ? "available" : "retired" })
                }
                className="ml-3 text-sm text-slate-600 underline disabled:opacity-50"
              >
                {retired ? "In Betrieb nehmen" : "Ausser Betrieb"}
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

function RentalRow({
  rental,
  busy,
  onClose,
}: {
  rental: Rental;
  busy: boolean;
  onClose: () => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-medium text-slate-900">
          {rental.carPlate} · {rental.customerName}
        </p>
        <p className="text-xs text-slate-500">
          {day(rental.startAt)} – {day(rental.endAt)}
          {rental.contractNumber ? ` · ${rental.contractNumber}` : ""}
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
            className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
          >
            Wirklich abschliessen
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-slate-500 underline"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-slate-600 underline"
        >
          Miete abschliessen
        </button>
      )}
    </li>
  );
}
