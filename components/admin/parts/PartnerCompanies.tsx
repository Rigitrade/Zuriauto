"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Power } from "lucide-react";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/admin/parts/RowMenu";
import { PasswordInput } from "@/components/admin/parts/PasswordInput";
import { Panel } from "@/components/admin/parts/Panel";
import { day } from "@/components/admin/format";
import { messageForCode, type AdminLabels } from "@/lib/admin/labels";
import { suggestSlug } from "@/lib/company/slug";
import { USERNAME_PATTERN } from "@/lib/admin/users";
import { FormError } from "@/components/admin/parts/FormError";
import { Dialog } from "@/components/admin/parts/Dialog";

/**
 * Partner companies in Konten, for ZURIAUTO's owner only (15.11.2026). The
 * server refuses everyone else (`/api/admin/partners` answers 403); this only
 * keeps the controls off their screen.
 */

export interface PartnerRow {
  id: string;
  name: string;
  /** What its renters see; its owner can change it under Firma. */
  brandName: string | null;
  slug: string | null;
  legalName: string | null;
  officeEmail: string | null;
  createdAt: string;
  owners: { username: string; displayName: string }[];
  cars: number;
  /** Running rentals, for the warning before switching it off (phase D). */
  activeRentals: number;
  /** Switched off by ZURIAUTO (phase D). */
  disabled: boolean;
}

const INPUT =
  "h-10 rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20";

const EMPTY = {
  brandName: "",
  legalName: "",
  slug: "",
  officeEmail: "",
  owner: { displayName: "", username: "", password: "" },
};

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-[var(--admin-muted)]">{props.label}</span>
      {props.children}
      {props.hint && <span className="text-xs text-[var(--admin-faint)]">{props.hint}</span>}
    </label>
  );
}

/** The minimum a partner needs; its owner fills in the rest under Firma. */
export function PartnerForm(props: {
  L: AdminLabels;
  onCreated: (message: string) => void;
  /** Shown inside the form, by the button; the page banner is hidden
   *  behind the open dialog. */
  error: string;
  onError: (message: string) => void;
}) {
  const { L } = props;
  const P = L.partners;
  const [draft, setDraft] = useState(EMPTY);
  // The short name follows the brand name until somebody edits it by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const fieldLabels: Record<string, string> = {
    brandName: P.brandName,
    legalName: P.legalName,
    slug: P.slug,
    officeEmail: P.officeEmail,
    "owner.displayName": L.accounts.displayName,
    "owner.username": L.accounts.username,
    "owner.password": L.accounts.newPassword,
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    props.onError("");
    if (draft.owner.password.length < 10) return props.onError(L.accounts.passwordTooShort);
    if (!USERNAME_PATTERN.test(draft.owner.username.trim().toLowerCase())) {
      return props.onError(L.accounts.usernameInvalid);
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/partners/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "invalid" && Array.isArray(result.fields)) {
          const names = result.fields.map((field: string) => fieldLabels[field] ?? field).join(", ");
          return props.onError(P.checkFields.replace("{fields}", names));
        }
        return props.onError(messageForCode(L, result.code));
      }
      setDraft(EMPTY);
      setSlugTouched(false);
      props.onCreated(
        P.created.replace("{name}", result.partner.name).replace("{username}", result.owner.username)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-faint)]">{P.sectionCompany}</p>
      <Field label={P.brandName}>
        <input
          required
          value={draft.brandName}
          onChange={(e) =>
            setDraft({
              ...draft,
              brandName: e.target.value,
              slug: slugTouched ? draft.slug : suggestSlug(e.target.value),
            })
          }
          className={INPUT}
        />
      </Field>
      <Field label={P.legalName}>
        <input required value={draft.legalName} onChange={(e) => setDraft({ ...draft, legalName: e.target.value })} className={INPUT} />
      </Field>
      <Field label={P.slug} hint={P.slugHint}>
        <input
          required
          value={draft.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setDraft({ ...draft, slug: e.target.value });
          }}
          autoCapitalize="none"
          spellCheck={false}
          className={`${INPUT} font-mono`}
        />
      </Field>
      <Field label={P.officeEmail} hint={P.officeEmailHint}>
        <input
          required
          type="email"
          value={draft.officeEmail}
          onChange={(e) => setDraft({ ...draft, officeEmail: e.target.value })}
          className={INPUT}
        />
      </Field>

      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-faint)]">{P.sectionOwner}</p>
      <Field label={L.accounts.displayName}>
        <input
          required
          value={draft.owner.displayName}
          onChange={(e) => setDraft({ ...draft, owner: { ...draft.owner, displayName: e.target.value } })}
          className={INPUT}
        />
      </Field>
      <Field label={L.accounts.username} hint={L.accounts.usernameInvalid}>
        <input
          required
          value={draft.owner.username}
          onChange={(e) => setDraft({ ...draft, owner: { ...draft.owner, username: e.target.value } })}
          autoCapitalize="none"
          spellCheck={false}
          className={INPUT}
        />
      </Field>
      <Field label={L.accounts.newPassword}>
        <PasswordInput
          value={draft.owner.password}
          onChange={(password) => setDraft({ ...draft, owner: { ...draft.owner, password } })}
          L={L}
          placeholder={L.accounts.passwordTooShort}
        />
      </Field>

      <p className="rounded-md bg-[var(--admin-sunk)] px-3 py-2 text-xs text-[var(--admin-muted)]">{P.restHint}</p>
      <FormError message={props.error} />
      <button
        type="submit"
        disabled={busy}
        className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {P.create}
      </button>
    </form>
  );
}

/** The partners already created. Loads its own list. */
export function usePartners(enabled: boolean) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    const response = await fetch("/api/admin/partners/");
    if (response.ok) setPartners((await response.json()).partners);
  }, [enabled]);
  useEffect(() => {
    void load();
  }, [load]);
  return { partners, reload: load };
}

const ROW_BUTTON =
  "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-[var(--admin-rule-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--admin-sunk)] disabled:opacity-50";

async function patchPartner(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/partners/${id}/`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, result };
}

/** Name with its standing beside it, legal name under it. */
function PartnerName({ partner, P }: { partner: PartnerRow; P: AdminLabels["partners"] }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium break-words">{partner.brandName ?? partner.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
            partner.disabled
              ? "bg-[var(--admin-crit-soft)] text-[var(--admin-crit)]"
              : "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
          }`}
        >
          {partner.disabled ? P.statusOff : P.statusOn}
        </span>
      </div>
      {partner.legalName && <div className="text-xs break-words text-[var(--admin-faint)]">{partner.legalName}</div>}
    </>
  );
}

/** Its renters' links (phase C), to check or pass on. */
function PartnerLinks({ partner, P }: { partner: PartnerRow; P: AdminLabels["partners"] }) {
  if (!partner.slug) return <>—</>;
  return (
    <>
      <div className="truncate font-mono text-xs text-[var(--admin-muted)]" title={`/${partner.slug}/`}>
        /{partner.slug}/
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
        {(["pickup", "return"] as const).map((form) => (
          <a
            key={form}
            href={`/${partner.slug}/${form}/`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-[var(--admin-accent)] hover:underline"
          >
            {form === "pickup" ? P.linkPickup : P.linkReturn} ↗
          </a>
        ))}
      </div>
    </>
  );
}

/** Name, then the sign-in name under it. */
function PartnerOwners({ partner }: { partner: PartnerRow }) {
  if (partner.owners.length === 0) return <>—</>;
  return (
    <>
      {partner.owners.map((owner) => (
        <div key={owner.username}>
          <div>{owner.displayName}</div>
          <div className="truncate font-mono text-xs text-[var(--admin-faint)]">{owner.username}</div>
        </div>
      ))}
    </>
  );
}

/**
 * The partners already created, with what ZURIAUTO's owner can do to each
 * (phase D, 16.11.2026): look inside read-only, correct its details, switch it
 * off and on. The server checks every one of these; this only offers them.
 */
export function PartnersPanel(props: {
  L: AdminLabels;
  partners: PartnerRow[];
  onAdd: () => void;
  onChanged: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const { L } = props;
  const P = L.partners;
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [switchingOff, setSwitchingOff] = useState<PartnerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  /** The open row menu: partner id and layout, as both layouts are in the page. */
  const [menuFor, setMenuFor] = useState<string | null>(null);

  async function view(partner: PartnerRow) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/view/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organisationId: partner.id }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        props.onMessage(messageForCode(L, result.code));
        return;
      }
      // A full load, so every screen starts from the partner's records.
      window.location.assign("/admin/");
    } finally {
      setBusy(false);
    }
  }

  async function setDisabled(partner: PartnerRow, disabled: boolean) {
    setBusy(true);
    setDialogError("");
    try {
      const { ok, result } = await patchPartner(partner.id, { disabled });
      if (!ok) {
        if (disabled) setDialogError(messageForCode(L, result.code));
        else props.onMessage(messageForCode(L, result.code));
        return;
      }
      setSwitchingOff(null);
      await props.onChanged();
      props.onMessage((disabled ? P.switchedOff : P.switchedOn).replace("{name}", partner.name));
    } finally {
      setBusy(false);
    }
  }

  /** View, edit and switch off/on, behind one button, as on the fleet table. */
  function actions(partner: PartnerRow, layout: "table" | "card") {
    const key = `${partner.id}:${layout}`;
    const name = partner.brandName ?? partner.name;
    return (
      <RowMenu
        label={`${L.fleet.actions} · ${name}`}
        disabled={busy}
        open={menuFor === key}
        onOpenChange={(next) => setMenuFor(next ? key : null)}
      >
        <RowMenuItem icon={<Eye className="h-4 w-4" aria-hidden="true" />} onSelect={() => void view(partner)}>
          {P.view}
        </RowMenuItem>
        <RowMenuItem icon={<Pencil className="h-4 w-4" aria-hidden="true" />} onSelect={() => setEditing(partner)}>
          {P.edit}
        </RowMenuItem>
        <RowMenuSeparator />
        {partner.disabled ? (
          <RowMenuItem
            icon={<Power className="h-4 w-4" aria-hidden="true" />}
            onSelect={() => void setDisabled(partner, false)}
          >
            {P.switchOn}
          </RowMenuItem>
        ) : (
          <RowMenuItem
            danger
            icon={<Power className="h-4 w-4" aria-hidden="true" />}
            onSelect={() => {
              setDialogError("");
              setSwitchingOff(partner);
            }}
          >
            {P.switchOff}
          </RowMenuItem>
        )}
      </RowMenu>
    );
  }

  return (
    <>
      <Panel
        title={P.heading}
        meta={String(props.partners.length)}
        action={
          <button
            type="button"
            onClick={props.onAdd}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--admin-rule-strong)] px-3 text-sm font-medium transition-colors hover:bg-[var(--admin-sunk)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {P.addPartner}
          </button>
        }
      >
        <p className="px-4 pt-3 text-sm text-[var(--admin-muted)]">{P.intro}</p>
        {props.partners.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-faint)]">{P.none}</p>
        ) : (
          <>
            {/* Wide screens (from 1280px): a table that always fits the panel. Fixed column
                widths, long values wrapped or cut with "…" (whole on hover),
                and the three actions behind one button, so nothing ever
                scrolls sideways. */}
            <table className="mt-2 hidden w-full table-fixed text-sm xl:table">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-12" />
              </colgroup>
              <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
                <tr>
                  <th className="truncate px-3 py-2.5 text-left font-medium first:pl-4">{P.colName}</th>
                  <th className="truncate px-3 py-2.5 text-left font-medium">{P.colSlug}</th>
                  <th className="truncate px-3 py-2.5 text-left font-medium">{P.colOwner}</th>
                  <th className="truncate px-3 py-2.5 text-left font-medium">{P.colOffice}</th>
                  <th className="truncate px-3 py-2.5 text-right font-medium" title={P.colCars}>{P.colCars}</th>
                  <th className="truncate px-3 py-2.5 text-left font-medium">{P.colCreated}</th>
                  <th className="py-2.5 pr-2" />
                </tr>
              </thead>
              <tbody>
                {props.partners.map((partner) => (
                  <tr key={partner.id} className="border-t border-[var(--admin-rule)] align-top">
                    <td className="py-3 pr-3 pl-4">
                      <PartnerName partner={partner} P={P} />
                    </td>
                    <td className="px-3 py-3">
                      <PartnerLinks partner={partner} P={P} />
                    </td>
                    <td className="px-3 py-3 break-words text-[var(--admin-muted)]">
                      <PartnerOwners partner={partner} />
                    </td>
                    <td className="px-3 py-3 text-[var(--admin-muted)]">
                      <div className="truncate" title={partner.officeEmail ?? undefined}>
                        {partner.officeEmail ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{partner.cars}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums text-[var(--admin-faint)]">
                      {day(partner.createdAt)}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex justify-end">{actions(partner, "table")}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Narrower screens: one card per partner, the same facts stacked,
                two per line where there is room. */}
            <ul className="mt-2 divide-y divide-[var(--admin-rule)] border-t border-[var(--admin-rule)] xl:hidden">
              {props.partners.map((partner) => (
                <li key={partner.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <PartnerName partner={partner} P={P} />
                    </div>
                    {actions(partner, "card")}
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <dt className="text-[var(--admin-faint)]">{P.colSlug}</dt>
                    <dd className="min-w-0">
                      <PartnerLinks partner={partner} P={P} />
                    </dd>
                    <dt className="text-[var(--admin-faint)]">{P.colOwner}</dt>
                    <dd className="min-w-0 break-words text-[var(--admin-muted)]">
                      <PartnerOwners partner={partner} />
                    </dd>
                    <dt className="text-[var(--admin-faint)]">{P.colOffice}</dt>
                    <dd className="min-w-0 truncate text-[var(--admin-muted)]" title={partner.officeEmail ?? undefined}>
                      {partner.officeEmail ?? "—"}
                    </dd>
                    <dt className="text-[var(--admin-faint)]">{P.colCars}</dt>
                    <dd className="tabular-nums">{partner.cars}</dd>
                    <dt className="text-[var(--admin-faint)]">{P.colCreated}</dt>
                    <dd className="tabular-nums text-[var(--admin-muted)]">{day(partner.createdAt)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={P.editHeading} closeLabel={L.accounts.close}>
        {editing && (
          <PartnerEditForm
            key={editing.id}
            L={L}
            partner={editing}
            onSaved={async (name) => {
              setEditing(null);
              await props.onChanged();
              props.onMessage(P.saved.replace("{name}", name));
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={switchingOff !== null}
        onClose={() => setSwitchingOff(null)}
        title={P.offHeading}
        closeLabel={L.accounts.close}
      >
        {switchingOff && (
          <div className="grid gap-3 text-sm">
            <p>{P.offText.replace("{name}", switchingOff.name)}</p>
            {switchingOff.activeRentals > 0 && (
              <p role="alert" className="rounded-md bg-[var(--admin-attn-soft)] px-3 py-2 text-[var(--admin-attn)]">
                {P.offRunning.replace("{count}", String(switchingOff.activeRentals))}
              </p>
            )}
            <FormError message={dialogError} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSwitchingOff(null)} className={ROW_BUTTON}>
                {P.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void setDisabled(switchingOff, true)}
                className="inline-flex h-8 items-center rounded-md bg-[var(--admin-crit)] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {P.offConfirm}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** Corrects what was given when the partner was created; sends only what changed. */
function PartnerEditForm(props: { L: AdminLabels; partner: PartnerRow; onSaved: (name: string) => Promise<void> }) {
  const { L, partner } = props;
  const P = L.partners;
  const original = {
    brandName: partner.brandName ?? partner.name,
    legalName: partner.legalName ?? "",
    slug: partner.slug ?? "",
    officeEmail: partner.officeEmail ?? "",
  };
  const [draft, setDraft] = useState(original);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const slugChanged = draft.slug.trim().toLowerCase() !== original.slug;

  const fieldLabels: Record<string, string> = {
    brandName: P.brandName,
    legalName: P.legalName,
    slug: P.slug,
    officeEmail: P.officeEmail,
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const changed = Object.fromEntries(
      (Object.keys(draft) as (keyof typeof draft)[])
        .filter((key) => draft[key].trim() !== original[key])
        .map((key) => [key, draft[key]])
    );
    if (Object.keys(changed).length === 0) {
      await props.onSaved(partner.name);
      return;
    }
    setBusy(true);
    try {
      const { ok, result } = await patchPartner(partner.id, changed);
      if (!ok) {
        if (result.code === "invalid" && Array.isArray(result.fields)) {
          const names = result.fields.map((field: string) => fieldLabels[field] ?? field).join(", ");
          setError(P.checkFields.replace("{fields}", names));
        } else {
          setError(messageForCode(L, result.code));
        }
        return;
      }
      await props.onSaved(result.partner?.name ?? partner.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label={P.brandName}>
        <input required value={draft.brandName} onChange={(e) => setDraft({ ...draft, brandName: e.target.value })} className={INPUT} />
      </Field>
      <Field label={P.legalName}>
        <input required value={draft.legalName} onChange={(e) => setDraft({ ...draft, legalName: e.target.value })} className={INPUT} />
      </Field>
      <Field label={P.slug} hint={P.slugHint}>
        <input
          required
          value={draft.slug}
          onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          autoCapitalize="none"
          spellCheck={false}
          className={`${INPUT} font-mono`}
        />
      </Field>
      {slugChanged && (
        <p className="rounded-md bg-[var(--admin-attn-soft)] px-3 py-2 text-xs text-[var(--admin-attn)]">{P.slugChangeWarning}</p>
      )}
      <Field label={P.officeEmail} hint={P.officeEmailHint}>
        <input
          required
          type="email"
          value={draft.officeEmail}
          onChange={(e) => setDraft({ ...draft, officeEmail: e.target.value })}
          className={INPUT}
        />
      </Field>
      <FormError message={error} />
      <button
        type="submit"
        disabled={busy}
        className="mt-1 h-10 rounded-md bg-[var(--admin-accent)] px-3 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {P.save}
      </button>
    </form>
  );
}
