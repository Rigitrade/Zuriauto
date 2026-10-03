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
 *
 * The WebAssembly is read from node_modules. Left to its default, the library
 * fetches it from jsDelivr on every cold start — every letter would fail
 * whenever that host did, and code would run that nobody had installed. The
 * file is traced into the functions by `outputFileTracingIncludes`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import type { PageImage } from "./raster";

export const ZXING_WASM = join(
  process.cwd(),
  "node_modules",
  "zxing-wasm",
  "dist",
  "reader",
  "zxing_reader.wasm"
);

let prepared: Promise<unknown> | null = null;

function prepare(): Promise<unknown> {
  prepared ??= readFile(ZXING_WASM).then((wasm) =>
    prepareZXingModule({
      overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) },
      fireImmediately: true,
    })
  );
  return prepared;
}

export async function decodeQrCodes(page: PageImage): Promise<string[]> {
  await prepare();
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
