/**
 * TWINT's "erfolgreiche Transaktion" email, rebuilt from the 05.10.2026
 * screenshot Eng Ahmed sent. The real HTML (Task 0) is the authority; this
 * keeps the tests readable and lets them vary one field at a time.
 */

export interface SampleFields {
  amount: string;
  date: string;
  transaction: string;
  store: string;
  name: string[];
  contact: string[];
  message: string[];
}

export const SAMPLE: SampleFields = {
  amount: "CHF 250.00",
  date: "05.10.2026, 10:00",
  transaction: "ce21e52e-2354-4f6d-a7d7-64a448f335f8",
  store: "Zuriauto",
  name: ["Anna", "Meier"],
  contact: ["anna@example.ch", "+41791234567"],
  message: ["Auto vermieten", "ZH 513 925 W2"],
};

const cell = (label: string, lines: string[]) =>
  `<tr><td style="padding:8px"><b>${label}</b><br>${lines.join("<br>")}</td></tr>`;

export function sampleHtml(overrides: Partial<SampleFields> = {}): string {
  const f = { ...SAMPLE, ...overrides };
  return [
    "<html><head><style>td{font-family:Arial}</style></head><body>",
    "<h2>Hallo Zuriauto</h2><p>Sie haben soeben eine erfolgreiche Transaktion erhalten!</p>",
    "<table>",
    cell("Betrag", [f.amount]),
    cell("Transaktionsdatum", [f.date]),
    cell("Transaktions-Nr.", [f.transaction]),
    cell("Name des Stores", [f.store]),
    "</table>",
    "<h3>Kundeninformation</h3>",
    '<p>Die Kundin oder der Kunde hat bei dieser Zahlung die folgenden Informationen angegeben. Sie können diese Informationen auch aus dem Händler-Portal exportieren, und zwar im Bereich <a href="https://portal.twint.ch">Transaktionen</a>.</p>',
    "<table>",
    cell("Name", f.name),
    cell("Kontakt", f.contact.map((c) => (c.includes("@") ? `<a href="mailto:${c}">${c}</a>` : c))),
    cell("Nachricht", f.message),
    "</table></body></html>",
  ].join("\n");
}

export const SAMPLE_HTML = sampleHtml();
