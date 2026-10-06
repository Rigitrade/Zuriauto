/**
 * Clean, scan-like fine letters for tests and for trying the dashboard.
 *
 * Each is a 300 DPI A4 page rendered as an image — no text layer, like a
 * real scan — with a real Swiss QR-bill code on its payment slip, slightly
 * rotated and speckled. Ahmed's photographed sample is the hard case; these
 * are the ordinary one, in German, French and Italian, for cars in the
 * seeded fleet.
 *
 *   node lib/fines/__fixtures__/makeLetters.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import { writeBarcode } from "zxing-wasm/writer";

const here = dirname(fileURLToPath(import.meta.url));

function qrBill({ iban, creditor, postcode, town, amount, reference, message }) {
  return [
    "SPC", "0200", "1", iban, "S", creditor, "", "", postcode, town, "CH",
    "", "", "", "", "", "", "", amount, "CHF",
    "S", "Rigitrade AG", "Tannenstrasse", "16", "8424", "Embrach", "CH",
    "QRR", reference, message, "EPD",
  ].join("\n");
}

const KAPO = { iban: "CH2430000001800000803", creditor: "Kantonspolizei Zürich", postcode: "8010", town: "Zürich" };
const VD = { iban: "CH9300762011623852957", creditor: "Police cantonale vaudoise", postcode: "1014", town: "Lausanne" };
const TI = { iban: "CH5604835012345678009", creditor: "Polizia cantonale", postcode: "6500", town: "Bellinzona" };

const LETTERS = [
  {
    file: "notice-prius-de.pdf",
    lines: [
      ["Kantonspolizei Zürich", 54, true],
      ["Ordnungsbussen, Postfach, 8010 Zürich", 38],
      ["", 30],
      ["Rigitrade AG", 40], ["Tannenstrasse 16", 40], ["8424 Embrach", 40],
      ["", 30],
      ["Zürich, 20. September 2026", 40],
      ["Ordnungsbusse   OB-Nr. 840112233 018 2", 46, true],
      ["Die Kantonspolizei Zürich hat folgende Übertretung gemäss Anhang zur", 38],
      ["Ordnungsbussenverordnung (OBV) festgestellt:", 38],
      ["Ziffer 303.1.a Überschreiten allgemeiner, fahrzeugbedingter oder", 38],
      ["signalisierter Höchstgeschwindigkeit innerorts    40.00", 38],
      ["Total Bussenbetrag CHF 40.00", 42, true],
      ["Kontrollschild ZH 513925   Fahrzeugart Personenwagen", 40],
      ["Übertretungsort Kloten, Schaffhauserstrasse   Datum / Zeit 02.07.2026, 10:00 Uhr", 38],
      ["Gemessene Geschwindigkeit 56 km/h   Abzug der Geschwindigkeitsbegrenzung 50 km/h", 36],
      ["Zahlbar bis 20.10.2026", 40],
    ],
    qr: qrBill({ ...KAPO, amount: "40.00", reference: "001980919800084011223301823", message: "Ordnungsbusse: 840112233 018 2" }),
  },
  {
    file: "reminder-prius-de.pdf",
    lines: [
      ["Kantonspolizei Zürich", 54, true],
      ["Ordnungsbussen, Postfach, 8010 Zürich", 38],
      ["", 30],
      ["Rigitrade AG", 40], ["Tannenstrasse 16", 40], ["8424 Embrach", 40],
      ["", 30],
      ["Zürich, 1. Oktober 2026", 40],
      ["Mahnung   OB-Nr. 840112233 018 2", 46, true],
      ["Bis jetzt ist bei uns keine Zahlung eingegangen.", 38],
      ["Ziffer 303.1.a Überschreiten allgemeiner, fahrzeugbedingter oder", 38],
      ["signalisierter Höchstgeschwindigkeit innerorts    40.00", 38],
      ["Mahngebühr 20.00", 38],
      ["Total Bussenbetrag CHF 60.00", 42, true],
      ["Kontrollschild ZH 513925   Fahrzeugart Personenwagen", 40],
      ["Übertretungsort Kloten, Schaffhauserstrasse   Datum / Zeit 02.07.2026, 10:00 Uhr", 38],
      ["Zahlbar bis 31.10.2026", 40],
    ],
    qr: qrBill({ ...KAPO, amount: "60.00", reference: "001980919800084011223301823", message: "Ordnungsbusse: 840112233 018 2" }),
  },
  {
    file: "notice-octavia-fr.pdf",
    lines: [
      ["Police cantonale vaudoise", 54, true],
      ["Amendes d'ordre, 1014 Lausanne", 38],
      ["", 30],
      ["Rigitrade AG", 40], ["Tannenstrasse 16", 40], ["8424 Embrach", 40],
      ["", 30],
      ["Lausanne, le 10 septembre 2026", 40],
      ["Amende d'ordre   N° OB 4471 2093 55", 46, true],
      ["Nous avons constaté l'infraction suivante selon l'annexe de l'ordonnance", 38],
      ["sur les amendes d'ordre (OAO):", 38],
      ["chiffre 303.1.b Dépassement de la vitesse maximale à l'intérieur des localités   120.00", 36],
      ["Montant total CHF 120.00", 42, true],
      ["Plaque de contrôle ZH 886530   Genre de véhicule voiture de tourisme", 40],
      ["Lieu de l'infraction Lausanne, Avenue de Rhodanie   Date / heure 14.08.2026, 08:15", 36],
      ["Vitesse mesurée 63 km/h   Vitesse autorisée 50 km/h", 38],
      ["Payable jusqu'au 10.10.2026", 40],
    ],
    qr: qrBill({ ...VD, amount: "120.00", reference: "210000000003139471430009017", message: "Amende d'ordre 4471 2093 55" }),
  },
  {
    file: "notice-octavia-it.pdf",
    lines: [
      ["Polizia cantonale", 54, true],
      ["Multe disciplinari, 6500 Bellinzona", 38],
      ["", 30],
      ["Rigitrade AG", 40], ["Tannenstrasse 16", 40], ["8424 Embrach", 40],
      ["", 30],
      ["Bellinzona, 15 settembre 2026", 40],
      ["Multa disciplinare N. MD 5521 8834 10", 46, true],
      ["Secondo l'allegato dell'ordinanza sulle multe disciplinari (OMD)", 38],
      ["è stata constatata la seguente infrazione:", 38],
      ["cifra 303.2.a Superamento della velocità massima fuori delle località   40.00", 36],
      ["Importo totale CHF 40.00", 42, true],
      ["Targa ZH 886530   Genere di veicolo automobile", 40],
      ["Luogo dell'infrazione Lugano, Via Cantonale   Data / ora 20.08.2026 ore 17:40", 36],
      ["Pagabile entro il 15.10.2026", 40],
    ],
    qr: qrBill({ ...TI, amount: "40.00", reference: "110000000005521883410000006", message: "Multa disciplinare 5521 8834 10" }),
  },
  {
    file: "notice-parkpro-de.pdf",
    lines: [
      ["ParkPro AG", 54, true],
      ["Bahnhofstrasse 10, 8001 Zürich", 38],
      ["", 30],
      ["Rigitrade AG", 40], ["Tannenstrasse 16", 40], ["8424 Embrach", 40],
      ["", 30],
      ["Zürich, 25. September 2026", 40],
      ["Umtriebsentschädigung wegen Besitzesstörung", 46, true],
      ["Referenz-Nr. PP-2026-118734", 40],
      ["Ihr Fahrzeug mit dem Kontrollschild ZH 401859 wurde am 12.09.2026 um 14:32", 38],
      ["auf dem Privatparkplatz Bahnhofstrasse 10 ohne Berechtigung abgestellt.", 38],
      ["Umtriebsentschädigung CHF 50.00", 42, true],
      ["Zahlbar bis 25.10.2026", 40],
    ],
    qr: qrBill({ iban: "CH4431999123000889012", creditor: "ParkPro AG", postcode: "8001", town: "Zürich", amount: "50.00", reference: "000000000000000000000118734", message: "PP-2026-118734" }),
  },
];

async function render(letter) {
  const width = 2480;
  const height = 3508;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, width, height);
  // A scanner never feeds the page perfectly straight.
  ctx.translate(width / 2, height / 2);
  ctx.rotate((0.35 * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  ctx.fillStyle = "#1a1a1a";
  let y = 260;
  for (const [text, size, bold] of letter.lines) {
    ctx.font = `${bold ? "bold " : ""}${size}px Arial`;
    ctx.fillText(text, 200, y);
    y += size * 1.55;
  }

  // The payment slip: a perforation line, then the QR-bill code.
  ctx.fillRect(140, 2400, width - 280, 2);
  ctx.font = "bold 40px Arial";
  ctx.fillText("Zahlteil", 820, 2480);
  const code = await writeBarcode(letter.qr, { format: "QRCode", scale: 9, ecLevel: "M" });
  if (!code.image) throw new Error(code.error);
  const image = await loadImage(Buffer.from(await code.image.arrayBuffer()));
  ctx.drawImage(image, 820, 2530, 560, 560);

  // Speckle, as toner and dust leave it.
  const noise = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < noise.data.length; i += 4 * 97) {
    const v = Math.random() < 0.5 ? -18 : 18;
    noise.data[i] += v;
    noise.data[i + 1] += v;
    noise.data[i + 2] += v;
  }
  ctx.putImageData(noise, 0, 0);

  const jpeg = await canvas.encode("jpeg", 82);
  const pdf = await PDFDocument.create();
  const embedded = await pdf.embedJpg(jpeg);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
  writeFileSync(join(here, letter.file), await pdf.save());
  console.log("wrote", letter.file);
}

for (const letter of LETTERS) await render(letter);
