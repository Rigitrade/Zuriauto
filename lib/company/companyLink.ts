/**
 * A partner's public links (multi-company phase C, 16.11.2026). No server
 * imports, so the forms in the browser use it too.
 *
 * The pages live at `/<slug>/pickup/` and `/<slug>/return/`, and every call
 * they make names the company as `?company=<slug>`. ZURIAUTO's own pages,
 * `/pickup/` and `/return/`, name none.
 */

export const COMPANY_PARAM = "company";

/** `path` with the company's name added; unchanged for ZURIAUTO's pages. */
export function withCompanyParam(path: string, slug: string | null | undefined): string {
  if (!slug) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${COMPANY_PARAM}=${encodeURIComponent(slug)}`;
}

/** A company's form link, e.g. `https://zuriauto.ch/meier/pickup/`. */
export function companyFormUrl(baseUrl: string, slug: string, form: "pickup" | "return"): string {
  return `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(slug)}/${form}/`;
}
