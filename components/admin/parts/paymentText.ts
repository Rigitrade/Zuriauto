import type { Labels } from "@/components/admin/types";
import type { PaymentRow } from "@/lib/payments/queries";

/** "Woche 3", "Kaution + Woche 1", "Restbetrag nach Rückgabe" — what a booked payment paid. */
export function purposeText(row: Pick<PaymentRow, "purpose" | "weekNumber">, P: Labels["payments"]): string | null {
  const week = String(row.weekNumber ?? "");
  switch (row.purpose) {
    case "week":
      return P.purposeWeek.replace("{n}", week);
    case "deposit+week":
      return P.purposeDepositWeek.replace("{n}", week);
    case "deposit":
      return P.purposeDeposit;
    case "return-balance":
      return P.purposeReturnBalance;
    case "credit":
      return P.purposeCredit;
    default:
      return null;
  }
}
