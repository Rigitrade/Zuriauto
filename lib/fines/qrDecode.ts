/**
 * Every QR code on a page, as text.
 *
 * A fine letter usually carries several: the Swiss QR-bill on the payment
 * slip, a link to the issuer's online portal, sometimes an eBill code. This
 * returns all of them; `pickQrBill` chooses the one that matters.
 *
 * ZXing (C++, compiled to WebAssembly) rather than a pure-JS decoder: the
 * QR-bill's code is dense and carries the Swiss cross over its centre, which
 * the lighter decoders give up on.
 */

import { readBarcodes } from "zxing-wasm/reader";
import type { PageImage } from "./raster";

export async function decodeQrCodes(page: PageImage): Promise<string[]> {
  const results = await readBarcodes(
    {
      // The same bytes; the canvas types them over ArrayBufferLike.
      data: page.rgba as Uint8ClampedArray<ArrayBuffer>,
      width: page.width,
      height: page.height,
      colorSpace: "srgb",
    },
    { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 8 }
  );
  return results.filter((result) => result.isValid).map((result) => result.text);
}
