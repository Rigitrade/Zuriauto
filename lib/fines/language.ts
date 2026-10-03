/**
 * Which language a letter is in.
 *
 * Decides which Tesseract model reads it the second time: reading with all
 * three loaded at once misread the year on Ahmed's sample, reading with the
 * right one did not.
 *
 * The QR message settles it when it names the fine type ("Ordnungsbusse",
 * "Amende d'ordre", "Multa disciplinare"). Otherwise the most common words
 * vote.
 */

import type { QrBill } from "./qrBill";
import type { FineLanguage } from "./types";
import { QR_LANGUAGE_HINTS, STOP_WORDS } from "./vocabulary";

export function detectLanguage(
  text: string,
  qr: QrBill | null
): FineLanguage | null {
  if (qr) {
    for (const [pattern, language] of QR_LANGUAGE_HINTS) {
      if (pattern.test(qr.message)) return language;
    }
  }

  const words = text.toLowerCase().split(/[^a-zà-ÿ']+/).filter(Boolean);
  const scores: Record<FineLanguage, number> = { de: 0, fr: 0, it: 0 };
  for (const word of words) {
    for (const language of ["de", "fr", "it"] as const) {
      if (STOP_WORDS[language].has(word)) scores[language] += 1;
    }
  }

  const best = (Object.entries(scores) as [FineLanguage, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0];
  return best[1] > 0 ? best[0] : null;
}
