import type { Labels } from "@/components/admin/types";
import { formatChf } from "@/lib/rental/money";
import type { PaymentChoice } from "@/lib/payments/queries";

/** One thing a waiting payment can be booked to on a rental. */
export interface BookOption {
  key: string;
  label: string;
  chargeId: string | null;
  depositCents: number;
  /** What it costs; null for a credit, which takes any amount. */
  expectedCents: number | null;
}

/** Each open week, the deposit while it is outstanding, deposit + the first
 *  open week, or a credit. */
export function bookOptions(choice: PaymentChoice | undefined, P: Labels["payments"]): BookOption[] {
  if (!choice) return [];
  const outstanding = Math.max(0, choice.depositCents - choice.depositReceivedCents);
  const weeks: BookOption[] = choice.openCharges.map((c) => ({
    key: `week:${c.id}`,
    label: `${c.weekNumber === 0 ? P.purposeReturnBalance : P.purposeWeek.replace("{n}", String(c.weekNumber))} · CHF ${formatChf(c.amountCents)}`,
    chargeId: c.id,
    depositCents: 0,
    expectedCents: c.amountCents,
  }));
  const deposit: BookOption[] = [];
  if (outstanding > 0) {
    deposit.push({
      key: "deposit",
      label: `${P.purposeDeposit} · CHF ${formatChf(outstanding)}`,
      chargeId: null,
      depositCents: outstanding,
      expectedCents: outstanding,
    });
    const first = choice.openCharges.find((c) => c.weekNumber >= 1);
    if (first) {
      deposit.push({
        key: `depositWeek:${first.id}`,
        label: `${P.purposeDepositWeek.replace("{n}", String(first.weekNumber))} · CHF ${formatChf(outstanding + first.amountCents)}`,
        chargeId: first.id,
        depositCents: outstanding,
        expectedCents: outstanding + first.amountCents,
      });
    }
  }
  return [...weeks, ...deposit, { key: "credit", label: P.asCredit, chargeId: null, depositCents: 0, expectedCents: null }];
}

/**
 * The option the amount fits exactly, a credit when none does — and nothing
 * when more than one does. CHF 250 against a CHF 250 deposit and a CHF 250
 * week is the guess the matcher refuses to make (PICKUP_PAYMENT); the form
 * must not make it either, so the office chooses.
 */
export function fitting(options: BookOption[], amountCents: number): string {
  const fits = options.filter((o) => o.expectedCents === amountCents);
  if (fits.length > 1) return "";
  return fits[0]?.key ?? "credit";
}
