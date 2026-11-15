"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/shell/AdminContext";
import { Panel } from "@/components/admin/parts/Panel";

/**
 * The company's own details (multi-company phase B, 15.11.2026): what its
 * contracts, return reports, renter mails and police letters carry.
 *
 * Owner-only. Staff never see the rail item, a staff member who types the URL
 * is sent to Overview, and the API answers 403 to them however it is called.
 */

type Field =
  | "brandName"
  | "legalName"
  | "uid"
  | "street"
  | "postalCode"
  | "city"
  | "signingPlace"
  | "phone"
  | "officeEmail"
  | "website"
  | "signerName"
  | "paymentUrl"
  | "twintUrl";

type Settings = Record<Field, string>;

const GROUPS: { key: "identity" | "address" | "contact" | "payment"; fields: Field[] }[] = [
  { key: "identity", fields: ["brandName", "legalName", "uid"] },
  { key: "address", fields: ["street", "postalCode", "city", "signingPlace"] },
  { key: "contact", fields: ["phone", "officeEmail", "website", "signerName"] },
  { key: "payment", fields: ["paymentUrl", "twintUrl"] },
];

const ALL_FIELDS = GROUPS.flatMap((group) => group.fields);

const EMPTY = Object.fromEntries(ALL_FIELDS.map((field) => [field, ""])) as Settings;

const INPUT =
  "h-10 w-full rounded-md border border-[var(--admin-rule-strong)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus-visible:border-[var(--admin-accent)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/20";

export function CompanySection() {
  const { L, me, setMessage } = useAdmin();
  const router = useRouter();
  const C = L.company;

  const [loaded, setLoaded] = useState<{ name: string; slug: string | null; isSite: boolean } | null>(null);
  const [draft, setDraft] = useState<Settings>(EMPTY);
  const [saving, setSaving] = useState(false);

  const isOwner = me.role === "owner";
  useEffect(() => {
    if (!isOwner) router.replace("/admin");
  }, [isOwner, router]);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetch("/api/admin/company/")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setLoaded({ name: body.name, slug: body.slug, isSite: body.isSite === true });
        setDraft(
          Object.fromEntries(ALL_FIELDS.map((field) => [field, body.settings[field] ?? ""])) as Settings
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  if (!isOwner) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/company/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body) {
        setDraft(
          Object.fromEntries(ALL_FIELDS.map((field) => [field, body.settings[field] ?? ""])) as Settings
        );
        setMessage(C.saved);
      } else {
        const fields = ((body?.fields as string[] | undefined) ?? [])
          .map((field) => C.fields[field as Field] ?? field)
          .join(", ");
        setMessage(C.invalid.replace("{fields}", fields || "—"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4">
      <p className="text-sm text-[var(--admin-muted)]">{C.intro}</p>
      {loaded && (
        <p className="text-xs text-[var(--admin-faint)]">
          {loaded.name}
          {loaded.slug ? ` · ${C.shortName}: ${loaded.slug}` : ""}
        </p>
      )}

      {GROUPS.map((group) => (
        <Panel key={group.key} title={C.sections[group.key]}>
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <label key={field} className="grid gap-1">
                <span className="text-xs text-[var(--admin-muted)]">{C.fields[field]}</span>
                <input
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  autoCapitalize={field === "officeEmail" || field === "website" ? "none" : undefined}
                  spellCheck={field === "officeEmail" || field === "website" ? false : undefined}
                  inputMode={field === "officeEmail" ? "email" : field.endsWith("Url") ? "url" : undefined}
                  className={INPUT}
                />
                {field === "officeEmail" && (
                  <span className="text-xs text-[var(--admin-faint)]">
                    {loaded?.isSite ? C.officeEmailHint : C.officeEmailRequired}
                  </span>
                )}
              </label>
            ))}
          </div>
          {group.key === "payment" && (
            <p className="px-4 pb-4 text-xs text-[var(--admin-faint)]">
              {loaded?.isSite ? C.sitePaymentHint : C.paymentHint}
            </p>
          )}
        </Panel>
      ))}

      <div>
        <button
          type="submit"
          disabled={saving || !loaded}
          className="h-10 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-medium text-[var(--admin-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {C.save}
        </button>
      </div>
    </form>
  );
}
