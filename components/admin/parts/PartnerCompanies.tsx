"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PasswordInput } from "@/components/admin/parts/PasswordInput";
import { Panel } from "@/components/admin/parts/Panel";
import { day } from "@/components/admin/format";
import { messageForCode, type AdminLabels } from "@/lib/admin/labels";
import { suggestSlug } from "@/lib/company/slug";
import { USERNAME_PATTERN } from "@/lib/admin/users";

/**
 * Partner companies in Konten, for ZURIAUTO's owner only (15.11.2026). The
 * server refuses everyone else (`/api/admin/partners` answers 403); this only
 * keeps the controls off their screen.
 */

export interface PartnerRow {
  id: string;
  name: string;
  slug: string | null;
  legalName: string | null;
  officeEmail: string | null;
  createdAt: string;
  owners: { username: string; displayName: string }[];
  cars: number;
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

export function PartnersPanel(props: { L: AdminLabels; partners: PartnerRow[]; onAdd: () => void }) {
  const P = props.L.partners;
  return (
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
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[44rem] text-sm">
            <thead className="bg-[var(--admin-sunk)] text-xs uppercase tracking-wider text-[var(--admin-faint)]">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{P.colName}</th>
                <th className="px-4 py-2.5 text-left font-medium">{P.colSlug}</th>
                <th className="px-4 py-2.5 text-left font-medium">{P.colOwner}</th>
                <th className="px-4 py-2.5 text-left font-medium">{P.colOffice}</th>
                <th className="px-4 py-2.5 text-right font-medium">{P.colCars}</th>
                <th className="px-4 py-2.5 text-left font-medium">{P.colCreated}</th>
              </tr>
            </thead>
            <tbody>
              {props.partners.map((partner) => (
                <tr key={partner.id} className="border-t border-[var(--admin-rule)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{partner.name}</div>
                    {partner.legalName && <div className="text-xs text-[var(--admin-faint)]">{partner.legalName}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--admin-muted)]">
                    {partner.slug ? (
                      // Its renters' links (phase C), to check or pass on.
                      (["pickup", "return"] as const).map((form) => (
                        <div key={form}>
                          <a href={`/${partner.slug}/${form}/`} target="_blank" rel="noreferrer" className="hover:underline">
                            /{partner.slug}/{form}/
                          </a>
                        </div>
                      ))
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">
                    {partner.owners.map((owner) => (
                      <div key={owner.username}>
                        {owner.displayName} <span className="font-mono text-xs">({owner.username})</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{partner.officeEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{partner.cars}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--admin-faint)]">{day(partner.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
