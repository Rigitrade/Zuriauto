import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The decoder must not depend on a CDN. zxing-wasm's default loader fetched
 * its WebAssembly from jsDelivr on every cold start — every letter would fail
 * whenever that host did, and code would run that nobody had checked in.
 */
describe("decodeQrCodes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes with the network unavailable", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network blocked in this test")));
    const { rasterisePdf } = await import("./raster");
    const { decodeQrCodes } = await import("./qrDecode");
    const pdf = new Uint8Array(readFileSync(join(process.cwd(), "lib/fines/__fixtures__/notice-prius-de.pdf")));
    const [page] = await rasterisePdf(pdf);
    const texts = await decodeQrCodes(page);
    expect(texts.some((text) => text.startsWith("SPC"))).toBe(true);
  }, 120_000);
});
