/**
 * A company's short name in its links (`zuriauto.ch/<slug>/pickup`), pure so
 * the console can suggest one as the name is typed (multi-company, 15.11.2026).
 */

/** Top-level paths the site already uses, so no company can take them. */
const RESERVED = new Set([
  "admin", "api", "book", "pickup", "return", "privacy", "gtc", "availability",
  "fines", "rental", "partner", "_next", "public", "static",
  "favicon.ico", "robots.txt", "sitemap.xml", "icon.jpg",
]);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

/** True for a slug a new company may take. */
export function isValidCompanySlug(slug: string): boolean {
  return SLUG.test(slug) && !RESERVED.has(slug.toLowerCase());
}

/** "Zürich Auto AG" → "zuerich-auto-ag": a starting point the owner can edit. */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}
