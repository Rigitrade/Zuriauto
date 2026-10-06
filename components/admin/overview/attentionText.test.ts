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
