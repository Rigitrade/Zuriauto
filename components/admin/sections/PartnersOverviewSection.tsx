"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, RefreshCw, Search } from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";
import { STATUS_CHIP } from "@/components/admin/parts/CarRow";
import { day } from "@/components/admin/format";
import { ColourDot } from "@/components/ui/colour-dot";
import { mfkStanding } from "@/lib/admin/mfk";
import { serviceStanding } from "@/lib/admin/service";
import { formatChf } from "@/lib/rental/money";
import type { CompanyOverview, FleetCar, PartnerOverview } from "@/lib/admin/partnerOverview";

/**
 * "Partner": every company side by side, for ZURIAUTO's owner (16.11.2026).
 *
 * Three layers, from the whole to the single car: totals across all
 * companies, one row per company with its cars and its money, and one fleet
 * list across all of them that filters down to a company, a status or a
 * name. Read-only throughout; "Ansehen" opens a partner's own console in the
 * read-only view (phase D) for anything deeper.
 */

const STATUSES = ["available", "rented", "maintenance", "retired"] as const;
type Status = (typeof STATUSES)[number];

/**
 * The fleet bar's colours: rented in amber, as on the fleet's status chips,
 * the garage in red, so the four never blur into each other.
 *
 * (Both tables sit in a *relative* scroller: the chips' screen-reader text is
 * positioned, and would otherwise widen the whole page on a phone.)
 */
const BAR: Record<Status, string> = {
  available: "bg-[var(--admin-good)]",
  rented: "bg-[var(--admin-attn)]",
  maintenance: "bg-[var(--admin-crit)]",
  retired: "bg-[var(--admin-rule-strong)]",
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

export function PartnersOverviewSection() {
  const { L, me, language } = useAdmin();
  const T = L.partnerOverview;
  const router = useRouter();
  const allowed = me.canManagePartners === true;
  // Only a definite "no" sends somebody away: right after signing in, the
  // flag is not known yet until the overview has loaded.
  const refused = me.canManagePartners === false;

  const [data, setData] = useState<PartnerOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch("/api/admin/partners/overview/", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as PartnerOverview);
      setNow(new Date());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (refused) router.replace("/admin");
    else if (allowed) void load();
  }, [allowed, refused, load, router]);

  if (!allowed) return null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-[var(--admin-muted)]">{T.intro}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm font-medium transition-colors hover:bg-[var(--admin-sunk)]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {T.retry}
        </button>
      </div>

      {failed && (
        <p role="alert" className="rounded-lg border border-[var(--admin-crit)]/30 bg-[var(--admin-crit-soft)] px-4 py-3 text-sm text-[var(--admin-crit)]">
          {T.failed}
        </p>
      )}

      {!data || !now ? (
        !failed && <p className="px-1 text-sm text-[var(--admin-faint)]">{T.loading}</p>
      ) : (
        <>
          <Totals companies={data.companies} T={T} />
          <CompaniesPanel companies={data.companies} T={T} />
          <FleetPanel cars={data.cars} companies={data.companies} now={now} T={T} statusLabels={L.fleet.statuses} language={language} />
        </>
      )}
    </>
  );
}

type Texts = ReturnType<typeof useAdmin>["L"]["partnerOverview"];

// ---------------------------------------------------------------------------
// Totals across every company.

function Totals({ companies, T }: { companies: CompanyOverview[]; T: Texts }) {
  const sum = (pick: (c: CompanyOverview) => number) => companies.reduce((total, c) => total + pick(c), 0);
  const owed = sum((c) => c.owedCents);
  const mfk = sum((c) => c.mfk.due + c.mfk.expired);
  const service = sum((c) => c.service.due + c.service.overdue);
  const overdueFines = sum((c) => c.fines.overdue);
  const returns = sum((c) => c.returnsToCheck);

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Tile
        label={T.totals.companies}
        value={String(companies.length)}
        detail={fill(T.totals.companiesActive, { count: companies.filter((c) => !c.disabled).length })}
      />
      <Tile
        label={T.totals.cars}
        value={String(sum((c) => c.cars.total))}
        detail={fill(T.totals.carsRented, { count: sum((c) => c.cars.rented) })}
      />
      <Tile
        label={T.totals.rentals}
        value={String(sum((c) => c.activeRentals))}
        detail={returns > 0 ? fill(T.totals.returns, { count: returns }) : undefined}
        tone={returns > 0 ? "attn" : undefined}
      />
      <Tile
        label={T.totals.owed}
        value={owed > 0 ? `CHF ${formatChf(owed)}` : "—"}
        detail={owed > 0 ? fill(T.totals.owedRentals, { count: sum((c) => c.owingRentals) }) : T.totals.none}
        tone={owed > 0 ? "attn" : undefined}
      />
      <Tile
        label={T.totals.fines}
        value={String(sum((c) => c.fines.open))}
        detail={overdueFines > 0 ? fill(T.totals.finesOverdue, { count: overdueFines }) : undefined}
        tone={overdueFines > 0 ? "crit" : undefined}
      />
      <Tile
        label={T.totals.mfk}
        value={String(mfk + service)}
        detail={mfk + service > 0 ? fill(T.totals.mfkDetail, { mfk, service }) : T.allClear}
        tone={mfk + service > 0 ? "attn" : undefined}
      />
    </dl>
  );
}

function Tile(props: { label: string; value: string; detail?: string; tone?: "attn" | "crit"; className?: string }) {
  const toneText =
    props.tone === "crit" ? "text-[var(--admin-crit)]" : props.tone === "attn" ? "text-[var(--admin-attn)]" : "text-[var(--admin-faint)]";
  return (
    <div className={`rounded-xl border border-[var(--admin-rule)] bg-[var(--admin-surface)] px-4 py-3 ${props.className ?? ""}`}>
      <dt className="text-xs text-[var(--admin-muted)]">{props.label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{props.value}</dd>
      {props.detail && <dd className={`mt-0.5 text-xs ${toneText}`}>{props.detail}</dd>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One row per company.

function CompaniesPanel({ companies, T }: { companies: CompanyOverview[]; T: Texts }) {
  const [opening, setOpening] = useState<string | null>(null);

  async function view(company: CompanyOverview) {
    setOpening(company.id);
    try {
      const response = await fetch("/api/admin/view/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organisationId: company.id }),
      });
      if (response.ok) {
        window.location.assign("/admin/");
        return;
      }
    } catch {
      // Falls through: the buttons come back, to try again.
    }
    setOpening(null);
  }

  return (
    <Panel title={T.companiesHeading} meta={String(companies.length)}>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[58rem] text-sm">
          <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">{T.colCompany}</th>
              <th className="px-4 py-2.5 text-left font-medium">{T.colFleet}</th>
              <th className="px-4 py-2.5 text-right font-medium">{T.colRentals}</th>
              <th className="px-4 py-2.5 text-right font-medium">{T.colOwed}</th>
              <th className="px-4 py-2.5 text-right font-medium">{T.colFines}</th>
              <th className="px-4 py-2.5 text-left font-medium">{T.colDue}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr
                key={company.id}
                className={`border-t border-[var(--admin-rule)] align-top ${company.disabled ? "bg-[var(--admin-sunk)]/40" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${company.disabled ? "text-[var(--admin-muted)]" : ""}`}>{company.name}</span>
                    {company.isSite && (
                      <span className="rounded-full bg-[var(--admin-accent-soft)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--admin-accent)]">
                        {T.site}
                      </span>
                    )}
                    {company.disabled && (
                      <span className="rounded-full bg-[var(--admin-crit-soft)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--admin-crit)]">
                        {T.off}
                      </span>
                    )}
                  </div>
                  {company.slug && !company.isSite && (
                    <div className="mt-0.5 font-mono text-xs text-[var(--admin-faint)]">/{company.slug}</div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <FleetBar cars={company.cars} T={T} />
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <div>{company.activeRentals}</div>
                  {company.returnsToCheck > 0 && (
                    <div className="mt-0.5 text-xs text-[var(--admin-attn)]">
                      {fill(T.returnsShort, { count: company.returnsToCheck })}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  {company.owedCents > 0 ? (
                    <>
                      <div className="font-medium whitespace-nowrap text-[var(--admin-attn)]">CHF {formatChf(company.owedCents)}</div>
                      <div className="mt-0.5 text-xs text-[var(--admin-faint)]">{fill(T.owingShort, { count: company.owingRentals })}</div>
                    </>
                  ) : (
                    <span className="text-[var(--admin-faint)]">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <div className={company.fines.open === 0 ? "text-[var(--admin-faint)]" : ""}>{company.fines.open}</div>
                  {company.fines.overdue > 0 && (
                    <div className="mt-0.5 text-xs text-[var(--admin-crit)]">{fill(T.overdueShort, { count: company.fines.overdue })}</div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <DueChips company={company} T={T} />
                </td>

                <td className="px-4 py-3 text-right">
                  {company.isSite ? (
                    <Link
                      href="/admin"
                      className="inline-flex h-8 items-center rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--admin-sunk)]"
                    >
                      {T.open}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={opening !== null}
                      onClick={() => void view(company)}
                      className="inline-flex h-8 items-center rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--admin-sunk)] disabled:opacity-50"
                    >
                      {T.view}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** How the fleet splits up, as one bar and the words for it. */
function FleetBar({ cars, T }: { cars: CompanyOverview["cars"]; T: Texts }) {
  if (cars.total === 0) return <span className="text-[var(--admin-faint)]">{T.noCars}</span>;
  const parts = STATUSES.filter((status) => cars[status] > 0);
  const words = parts.map((status) => `${cars[status]} ${T.fleetLegend[status]}`).join(" · ");
  return (
    <div className="min-w-[11rem]">
      <div className="flex items-baseline gap-2">
        <span className="font-medium tabular-nums">{cars.total}</span>
        <span className="text-xs text-[var(--admin-muted)]">{words}</span>
      </div>
      <div className="mt-1.5 flex h-1.5 w-40 overflow-hidden rounded-full bg-[var(--admin-sunk)]" aria-hidden="true">
        {parts.map((status) => (
          <span key={status} className={BAR[status]} style={{ width: `${(cars[status] / cars.total) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function DueChips({ company, T }: { company: CompanyOverview; T: Texts }) {
  const mfk = company.mfk.due + company.mfk.expired;
  const service = company.service.due + company.service.overdue;
  if (mfk === 0 && service === 0) return <span className="text-xs text-[var(--admin-faint)]">{T.allClear}</span>;
  const chip = (urgent: boolean) =>
    `rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${
      urgent
        ? "bg-[var(--admin-crit-soft)] text-[var(--admin-crit)] ring-[var(--admin-crit)]/20"
        : "bg-[var(--admin-attn-soft)] text-[var(--admin-attn)] ring-[var(--admin-attn)]/20"
    }`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {mfk > 0 && <span className={chip(company.mfk.expired > 0)}>{fill(T.mfkShort, { count: mfk })}</span>}
      {service > 0 && <span className={chip(company.service.overdue > 0)}>{fill(T.serviceShort, { count: service })}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One fleet list across all companies.

function FleetPanel(props: {
  cars: FleetCar[];
  companies: CompanyOverview[];
  now: Date;
  T: Texts;
  statusLabels: Record<Status, string>;
  language: ReturnType<typeof useAdmin>["language"];
}) {
  const { cars, companies, now, T, statusLabels, language } = props;
  const [company, setCompany] = useState("all");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const siteId = companies.find((c) => c.isSite)?.id;

  // The status counts follow the company and the search, so each button says
  // what pressing it would show.
  const beforeStatus = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cars.filter(
      (car) =>
        (company === "all" || car.companyId === company) &&
        (!needle ||
          [car.model, car.plate, car.plate.replace(/\s+/g, ""), car.renterName ?? "", car.companyName]
            .join(" ")
            .toLowerCase()
            .includes(needle))
    );
  }, [cars, company, query]);
  const shown = status === "all" ? beforeStatus : beforeStatus.filter((car) => car.status === status);

  return (
    <Panel title={T.fleetHeading} meta={fill(T.shown, { shown: shown.length, total: cars.length })}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-rule)] px-4 py-3">
        <label className="sr-only" htmlFor="fleet-company">
          {T.filterCompany}
        </label>
        <select
          id="fleet-company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className="h-9 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-2 text-sm outline-none focus-visible:border-[var(--admin-accent)]"
        >
          <option value="all">{T.allCompanies}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div role="group" aria-label={T.colStatus} className="flex flex-wrap gap-1 rounded-md bg-[var(--admin-sunk)] p-1 text-xs">
          {(["all", ...STATUSES] as const).map((option) => {
            const count = option === "all" ? beforeStatus.length : beforeStatus.filter((car) => car.status === option).length;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                onClick={() => setStatus(option)}
                className={`h-7 rounded px-2.5 whitespace-nowrap ${
                  status === option ? "bg-[var(--admin-surface)] font-medium shadow-sm" : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                }`}
              >
                {option === "all" ? T.filterAll : statusLabels[option]}{" "}
                <span className="tabular-nums text-[var(--admin-faint)]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative ml-auto min-w-[14rem] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-faint)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={T.search}
            aria-label={T.search}
            className="h-9 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] pr-3 pl-8 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20 sm:w-72"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--admin-faint)]">{T.noMatch}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{T.colCompany}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colCar}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colPlate}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colStatus}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colUntil}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colMfk}</th>
                <th className="px-4 py-2.5 text-left font-medium">{T.colService}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((car) => (
                <CarLine key={car.id} car={car} own={car.companyId === siteId} now={now} T={T} statusLabels={statusLabels} language={language} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function CarLine(props: {
  car: FleetCar;
  own: boolean;
  now: Date;
  T: Texts;
  statusLabels: Record<Status, string>;
  language: ReturnType<typeof useAdmin>["language"];
}) {
  const { car, own, now, T, statusLabels, language } = props;
  const label = statusLabels[car.status as Status] ?? car.status;
  const out = car.status === "rented" && car.renterName;
  const mfk = car.status === "retired" ? "none" : mfkStanding(car.mfkDate, now);
  const service = car.status === "retired" ? "none" : serviceStanding(car);

  return (
    <tr className="border-t border-[var(--admin-rule)] transition-colors hover:bg-[var(--admin-sunk)]/50">
      <td className="px-4 py-3 text-[var(--admin-muted)]">{car.companyName}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ColourDot colour={car.colour} language={language} />
          {/* ZURIAUTO's own cars open their page; a partner's are seen through "Ansehen". */}
          {own ? (
            <Link href={`/admin/vehicles/${car.id}`} className="font-medium whitespace-nowrap underline-offset-2 hover:underline">
              {car.model}
            </Link>
          ) : (
            <span className="font-medium whitespace-nowrap">{car.model}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-sm whitespace-nowrap tabular-nums text-[var(--admin-muted)]">{car.plate}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex max-w-[13rem] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
            STATUS_CHIP[car.status] ?? "bg-[var(--admin-sunk)] text-[var(--admin-muted)] ring-[var(--admin-rule-strong)]"
          }`}
          title={out ? `${label}: ${car.renterName}` : undefined}
        >
          {out ? (
            <>
              <KeyRound className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">{label}: </span>
              <span className="truncate">{car.renterName}</span>
            </>
          ) : (
            label
          )}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-[var(--admin-muted)]">
        {car.rentalEndAt ? day(car.rentalEndAt) : car.renterName ? T.openEnded : <span className="text-[var(--admin-faint)]">—</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
        {car.mfkDate ? (
          <span
            className={
              mfk === "expired"
                ? "font-medium text-[var(--admin-crit)]"
                : mfk === "due"
                  ? "font-medium text-[var(--admin-attn)]"
                  : "text-[var(--admin-muted)]"
            }
          >
            {day(car.mfkDate)}
          </span>
        ) : (
          <span className="text-[var(--admin-faint)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {service === "none" ? (
          <span className="text-[var(--admin-faint)]">—</span>
        ) : (
          <span
            className={
              service === "overdue"
                ? "font-medium text-[var(--admin-crit)]"
                : service === "due"
                  ? "font-medium text-[var(--admin-attn)]"
                  : "text-[var(--admin-muted)]"
            }
          >
            {service === "overdue" ? T.serviceOverdue : service === "due" ? T.serviceDue : T.serviceOk}
          </span>
        )}
      </td>
    </tr>
  );
}
