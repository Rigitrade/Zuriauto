import { describe, expect, it } from "vitest";
import { labelsFor } from "@/lib/admin/labels";
import { attentionDetail, attentionHref, attentionTitle } from "./attentionText";

describe("the fines attention item", () => {
  const item = { kind: "fine" as const, key: "fine:waiting", customerName: "", count: 3 };
  const L = labelsFor("de");

  it("links to the fines waiting for review", () => {
    expect(attentionHref(item)).toBe("/admin/fines/?tab=review");
  });

  it("says how many fines are waiting", () => {
    expect(attentionTitle(item, L)).toBe(L.overview.finesWaiting);
    expect(attentionDetail(item, L, new Date())).toBe("3 Bussen");
  });
});

describe("the money-owed attention item", () => {
  const L = labelsFor("de");
  const item = (count: number) => ({ kind: "balance" as const, key: "balance:owed", customerName: "", count });

  it("links to the money owed on the payments screen", () => {
    expect(attentionHref(item(3))).toBe("/admin/payments/?tab=owed");
  });

  it("says how many rentals owe money", () => {
    expect(attentionTitle(item(3), L)).toBe(L.overview.balancesWaiting);
    expect(attentionDetail(item(3), L, new Date())).toBe("3 Mieten");
    expect(attentionDetail(item(1), L, new Date())).toBe("1 Miete");
  });
});
