import { describe, expect, it } from "vitest";
import { copySource, r2Endpoint } from "./r2";

/**
 * The endpoint is the one piece of R2 configuration that fails silently.
 *
 * A jurisdiction-restricted bucket is invisible on the account's ordinary
 * host: the request returns NoSuchBucket, `persistPickup` throws, the route
 * answers 503, and the customer is handed their PDF as though the only
 * problem were email. The contract is signed and nowhere. So the host is
 * built by a pure function and pinned here.
 */
describe("r2Endpoint", () => {
  const account = "abc123";

  it("defaults to the EU jurisdiction host", () => {
    // The default matters: this project may only use an EU bucket, so a
    // missing R2_JURISDICTION must not quietly fall back to the plain host.
    expect(r2Endpoint(account, undefined)).toBe(
      "https://abc123.eu.r2.cloudflarestorage.com"
    );
  });

  it("uses the plain host only when a jurisdiction is explicitly declined", () => {
    expect(r2Endpoint(account, "none")).toBe(
      "https://abc123.r2.cloudflarestorage.com"
    );
  });

  it("treats an empty value as declining, not as a jurisdiction", () => {
    // An env var set to "" reads as "" rather than undefined, and an empty
    // label would otherwise build `abc123..r2.cloudflarestorage.com`.
    expect(r2Endpoint(account, "")).toBe(
      "https://abc123.r2.cloudflarestorage.com"
    );
    expect(r2Endpoint(account, "   ")).toBe(
      "https://abc123.r2.cloudflarestorage.com"
    );
  });

  it("honours another jurisdiction", () => {
    expect(r2Endpoint(account, "fedramp")).toBe(
      "https://abc123.fedramp.r2.cloudflarestorage.com"
    );
  });

  it("normalises case and surrounding space", () => {
    // Pasted from documentation or a dashboard, a value can arrive as " EU ".
    expect(r2Endpoint(account, " EU ")).toBe(
      "https://abc123.eu.r2.cloudflarestorage.com"
    );
  });
});

/**
 * CopySource is the other value in this module that fails silently: encode it
 * wrongly and the request addresses an object that does not exist, which
 * surfaces as the same NoSuchBucket-shaped 503 as a wrong endpoint.
 */
describe("copySource", () => {
  it("joins the bucket and key the way CopyObject expects", () => {
    expect(copySource("zuriauto-assets", "pickup/abc/ID_FRONT-1234.jpg")).toBe(
      "zuriauto-assets/pickup/abc/ID_FRONT-1234.jpg"
    );
  });

  it("keeps the slashes that separate path segments", () => {
    // Encoding the whole string would turn the separators into %2F and address
    // one object whose name contains slashes, which does not exist.
    expect(copySource("b", "a/b/c.jpg")).toBe("b/a/b/c.jpg");
  });

  it("encodes a reserved character inside a segment", () => {
    expect(copySource("b", "pickup/a b/c+d.jpg")).toBe("b/pickup/a%20b/c%2Bd.jpg");
  });
});
