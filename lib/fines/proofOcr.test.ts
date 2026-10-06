import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { verifyProofText } from "./proof";
import { readProofText } from "./proofOcr";

/**
 * Payment apps show the amount huge. Found in the browser run: the OCR read
 * every line of a TWINT confirmation except "CHF 40.00", so a genuine payment
 * went to the office instead of being confirmed.
 */
describe("readProofText", () => {
  it("reads the large amount on a payment app screenshot, as the browser sends it", async () => {
    const png = readFileSync(join(process.cwd(), "lib/fines/__fixtures__/twint-proof.png"));
    // The browser re-encodes images as JPEG before upload.
    const image = await loadImage(png);
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext("2d").drawImage(image, 0, 0);
    const jpeg = new Uint8Array(await canvas.encode("jpeg", 85));

    const text = await readProofText(jpeg, "image/jpeg");

    expect(text).toContain("40.00");
    expect(
      verifyProofText(text, {
        amountCents: 4000,
        paymentReference: "001980919800084011223301823",
        fineNumber: "840112233 018 2",
      })
    ).toBe("MATCH");
  }, 120_000);
});
