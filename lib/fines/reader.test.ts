import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freeReader } from "./reader";

/**
 * The whole free reader on Ahmed's sample: raster, QR, language, OCR in that
 * language, extraction, validation. Slow — two OCR passes — and the one test
 * that shows the parts work together on a real letter.
 */
describe("freeReader", () => {
  it("reads Ahmed's sample", async () => {
    const pdf = new Uint8Array(
      readFileSync(join(process.cwd(), "lib/fines/__fixtures__/kapo-zh-mahnung.pdf"))
    );
    const result = await freeReader.read(pdf, new Date("2026-10-03T12:00:00Z"));

    expect(result.pages).toBe(1);
    expect(result.qrText?.startsWith("SPC")).toBe(true);
    expect(result.language).toBe("de");

    const x = result.extraction;
    expect(x.kind).toBe("REMINDER");
    expect(x.issuerKind).toBe("POLICE");
    expect(x.fineNumber).toMatchObject({ value: "830557506 017 4", status: "CONFIRMED" });
    expect(x.amountCents).toMatchObject({ value: 4000, status: "CONFIRMED" });
    expect(x.paymentReference.value).toBe("001980919800083055750601742");
    // The marker box makes the year read 2028 — which must not pass as READ.
    expect(["READ", "DOUBTFUL"]).toContain(x.violationDate.status);
    if (x.violationDate.value !== "2026-07-02") {
      expect(x.violationDate.status).toBe("DOUBTFUL");
    }
    expect(result.ocrText).toContain("Lufingen");
  }, 240_000);
});
