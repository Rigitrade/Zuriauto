/**
 * The GTC's handling fee for a traffic fine.
 *
 * GTC §4.2 makes the renter liable for "Verkehrsverstösse/Bussen", and its
 * fee table charges CHF 20 per traffic fine and CHF 20 per Mahnung. The table
 * arrived with the GTC dated 30.07.2026 (commit 4670c34); a pickup records
 * the date of the GTC it accepted as `gtcVersion` — "30.07.2026", or the ISO
 * form in older test data. A renter who signed an earlier GTC, or none we can
 * read, never agreed to the fee and is not charged it.
 */

export const DEFAULT_FEE_CENTS = 2000;
const FEE_GTC_FROM = "2026-07-30";

function gtcDate(version: string | null): string | null {
  if (!version) return null;
  const swiss = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(version.trim());
  if (swiss) return `${swiss[3]}-${swiss[2]}-${swiss[1]}`;
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(version.trim());
  return iso ? iso[1] : null;
}

export function handlingFeeCents(
  gtcVersion: string | null,
  env: Record<string, string | undefined> = process.env
): number {
  const accepted = gtcDate(gtcVersion);
  if (!accepted || accepted < FEE_GTC_FROM) return 0;

  const configured = env.FINES_HANDLING_FEE_CENTS;
  if (configured === undefined || configured.trim() === "") return DEFAULT_FEE_CENTS;
  const cents = Number(configured);
  return Number.isInteger(cents) && cents >= 0 ? cents : DEFAULT_FEE_CENTS;
}
