"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Car as CarIcon,
  FileText,
  Gauge,
  IdCard,
  Pencil,
} from "lucide-react";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { CarMaintenance } from "@/components/admin/parts/CarMaintenance";
import { EditCarDialog } from "@/components/admin/parts/EditCarDialog";
import { Panel } from "@/components/admin/parts/Panel";
import { day } from "@/components/admin/format";
import { ColourDot } from "@/components/ui/colour-dot";
import { carColourName } from "@/lib/carColour";
import { mfkStanding } from "@/lib/admin/mfk";
import { formatKm, kmUntilService, serviceStanding } from "@/lib/admin/service";
import { formatChf } from "@/lib/rental/money";
import type { Car, Labels } from "@/components/admin/types";

/**
 * One car, everything about it, on a page of its own.
 *
 * The fleet table answers "which car should I look at" for nine cars at a
 * glance; it cannot also answer "tell me everything about this one" without
 * growing a column per fact — and it was already scrolling sideways at seven.
 * So the facts that are read rather than scanned live here: the photograph at
 * a size somebody can actually see, the registration document, the colour, the
 * two inspection dates, the service book and the repair history.
 *
 * It reads the overview payload the shell already holds rather than fetching
 * anything. That is what makes the page instant from the fleet list, and it
 * means the same data paints both screens — a profile that fetched its own
 * copy would be the place where the two could disagree.
 *
 * The rental history is the one thing deliberately *not* inlined. That
 * endpoint audits every read into `CarHistoryLookup`, because it returns a
 * past renter's mobile and email — and if simply opening a car's profile wrote
 * an audit row, the deliberate lookups ("who was driving ZH 589 864 on the
 * 12th") would be buried under hundreds of incidental ones. So this links to
 * the history screen, where asking is an act rather than a side effect.
 *
 * Editing happens in the same two dialogs the fleet row opens, imported rather
 * than reimplemented: two edit forms for one car is how the plate becomes
 * correctable in one place and not the other.
 */
export function CarProfileSection({ carId }: { carId: string }) {
  const { L, language, data, busy, write } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [maintaining, setMaintaining] = useState(false);

  // `data` is null only before the first payload arrives. Nothing is rendered
  // then rather than a "no such car" that would flash on every reload.
  if (!data) return null;

  const car = data.cars.find((entry) => entry.id === carId);
  if (!car) {
    return (
      <Panel title={L.fleet.profile}>
        <div className="grid gap-3 px-4 py-8 text-center">
          <p className="text-sm text-[var(--admin-faint)]">
            {L.fleet.profileNotFound}
          </p>
          <BackLink L={L} />
        </div>
      </Panel>
    );
  }

  const rental = data.rentals.find((entry) => entry.id === car.activeRentalId);

  return (
    <div className="grid gap-4">
      <EditCarDialog
        car={car}
        L={L}
        language={language}
        busy={busy}
        open={editing}
        onClose={() => setEditing(false)}
        onSave={async (body) => {
          const ok = await write(`/api/admin/cars/${car.id}/`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (ok) setEditing(false);
          return ok;
        }}
        onUploadPhoto={(blob) =>
          write(`/api/admin/cars/${car.id}/photo/`, {
            method: "PUT",
            headers: { "content-type": blob.type || "image/jpeg" },
            body: blob,
          })
        }
        onRemovePhoto={() =>
          write(`/api/admin/cars/${car.id}/photo/`, { method: "DELETE" })
        }
        onUploadLicence={(file) =>
          write(`/api/admin/cars/${car.id}/licence/`, {
            method: "PUT",
            headers: { "content-type": file.type || "application/pdf" },
            body: file,
          })
        }
        onRemoveLicence={() =>
          write(`/api/admin/cars/${car.id}/licence/`, { method: "DELETE" })
        }
      />

      <CarMaintenance
        car={car}
        L={L}
        busy={busy}
        open={maintaining}
        onClose={() => setMaintaining(false)}
        onSave={(body) =>
          write(`/api/admin/cars/${car.id}/`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        }
        onAddRepair={(body) =>
          write(`/api/admin/cars/${car.id}/repairs/`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        }
        onUpdateRepair={(repairId, body) =>
          write(`/api/admin/cars/${car.id}/repairs/${repairId}/`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        }
        onDeleteRepair={(repairId) =>
          write(`/api/admin/cars/${car.id}/repairs/${repairId}/`, {
            method: "DELETE",
          })
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink L={L} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMaintaining(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
          >
            <Gauge className="h-4 w-4" aria-hidden="true" />
            {L.fleet.maintenance}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {L.fleet.edit}
          </button>
        </div>
      </div>

      {/* The car itself: the photograph at a size that identifies it, and
          beside it the facts that name it. */}
      <Panel
        title={`${car.model} · ${car.plate}`}
        meta={
          L.fleet.statuses[car.status as keyof typeof L.fleet.statuses] ??
          car.status
        }
      >
        <div className="grid gap-4 p-4 sm:grid-cols-[18rem_1fr]">
          <div className="grid h-48 place-items-center overflow-hidden rounded-lg border border-[var(--admin-rule)] bg-[var(--admin-sunk)] sm:h-44">
            {car.photoUrl ? (
              // A plain <img>: the source is an API route serving bytes the
              // uploading browser already sized to 1600px, and the optimiser
              // would add a round trip for no gain.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={car.photoUrl}
                alt={`${car.model} ${car.plate}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <CarIcon
                className="h-10 w-10 text-[var(--admin-faint)]"
                aria-hidden="true"
              />
            )}
          </div>

          <dl className="grid content-start gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label={L.fleet.model}>{car.model}</Fact>
            <Fact label={L.fleet.plate} mono>
              {car.plate}
            </Fact>
            <Fact label={L.fleet.colour}>
              {car.colour ? (
                <span className="flex items-center gap-2">
                  <ColourDot colour={car.colour} language={language} />
                  {carColourName(car.colour, language)}
                </span>
              ) : (
                <Gap>{L.fleet.colourNone}</Gap>
              )}
            </Fact>
            <Fact label={L.fleet.vin} mono>
              {car.vin ?? <Gap>{L.fleet.profileNothing}</Gap>}
            </Fact>
          </dl>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* The papers. Its own panel rather than a row in the identity block,
            because it is a document to open, not a value to read. */}
        <Panel title={L.fleet.licenceHeading}>
          <div className="p-4">
            {car.licenceUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={car.licenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)]"
                >
                  {car.licenceIsPdf ? (
                    <FileText
                      className="h-6 w-6 text-[var(--admin-muted)]"
                      aria-hidden="true"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={car.licenceUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </a>
                <div className="grid gap-1.5">
                  <a
                    href={car.licenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
                  >
                    <IdCard className="h-4 w-4" aria-hidden="true" />
                    {L.fleet.licenceOpen}
                  </a>
                  {car.licenceUpdatedAt && (
                    <p className="text-xs text-[var(--admin-faint)]">
                      {L.fleet.licenceUpdated} {day(car.licenceUpdatedAt)}
                      {car.licenceIsPdf && ` · ${L.fleet.licencePdf}`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--admin-faint)]">
                {L.fleet.licenceNone}
              </p>
            )}
          </div>
        </Panel>

        {/* The two inspection dates together, which is the whole reason the
            previous one is recorded: a next MFK eleven months out beside a
            last one three years back is a date somebody typed wrong. */}
        <Panel title={L.fleet.profileInspection}>
          <dl className="grid gap-3 p-4 sm:grid-cols-2">
            <Fact label={L.fleet.mfkFull}>
              {car.mfkDate ? (
                <MfkDate iso={car.mfkDate} L={L} />
              ) : (
                <Gap>{L.fleet.profileNothing}</Gap>
              )}
            </Fact>
            <Fact label={L.fleet.mfkLast}>
              {car.mfkLastDate ? (
                day(car.mfkLastDate)
              ) : (
                <Gap>{L.fleet.profileNothing}</Gap>
              )}
            </Fact>
          </dl>
        </Panel>

        <Panel title={L.fleet.service}>
          <dl className="grid gap-3 p-4 sm:grid-cols-2">
            <Fact label={L.fleet.mileage}>
              {typeof car.currentMileageKm === "number" ? (
                <>
                  {formatKm(car.currentMileageKm)} km
                  {car.mileageReadAt && (
                    <span className="mt-0.5 block text-xs text-[var(--admin-faint)]">
                      {L.fleet.mileageRead} {day(car.mileageReadAt)}
                    </span>
                  )}
                </>
              ) : (
                <Gap>{L.fleet.mileageNever}</Gap>
              )}
            </Fact>
            <Fact label={L.fleet.serviceDue}>
              <ServiceDue car={car} L={L} />
            </Fact>
            <Fact label={L.fleet.serviceDone}>
              {typeof car.serviceDoneKm === "number" ? (
                `${formatKm(car.serviceDoneKm)} km`
              ) : (
                <Gap>{L.fleet.profileNothing}</Gap>
              )}
            </Fact>
            <Fact label={L.fleet.serviceDoneOn}>
              {car.serviceDoneOn ? (
                day(car.serviceDoneOn)
              ) : (
                <Gap>{L.fleet.profileNothing}</Gap>
              )}
            </Fact>
          </dl>
        </Panel>

        {/* The current rental, and the way to the audited history. A car that
            is out is the fact somebody opening this page most often wants. */}
        <Panel title={L.fleet.profileRentals}>
          <div className="grid gap-3 p-4">
            {rental ? (
              <div className="grid gap-1 rounded-md border border-[var(--admin-rule)] bg-[var(--admin-sunk)] p-3">
                <p className="text-sm font-medium">{rental.customerName}</p>
                <p className="text-xs text-[var(--admin-muted)] tabular-nums">
                  {day(rental.startAt)} – {day(rental.endAt)}
                </p>
                {rental.contractNumber && (
                  <p className="font-mono text-xs text-[var(--admin-faint)]">
                    {rental.contractNumber}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--admin-faint)]">
                {L.fleet.profileRentalsNone}
              </p>
            )}

            <Link
              href={`/admin/history?car=${encodeURIComponent(car.id)}`}
              className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
            >
              {L.fleet.profileRentalsMore}
            </Link>
          </div>
        </Panel>
      </div>

      {/* The repair history at full width: it is a list that grows, unlike
          everything above it, which is a fixed set of values. */}
      <Panel
        title={L.fleet.repairs}
        meta={`${(car.repairs ?? []).length}`}
        action={
          <button
            type="button"
            onClick={() => setMaintaining(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
          >
            {L.fleet.repairAdd}
          </button>
        }
      >
        {(car.repairs ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-faint)]">
            {L.fleet.repairsNone}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--admin-rule)]">
            {(car.repairs ?? []).map((repair) => (
              <li
                key={repair.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">{repair.details}</p>
                  <p className="mt-0.5 text-xs text-[var(--admin-faint)]">
                    {repair.status === "done"
                      ? L.fleet.repairsDone
                      : L.fleet.repairsPlanned}
                    {repair.doneOn && ` · ${day(repair.doneOn)}`}
                    {!repair.doneOn &&
                      repair.plannedFor &&
                      ` · ${day(repair.plannedFor)}`}
                    {typeof repair.mileageKm === "number" &&
                      ` · ${formatKm(repair.mileageKm)} km`}
                    {` · ${L.fleet.repairBy} ${repair.createdBy}`}
                  </p>
                </div>
                {typeof repair.costCents === "number" && (
                  <span className="shrink-0 text-sm tabular-nums text-[var(--admin-muted)]">
                    {formatChf(repair.costCents)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function BackLink({ L }: { L: Labels }) {
  return (
    <Link
      href="/admin/vehicles"
      className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-sunk)] hover:text-[var(--admin-ink)]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {L.fleet.profileBack}
    </Link>
  );
}

/** One labelled value. A `<dl>` row, so the label and the figure are
 *  associated for a screen reader rather than only positioned near each
 *  other. */
function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--admin-faint)]">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono tabular-nums" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

/** A value nobody has recorded. Rendered as a gap on purpose — a dash in the
 *  muted colour, never a zero or a guess. */
function Gap({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--admin-faint)]">{children}</span>;
}

/** The next inspection, coloured by how close it is — the same three states
 *  the fleet table shows, so the two screens cannot disagree about whether a
 *  car is due. */
function MfkDate({ iso, L }: { iso: string; L: Labels }) {
  const standing = mfkStanding(iso, new Date());
  return (
    <>
      <span
        className={
          standing === "expired"
            ? "font-medium text-[var(--admin-crit)]"
            : standing === "due"
              ? "font-medium text-[var(--admin-attn)]"
              : undefined
        }
      >
        {day(iso)}
      </span>
      {standing !== "ok" && (
        <span
          className={`mt-0.5 block text-xs ${
            standing === "expired"
              ? "text-[var(--admin-crit)]"
              : "text-[var(--admin-attn)]"
          }`}
        >
          {standing === "expired" ? L.fleet.mfkExpired : L.fleet.mfkDue}
        </span>
      )}
    </>
  );
}

/** The next service, as a distance — a garage schedules on kilometres, and so
 *  does the warning. */
function ServiceDue({ car, L }: { car: Car; L: Labels }) {
  if (typeof car.serviceDueKm !== "number") {
    return <Gap>{L.fleet.profileNothing}</Gap>;
  }

  const standing = serviceStanding(car);
  const remaining = kmUntilService(car);

  return (
    <>
      <span
        className={
          standing === "overdue"
            ? "font-medium text-[var(--admin-crit)]"
            : standing === "due"
              ? "font-medium text-[var(--admin-attn)]"
              : undefined
        }
      >
        {formatKm(car.serviceDueKm)} km
      </span>
      {standing !== "none" && standing !== "ok" && remaining !== null && (
        <span
          className={`mt-0.5 block text-xs ${
            standing === "overdue"
              ? "text-[var(--admin-crit)]"
              : "text-[var(--admin-attn)]"
          }`}
        >
          {standing === "overdue"
            ? L.fleet.serviceOverdue
            : `${L.fleet.serviceIn} ${formatKm(remaining)} km`}
        </span>
      )}
    </>
  );
}
