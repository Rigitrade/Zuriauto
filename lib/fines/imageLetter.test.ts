import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { imageLetterPdf, isLetterImage, letterPageSize } from "./imageLetter";
import { pdfPageCount, rasterisePdf } from "./raster";
import { freeReader } from "./reader";

/**
 * A photographed letter, made into the PDF the rest of the pipeline reads.
 * The browser half — decoding the photo upright with `compressImage` — needs
 * a browser's decoder and is not exercised here.
 */

async function jpeg(width: number, height: number): Promise<Uint8Array> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.font = "40px sans-serif";
  context.fillText("Kontrollschild ZH 949636", 40, 120);
  return new Uint8Array(await canvas.encode("jpeg", 90));
}

describe("isLetterImage", () => {
  it("takes the photo formats by type, and by name when the browser gives none", () => {
    expect(isLetterImage({ type: "image/jpeg", name: "IMG_2041.JPG" })).toBe(true);
    expect(isLetterImage({ type: "image/png", name: "scan" })).toBe(true);
    expect(isLetterImage({ type: "", name: "IMG_2041.HEIC" })).toBe(true);
    expect(isLetterImage({ type: "", name: "WhatsApp Image 2026-10-03.jpeg" })).toBe(true);
  });

  it("leaves PDFs and everything else alone", () => {
    expect(isLetterImage({ type: "application/pdf", name: "busse.pdf" })).toBe(false);
    expect(isLetterImage({ type: "image/gif", name: "busse.gif" })).toBe(false);
    expect(isLetterImage({ type: "text/plain", name: "notes.txt" })).toBe(false);
  });
});

describe("letterPageSize", () => {
  it("gives the long side A4's length and keeps the photo's proportions", () => {
    const portrait = letterPageSize(3000, 4000);
    expect(portrait.height).toBeCloseTo(841.89, 2);
    expect(portrait.width / portrait.height).toBeCloseTo(0.75, 5);

    const landscape = letterPageSize(4000, 3000);
    expect(landscape.width).toBeCloseTo(841.89, 2);
    expect(landscape.height / landscape.width).toBeCloseTo(0.75, 5);
  });

  it("puts a small WhatsApp image on the same size of page as a large photo", () => {
    expect(letterPageSize(580, 758).height).toBeCloseTo(letterPageSize(2900, 3790).height, 5);
  });
});

describe("imageLetterPdf", () => {
  it("makes one page that the upload's checks accept", async () => {
    const pdf = await imageLetterPdf(await jpeg(600, 800), letterPageSize(600, 800));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(await pdfPageCount(pdf)).toBe(1);
  });

  it("is the same bytes for the same photo, so a second drop is caught as a duplicate", async () => {
    const photo = await jpeg(600, 800);
    const a = await imageLetterPdf(photo, letterPageSize(600, 800));
    const b = await imageLetterPdf(photo, letterPageSize(600, 800));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("is rendered at a scan's size, however few pixels the photo had", async () => {
    const [page] = await rasterisePdf(await imageLetterPdf(await jpeg(580, 758), letterPageSize(580, 758)));
    expect(Math.abs(page.height - 3508)).toBeLessThan(5);
  }, 60_000);

  it("reads a photographed letter like the scan it shows", async () => {
    // A phone-sized picture of a clean letter: half a scan's resolution, JPEG.
    const scan = new Uint8Array(
      readFileSync(join(process.cwd(), "lib/fines/__fixtures__/notice-prius-de.pdf"))
    );
    const [shot] = await rasterisePdf(scan, { dpi: 150 });
    const canvas = createCanvas(shot.width, shot.height);
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(shot.width, shot.height);
    pixels.data.set(shot.rgba);
    context.putImageData(pixels, 0, 0);
    const photo = new Uint8Array(await canvas.encode("jpeg", 90));

    const pdf = await imageLetterPdf(photo, letterPageSize(shot.width, shot.height));
    const { extraction: x } = await freeReader.read(pdf, new Date("2026-10-03T12:00:00Z"));

    expect(x.plateText.value).toBe("ZH 513925");
    expect(x.amountCents).toMatchObject({ value: 4000, status: "CONFIRMED" });
    expect(x.violationDate).toMatchObject({ value: "2026-07-02", status: "READ" });
    expect(x.violationTime).toMatchObject({ value: "10:00", status: "READ" });
  }, 240_000);
});
