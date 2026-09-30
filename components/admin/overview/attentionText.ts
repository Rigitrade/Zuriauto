import type { AttentionItem } from "@/lib/admin/attention";
import type { Labels } from "@/components/admin/types";
import { day } from "@/components/admin/format";

/**
 * How one attention item is worded, shared by the Overview band and the bell.
 *
 * One wording in two places, so the bell never names a job differently from
 * the band it points to.
 */

export function attentionTitle(item: AttentionItem, L: Labels): string {
  if (item.kind === "return") return L.overview.confirmReturn;
  if (item.kind === "ending") return L.overview.endsToday;
  return L.overview.mailNotDelivered;
}

export function attentionDetail(item: AttentionItem, L: Labels, now: Date): string {
  if (item.kind === "mail") {
    return [item.contractNumber, item.at ? day(item.at) : null]
      .filter(Boolean)
      .join(" · ");
  }

  const parts = [item.carModel, item.carPlate].filter(Boolean);
  if (item.at) {
    const overdue =
      item.kind === "ending" && Date.parse(item.at) < now.getTime();
    parts.push(
      `${item.kind === "return" ? L.overview.returnsOn : ""} ${day(item.at)}${
        overdue ? ` · ${L.overview.overdue}` : ""
      }`.trim()
    );
  }
  return parts.join(" · ");
}

/** Where the item's action lives. A failed mail is resent from the band on
 *  the Overview; the other two are handled on the rentals list. */
export function attentionHref(item: AttentionItem): string {
  return item.kind === "mail" ? "/admin" : "/admin/rentals";
}
