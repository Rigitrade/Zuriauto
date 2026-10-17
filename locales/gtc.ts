// The terms, in the three languages a renter can read them in.
//
// The version of 01.10.2026 is the lessor's revision received on 18.10.2026 as
// AGB_GTC_18.10.2026.docx, which dates itself "Stand: 01 Oktober 2026 / AK"
// and ends "Oktober 2026"; the lessor asked for that date to be kept. It adds
// clause 7.6 on tyre and rim damage (7.6–7.8 become 7.7–7.9), rewrites Art. 9
// on reachability, breakdowns, accidents at night and towing, adds the tyre
// row to the table in 11.1, and rewrites 12.3 and 12.4 (the deposit back no
// earlier than five and no later than ten working days after the return).
// Clauses that run to several paragraphs now carry their heading as the
// clause text and their paragraphs as `p` blocks, and 9.3's steps keep their
// "9.3.1" labels inside the paragraphs, so the clause numbering still runs
// 9.1, 9.2 … The docx spells "Identitästdokumente" in 3.1 and 15.1; that slip
// is not carried over. Its German otherwise stands as written; the English and
// French were translated here, reusing the earlier versions' wording wherever
// the German did not change.
//
// The version of 16.10.2026 is that of 15.10.2026 with one change, asked
// for by the lessor on 16.10.2026: clause 12.4 pays the deposit back five to
// ten working days after the return, where it said within ten.
//
// The version of 15.10.2026 is the lessor's own rewrite, received as
// GTC_AGB_DE_15.10.2026.docx: eighteen articles of numbered clauses, which
// replace the twelve articles of the earlier versions outright. The German is
// that document's wording, clause for clause. The English and French were
// translated here from it, as Art. 11 of the version of 06.10.2026 was, citing
// the Code of Obligations as "CO" and writing amounts as the German does. The
// docx's subtitle ("Fahrzeugvermietung – Rigitrade AG") is not repeated, since
// every page that shows the terms already names the lessor. Earlier versions
// (30.07, 06.10, 08.10, 15.10 and 16.10.2026) are in git history, and their PDFs stay
// published.
//
// This file is the source and the published PDFs are built from it
// (`pnpm gtc:pdf`), so the website, the PDFs and the contract appendix cannot
// drift apart. Changing the wording is a new version: change GTC_DATE and every
// `updated` line with it, then rebuild the PDFs.

/**
 * One piece of an article. Since 15.10.2026 the terms are written as numbered
 * clauses without headings, so a `clause` carries the number that the contract
 * and the confirmations point at ("15.1"). `lettered` holds the "a) … i)" items
 * under a clause; they carry their own letters, so they are set without
 * bullets. Since 01.10.2026 a clause that runs to several paragraphs holds
 * its heading ("Reifen- und Felgenschäden:"), followed by `p` paragraphs and
 * at most a `list`, which are set on the clause text's edge. `sub` is how
 * earlier versions were written, and every renderer still sets it.
 */
export type GtcBlock =
  | { kind: "p"; text: string }
  | { kind: "sub"; title: string }
  | { kind: "clause"; num: string; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "lettered"; items: string[] }
  | { kind: "table"; head: [string, string] | null; rows: [string, string][] };

export type GtcSection = {
  num: string;
  title: string;
  blocks: GtcBlock[];
};

/**
 * What the document ends with after its last article: the lessor's
 * particulars, one line each as the document prints them, a closing sentence
 * on when the terms apply, and the date and initials that sign it off.
 */
export type GtcClosing = {
  lessor: string[];
  text: string;
  signoff: string;
};

export type GtcDocument = {
  title: string;
  updated: string;
  sections: GtcSection[];
  closing: GtcClosing;
};

export type GtcLanguage = "de" | "en" | "fr";

export const GTC_LANGUAGES: { code: GtcLanguage; label: string }[] = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

/** The entity named as lessor in all three documents. */
export const GTC_ENTITY = "Rigitrade AG";

/**
 * Document date, shown at the foot of the terms. All three language versions
 * carry the same date; the German and French files print it in this exact
 * DD.MM.YYYY form.
 */
export const GTC_DATE = "01.10.2026";

/**
 * Where the current version's PDF is published (built by `pnpm gtc:pdf`). The
 * date is in the name so a new version is a new file, and a link to an earlier
 * version keeps opening the terms it pointed at.
 */
export function gtcPdfPath(language: GtcLanguage): string {
  const [day, month, year] = GTC_DATE.split(".");
  return `/gtc-pdf/gtc-zuriauto-${year}-${month}-${day}-${language}.pdf`;
}

const gtc: Record<GtcLanguage, GtcDocument> = {
  de: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    updated: "Stand: 01. Oktober 2026 / AK",
    sections: [
      {
        num: "1",
        title: "Geltungsbereich und Vertragsbestandteil",
        blocks: [
          { kind: "clause", num: "1.1", text: "Diese Allgemeinen Geschäftsbedingungen («AGB») gelten für sämtliche Fahrzeugmietverträge der Rigitrade AG («Vermieterin») mit natürlichen und juristischen Personen («Mieter»)." },
          { kind: "clause", num: "1.2", text: "Bestandteil des Mietverhältnisses sind der individuelle Fahrzeugmietvertrag, diese AGB sowie ausdrücklich vereinbarte Zusatzbedingungen und Übergabe- bzw. Rückgabeprotokolle. Bei Widersprüchen gehen individuell vereinbarte Bestimmungen vor, soweit sie ausdrücklich abweichend geregelt sind. Zwingende gesetzliche Bestimmungen bleiben vorbehalten." },
          { kind: "clause", num: "1.3", text: "Die AGB werden dem Mieter vor oder bei Vertragsabschluss zugänglich gemacht. Sie werden Vertragsbestandteil, wenn der Mieter ihnen bei Vertragsschluss wirksam zustimmt. Bei Online-Buchungen muss die Zustimmung vor Abschluss der Buchung ermöglicht und nachvollziehbar dokumentiert werden." },
          { kind: "clause", num: "1.4", text: "Besondere Bedingungen für touristische und private Mieten oder für den berufsmässigen Personentransport gelten ergänzend, soweit sie ausdrücklich in den Mietvertrag einbezogen wurden." },
          { kind: "clause", num: "1.5", text: "Der Mieter ist verpflichtet, den Mietvertrag, diese AGB und die anwendbaren gesetzlichen Vorschriften während der gesamten Mietdauer einzuhalten." },
        ],
      },
      {
        num: "2",
        title: "Buchung, Vertragsabschluss und Mietdauer",
        blocks: [
          { kind: "clause", num: "2.1", text: "Der individuelle Mietvertrag legt insbesondere das Mietfahrzeug, den Mietbeginn, das Mietende, den Übergabe- und Rückgabeort, den Mietpreis, die Zahlungsbedingungen, eine allfällige Kaution, die Kilometerregelung sowie den vereinbarten Nutzungszweck fest." },
          { kind: "clause", num: "2.2", text: "Eine Buchungsanfrage stellt noch keine verbindliche Zusage der Vermieterin dar, sofern die Buchung nicht ausdrücklich bestätigt oder der Mietvertrag anderweitig wirksam abgeschlossen wurde." },
          { kind: "clause", num: "2.3", text: "Die Mietdauer beginnt und endet zu den im Mietvertrag vereinbarten Zeitpunkten. Eine Verlängerung ist nur mit ausdrücklicher Zustimmung der Vermieterin verbindlich. Eine einseitige Verlängerung durch den Mieter ist ausgeschlossen." },
          { kind: "clause", num: "2.4", text: "Stornierungen, Umbuchungen, vorzeitige Rückgaben und allfällige Rückerstattungen richten sich nach den vor Abschluss der Buchung mitgeteilten und vereinbarten Buchungsbedingungen sowie den zwingenden gesetzlichen Bestimmungen." },
          { kind: "clause", num: "2.5", text: "Preise, Zusatzleistungen, Kilometerbegrenzungen, Gebühren, Kautionen und Selbstbehalte werden vor Vertragsschluss bzw. vor verbindlicher Buchung transparent ausgewiesen oder im individuellen Mietvertrag festgehalten. Nicht vereinbarte Zusatzleistungen werden nicht allein aufgrund dieser AGB geschuldet." },
        ],
      },
      {
        num: "3",
        title: "Identität, Führerausweis und zugelassene Fahrer",
        blocks: [
          { kind: "clause", num: "3.1", text: "Der Mieter muss vor der Fahrzeugübergabe seine Identität nachweisen und einen für das betreffende Fahrzeug in der Schweiz gültigen Führerausweis vorlegen. Die Vermieterin kann dafür geeignete Identitätsdokumente verlangen, insbesondere einen Reisepass oder eine amtliche Identitätskarte." },
          { kind: "clause", num: "3.2", text: "Bei ausländischen Führerausweisen muss der Mieter die schweizerischen Anforderungen an deren Anerkennung erfüllen. Ein internationaler Führerausweis oder eine Übersetzung ist vorzulegen, sofern dies nach den anwendbaren Vorschriften erforderlich ist. Ein internationaler Führerausweis ersetzt den nationalen Führerausweis nicht." },
          { kind: "clause", num: "3.3", text: "Der Mieter muss sämtliche im individuellen Mietvertrag oder in den vor der Buchung mitgeteilten Bedingungen festgelegten Mindestalter-, Fahrpraxis- und sonstigen Zulassungsvoraussetzungen erfüllen. Allfällige Zuschläge oder Einschränkungen für bestimmte Fahrergruppen werden vor Vertragsabschluss offengelegt." },
          { kind: "clause", num: "3.4", text: "Das Fahrzeug darf ausschliesslich vom im Mietvertrag bezeichneten Mieter und von ausdrücklich zugelassenen Zusatzfahrern gelenkt werden. Zusatzfahrer müssen vor der Fahrzeugübergabe identifiziert und hinsichtlich ihrer Fahrberechtigung überprüft worden sein. Die Zustimmung des Mieters allein berechtigt keine weitere Person zum Führen des Fahrzeugs." },
          { kind: "clause", num: "3.5", text: "Der Mieter darf das Fahrzeug nicht lenken und keiner Person überlassen, die nicht fahrberechtigt, nicht verkehrstüchtig oder nicht ausdrücklich zugelassen ist." },
          { kind: "clause", num: "3.6", text: "Der Mieter informiert die Vermieterin unverzüglich über den Entzug, die Einschränkung oder den Wegfall einer für die Fahrzeugnutzung erforderlichen Fahrberechtigung." },
          { kind: "clause", num: "3.7", text: "Die Vermieterin darf die Fahrzeugübergabe verweigern, wenn erforderliche Dokumente fehlen, ungültig oder begründet zweifelhaft sind, Zulassungsvoraussetzungen nicht erfüllt sind oder konkrete Umstände gegen eine sichere bzw. vertragsgemässe Nutzung sprechen. Gesetzliche Ansprüche bleiben vorbehalten." },
        ],
      },
      {
        num: "4",
        title: "Zulässige Nutzung und Nutzungsverbote",
        blocks: [
          { kind: "clause", num: "4.1", text: "Das Fahrzeug darf ausschliesslich für den im individuellen Mietvertrag vereinbarten Zweck genutzt werden. Private Ferien- und Freizeitfahrten sind zulässig, wenn der Mietvertrag eine private Nutzung vorsieht." },
          { kind: "clause", num: "4.2", text: "Ein berufsmässiger Personentransport, insbesondere über Vermittlungsplattformen, ist nur zulässig, wenn diese Nutzung im Mietvertrag ausdrücklich vereinbart ist und sämtliche gesetzlichen, behördlichen und versicherungsrechtlichen Voraussetzungen erfüllt sind." },
          { kind: "clause", num: "4.3", text: "Insbesondere untersagt sind:" },
          {
            kind: "lettered",
            items: [
              "a) die Überlassung des Fahrzeugs an nicht zugelassene Fahrer, die unberechtigte Weitergabe oder Untervermietung sowie die Übertragung des Mietvertrags ohne Zustimmung der Vermieterin;",
              "b) die Nutzung für strafbare Handlungen oder sonstige rechtswidrige Zwecke;",
              "c) das Führen unter Alkohol-, Drogen- oder sonstigem fahruntüchtig machendem Einfluss;",
              "d) Rennen, motorsportliche Veranstaltungen, Fahrschulungen, Testfahrten oder gewerbliche Gütertransporte, sofern diese Nutzung nicht ausdrücklich vereinbart wurde;",
              "e) eine Überladung, die Überschreitung der zulässigen Sitzplatz- oder Gewichtsgrenzen sowie eine Nutzung entgegen den Herstellervorgaben;",
              "f) Rauchen und Dampfen im Fahrzeug, einschliesslich der Verwendung von E-Zigaretten;",
              "g) die Manipulation, Entfernung, Beschädigung oder unbefugte Deaktivierung von GPS-, Ortungs- oder sonstigen Sicherheitseinrichtungen;",
              "h) die Nutzung des Fahrzeugs trotz eines erkennbaren sicherheitsrelevanten Defekts oder einer Warnmeldung, bei der eine Weiterfahrt nicht sicher oder nicht vertretbar ist;",
              "i) die Nutzung ausserhalb des vereinbarten Gebiets oder die grenzüberschreitende Nutzung entgegen Ziffer 5.",
            ],
          },
          { kind: "clause", num: "4.4", text: "Der Mieter hat das Fahrzeug sorgfältig, verkehrssicher und gemäss den Herstellerangaben zu benutzen. Er darf keine eigenmächtigen technischen Veränderungen vornehmen." },
          { kind: "clause", num: "4.5", text: "Bei einer wesentlichen Vertragsverletzung kann die Vermieterin den Mietvertrag nach Massgabe des anwendbaren Rechts beenden und die Rückgabe des Fahrzeugs verlangen. Soweit angemessen und erforderlich, kann sie eine Frist zur Behebung der Vertragsverletzung setzen. Bei schwerwiegenden oder dringlichen Umständen bleiben gesetzlich zulässige sofortige Massnahmen vorbehalten." },
        ],
      },
      {
        num: "5",
        title: "Fahrten ins Ausland und geografische Beschränkungen",
        blocks: [
          { kind: "clause", num: "5.1", text: "Fahrten ins Ausland sind nur in Länder zulässig, die von der Vermieterin für das konkrete Fahrzeug und Mietverhältnis ausdrücklich freigegeben wurden. Die freigegebenen Länder sind im Mietvertrag, in der Buchungsbestätigung oder in einer ausdrücklich einbezogenen Länderliste festzuhalten." },
          { kind: "clause", num: "5.2", text: "Der Mieter hat vor Reiseantritt zu prüfen, ob die erforderlichen Fahrzeugdokumente, Versicherungsdeckungen, Einreisevoraussetzungen und gegebenenfalls Pannenhilfeleistungen für die geplanten Länder gültig sind. Er muss sämtliche dort anwendbaren Verkehrs- und sonstigen gesetzlichen Vorschriften beachten." },
          { kind: "clause", num: "5.3", text: "Die Einreise in nicht freigegebene Länder sowie jede Nutzung, die den Versicherungsschutz gefährdet oder verletzt, ist untersagt." },
          { kind: "clause", num: "5.4", text: "Der Mieter trägt die ihm zurechenbaren Maut-, Vignetten-, Park- und sonstigen nutzungsbedingten Strassengebühren." },
        ],
      },
      {
        num: "6",
        title: "Mietpreis, Kilometer, Treibstoff und Ladung",
        blocks: [
          { kind: "clause", num: "6.1", text: "Der Mietpreis, eine allfällige Kilometerbegrenzung, der Preis für Mehrkilometer, die Treibstoff- oder Ladezustandsregelung sowie allfällige Zusatzleistungen ergeben sich aus dem individuellen Mietvertrag oder den vor der Buchung ausdrücklich vereinbarten Preisbedingungen." },
          { kind: "clause", num: "6.2", text: "Soweit nichts anderes vereinbart wurde, trägt der Mieter die während der Mietdauer anfallenden Treibstoff- und Ladekosten. Das Fahrzeug ist mit dem vereinbarten Treibstoff- bzw. Ladezustand zurückzugeben." },
          { kind: "clause", num: "6.3", text: "Fehlender Treibstoff oder Ladestand, Mehrkilometer und vereinbarte Zusatzleistungen dürfen nur nach den zuvor mitgeteilten, vereinbarten und gesetzlich zulässigen Preisen verrechnet werden." },
          { kind: "clause", num: "6.4", text: "Der Mieter ist verpflichtet, den für das Fahrzeug vorgeschriebenen Treibstoff zu verwenden und die Bedienungs- und Ladehinweise des Herstellers einzuhalten. Schäden infolge eines falschen Treibstoffs, unsachgemässer Bedienung oder vertragswidriger Nutzung trägt der Mieter, soweit er dafür nach Gesetz und Vertrag haftet." },
          { kind: "clause", num: "6.5", text: "Parkgebühren, Mautgebühren, Vignetten, Verkehrsgebühren und sonstige nutzungsbedingte Kosten trägt der Mieter, soweit sie während seiner Mietdauer entstehen und ihm rechtlich zuzurechnen sind." },
        ],
      },
      {
        num: "7",
        title: "Unterhalt, Wartung, Schäden und Reinigung",
        blocks: [
          { kind: "clause", num: "7.1", text: "Die Vermieterin trägt grundsätzlich die Kosten regulärer planmässiger Wartungsarbeiten, des üblichen saisonalen Reifenwechsels, der Motorfahrzeugsteuer sowie der von ihr vereinbarten Motorfahrzeughaftpflichtversicherung." },
          { kind: "clause", num: "7.2", text: "Gewöhnliche mechanische Reparaturen und technische Defekte, die der Mieter nicht schuldhaft verursacht hat, gehen grundsätzlich zulasten der Vermieterin, vorbehaltlich der vereinbarten Vertragsbedingungen und zwingender gesetzlicher Rechte." },
          { kind: "clause", num: "7.3", text: "Der Mieter hat vor Fahrtantritt und während der Mietdauer im Rahmen des Zumutbaren auf offensichtliche Mängel, Warnmeldungen, Reifenschäden und andere sicherheitsrelevante Auffälligkeiten zu achten." },
          { kind: "clause", num: "7.4", text: "Bei einer sicherheitsrelevanten Warnmeldung oder einem erheblichen Defekt hat der Mieter die Fahrt an einem sicheren Ort zu unterbrechen und die Vermieterin unverzüglich zu informieren. Eine Weiterfahrt ist nur zulässig, wenn sie nach den Umständen sicher und vertretbar ist oder entsprechend autorisiert wurde." },
          { kind: "clause", num: "7.5", text: "Der Mieter darf Reparaturen grundsätzlich nur nach vorheriger Zustimmung der Vermieterin veranlassen. Ausgenommen sind notwendige Sofortmassnahmen zur Gefahrenabwehr oder zur Vermeidung eines erheblichen weiteren Schadens, wenn eine rechtzeitige Kontaktaufnahme nicht möglich oder nicht zumutbar ist. Belege sind aufzubewahren. Für Pannen- und Abschleppdienste gilt ergänzend Ziffer 9." },
          { kind: "clause", num: "7.6", text: "Reifen- und Felgenschäden:" },
          { kind: "p", text: "Der Mieter ist verpflichtet, das Fahrzeug mit der gebotenen Sorgfalt zu führen und insbesondere Schäden an Reifen und Felgen zu vermeiden. Dazu gehört insbesondere, Trottoir- und Bordsteinkanten nicht unsachgemäss anzufahren oder zu überfahren sowie Hindernisse mit der gebotenen Vorsicht zu passieren." },
          { kind: "p", text: "Verursacht der Mieter schuldhaft einen Reifen- oder Felgenschaden, insbesondere einen Einstich, Schnitt, Riss, Flankenschaden oder sonstigen Beschädigungsschaden, haftet er im gesetzlich zulässigen Umfang für die daraus entstehenden Kosten." },
          { kind: "p", text: "Bei einem vom Mieter schuldhaft verursachten Reifenschaden werden die effektiven Kosten für die erforderliche Reifenreparatur bzw. den erforderlichen Reifenwechsel einschliesslich Montage verrechnet, mindestens jedoch CHF 100.00 pro beschädigtem Reifen. Sofern eine Reparatur nicht fachgerecht möglich oder wirtschaftlich nicht zumutbar ist, werden die effektiven Kosten für den erforderlichen Ersatz des beschädigten Reifens bzw. der beschädigten Felge einschliesslich der erforderlichen Montage verrechnet. Der Ersatz beider Reifen derselben Achse kann zusätzlich verrechnet werden, sofern dies aufgrund gesetzlicher Vorschriften, des tatsächlichen Zustands der Reifen oder verbindlicher Herstellervorgaben erforderlich ist." },
          { kind: "p", text: "Darüber hinaus haftet der Mieter im gesetzlich zulässigen Umfang für einen durch den Schaden verursachten, tatsächlichen und nachweisbaren Mietausfall sowie für weitere unmittelbar verursachte und angemessene Kosten, soweit diese nicht bereits durch die vorgenannten Beträge abgegolten sind." },
          { kind: "p", text: "Die Haftung setzt voraus, dass der Schaden dem Mieter rechtlich zugerechnet werden kann. Nicht vom Mieter zu vertretende Schäden, insbesondere Materialfehler oder unvermeidbare Fremdeinwirkungen, bleiben ausgenommen." },
          { kind: "clause", num: "7.7", text: "Das Fahrzeug ist in ordentlichem Zustand zurückzugeben. Normale, vertragsgemässe Abnutzung gilt nicht als Schaden." },
          { kind: "clause", num: "7.8", text: "Bei übermässiger oder vertragswidriger Verschmutzung, insbesondere durch starke Gerüche, Tierhaare, Rauchspuren, Flüssigkeitsverschüttungen oder sonstige Verschmutzungen, die eine professionelle Spezialreinigung erfordern, kann die Vermieterin die tatsächlich angefallenen, angemessenen Reinigungskosten verrechnen. Eine Mindestpauschale von CHF 150.00 gilt nur, sofern sie vor Vertragsabschluss vereinbart wurde und im konkreten Fall angemessen und rechtlich zulässig ist." },
          { kind: "clause", num: "7.9", text: "Verlust, Diebstahl oder Beschädigung von Fahrzeugschlüsseln, Fahrzeugausweis, Kontrollschildern, Ladekarten oder anderem überlassenem Zubehör sind unverzüglich zu melden. Der Mieter haftet im gesetzlich zulässigen Umfang für erforderliche und angemessene Ersatzbeschaffungs- und Wiederherstellungskosten, soweit er dafür verantwortlich ist." },
        ],
      },
      {
        num: "8",
        title: "Versicherung, Selbstbehalt und Haftung",
        blocks: [
          { kind: "clause", num: "8.1", text: "Der im Mietvertrag ausdrücklich bezeichnete Versicherungsschutz und die massgeblichen Versicherungsbedingungen sind für den Umfang der Deckung massgeblich. Die Vermieterin informiert den Mieter vor Vertragsabschluss über den vereinbarten Versicherungsschutz, einen allfälligen Selbstbehalt und wesentliche Ausschlüsse." },
          { kind: "clause", num: "8.2", text: "Eine Deckung für berufsmässigen Personentransport oder andere besondere Nutzungsarten besteht nur, wenn sie für den konkreten Einsatzzweck tatsächlich vereinbart und versichert ist. Der Mieter darf das Fahrzeug nicht entgegen den vereinbarten Versicherungsbedingungen verwenden." },
          { kind: "clause", num: "8.3", text: "Der Mieter haftet nach den gesetzlichen Bestimmungen und dem wirksam vereinbarten Mietvertrag insbesondere für:" },
          {
            kind: "lettered",
            items: [
              "a) Schäden am Mietfahrzeug, die er schuldhaft verursacht hat oder für die er gesetzlich einzustehen hat;",
              "b) einen vereinbarten Versicherungs-Selbstbehalt, soweit dieser nach dem Mietvertrag geschuldet ist und ein entsprechendes, vom Mieter zu vertretendes Schadenereignis vorliegt;",
              "c) nicht gedeckte Schäden und Kosten, soweit diese dem Mieter rechtlich zurechenbar sind;",
              "d) Verkehrsverstösse, Bussen und sonstige Sanktionen, soweit diese durch sein Verhalten verursacht wurden und ihm rechtlich auferlegt werden können;",
              "e) berechtigte Ansprüche Dritter, soweit der Mieter dafür gesetzlich haftet.",
            ],
          },
          { kind: "clause", num: "8.4", text: "Eine Haftung für Totalschaden, Nutzungsausfall, Mietausfall oder sonstige Folgeschäden besteht nur, soweit die jeweiligen Voraussetzungen nach Gesetz und Vertrag erfüllt sind, ein ersatzfähiger Schaden nachgewiesen ist und keine doppelte Entschädigung erfolgt." },
          { kind: "clause", num: "8.5", text: "Die Haftung der Vermieterin richtet sich nach dem anwendbaren Recht. Haftungsbeschränkungen gelten nur im gesetzlich zulässigen Umfang. Insbesondere bleiben zwingende Haftungsvorschriften und die gesetzlichen Regeln über vorsätzliches oder grobfahrlässiges Verhalten vorbehalten." },
          { kind: "clause", num: "8.6", text: "Der Mieter hat zumutbare Massnahmen zur Verhinderung und Begrenzung von Schäden zu treffen, den Versicherungsschutz nicht zu gefährden und an der Schadenabwicklung mitzuwirken. Die Melde- und Mitwirkungspflichten gemäss Ziffer 9 bleiben vorbehalten." },
        ],
      },
      {
        num: "9",
        title: "Unfall, Panne, Erreichbarkeit und Schadenmanagement",
        blocks: [
          { kind: "clause", num: "9.1", text: "Allgemeine Erreichbarkeit des Mieters:" },
          { kind: "p", text: "Der Mieter ist verpflichtet, während der Mietdauer unter der von ihm angegebenen Mobiltelefonnummer erreichbar zu sein und sicherzustellen, dass sein Mobiltelefon ausreichend geladen und für eingehende Anrufe und Nachrichten empfangsbereit ist." },
          { kind: "p", text: "Im Falle einer Panne, eines Unfalls, eines technischen Defekts oder eines sonstigen Fahrzeugproblems hat der Mieter sein Mobiltelefon, soweit sicher und zumutbar, so einzustellen, dass Anrufe und Nachrichten der Vermieterin zuverlässig wahrgenommen werden können. Insbesondere sind der Stummmodus und Funktionen wie «Bitte nicht stören» vorübergehend zu deaktivieren, soweit diese die Erreichbarkeit beeinträchtigen." },
          { kind: "p", text: "Der Mieter hat Rückrufversuche der Vermieterin unverzüglich, spätestens innerhalb von 10 Minuten nach Kenntnisnahme des Rückrufversuchs, zu beantworten. Dies gilt grundsätzlich auch zwischen 00:00 und 07:00 Uhr, sofern keine berechtigten Hinderungsgründe vorliegen. Die Sicherheit des Mieters und Dritter sowie zwingende gesetzliche Vorschriften haben jederzeit Vorrang." },
          { kind: "clause", num: "9.2", text: "Vorgehen bei Pannen und technischen Defekten:" },
          { kind: "p", text: "Bei einer Panne, einer Warnmeldung oder einem technischen Defekt hat der Mieter das Fahrzeug unverzüglich an einem sicheren Ort anzuhalten, die erforderlichen Sicherheitsmassnahmen zu treffen und die Vermieterin telefonisch zu informieren. Die Anweisungen der Vermieterin sind zu befolgen, soweit diese rechtmässig, zumutbar und sicher sind." },
          { kind: "p", text: "Ist die Vermieterin telefonisch nicht erreichbar, hat der Mieter grundsätzlich mindestens 15 Minuten auf einen Rückruf zu warten, sofern dies angesichts der konkreten Situation sicher und zumutbar ist. Während dieser Zeit hat der Mieter der Vermieterin zusätzlich eine WhatsApp-Nachricht mit der Bitte um Rückruf, einer kurzen Beschreibung des Problems und dem Standort des Fahrzeugs zu senden." },
          { kind: "p", text: "Während der Wartezeit hat der Mieter für einen Rückruf erreichbar zu bleiben und unnötige Telefonate zu vermeiden. Soweit technisch möglich und zumutbar, hat er eine aktive Mailbox sowie Rufumleitungen, die eine unmittelbare Erreichbarkeit verhindern, vorübergehend zu deaktivieren. Die hierfür erforderlichen Einstellungen richten sich nach den Möglichkeiten und Anweisungen des jeweiligen Mobilfunkanbieters." },
          { kind: "p", text: "Die Wartepflicht gilt nicht, wenn sofortige Massnahmen zur Gefahrenabwehr, zur Sicherung der Unfallstelle oder zur Vermeidung erheblicher Folgeschäden erforderlich sind." },
          { kind: "clause", num: "9.3", text: "Besondere Vorgehensweise bei Unfällen zwischen 00:00 und 07:00 Uhr:" },
          { kind: "p", text: "Bei einem Verkehrsunfall zwischen 00:00 und 07:00 Uhr hat der Mieter zusätzlich zu den allgemeinen Melde- und Mitwirkungspflichten die nachfolgenden Schritte einzuhalten, soweit dies angesichts der konkreten Situation sicher und möglich ist." },
          { kind: "p", text: "9.3.1 Unfallstelle sichern und Unfallprotokoll erstellen: Der Mieter hat das Fahrzeug an einem sicheren Ort anzuhalten, die Unfallstelle abzusichern und erforderliche Erste-Hilfe- oder Notfallmassnahmen einzuleiten. Bei Verletzten oder unmittelbarer Gefahr sind unverzüglich die zuständigen Notdienste zu verständigen. Soweit möglich und sicher, hat der Mieter gemeinsam mit den beteiligten Unfalllenkern ein Unfallprotokoll aufzunehmen. Dabei sind insbesondere die Personalien und Kontaktdaten der Beteiligten, die Kontrollschilder, die Versicherungsangaben sowie die für die Dokumentation des Unfallhergangs erforderlichen Informationen festzuhalten." },
          { kind: "p", text: "9.3.2 Polizei verständigen: Bei Unfällen zwischen 00:00 und 07:00 Uhr hat der Mieter grundsätzlich die Polizei unter 117 zu kontaktieren, den Unfall zu melden und sich nach dem weiteren Vorgehen zu erkundigen. Gesetzliche Meldepflichten und polizeiliche Anweisungen sind einzuhalten. Bei Verletzten oder akuter Gefahr sind die zuständigen Notdienste unverzüglich zu alarmieren." },
          { kind: "p", text: "9.3.3 Fotos und Beweissicherung: Der Mieter hat unmittelbar nach dem Unfall, sofern dies gefahrlos möglich ist, aussagekräftige Fotos zur Dokumentation aufzunehmen. Diese sollen insbesondere Folgendes zeigen: die Kontrollschilder sämtlicher beteiligter Fahrzeuge; die Position und Stellung der Fahrzeuge zueinander sowie ihre Lage auf der Unfallstelle; sämtliche sichtbaren Schäden am Mietfahrzeug und an den beteiligten Fahrzeugen; die Unfallstelle, relevante Verkehrssignale und sonstige für die Rekonstruktion des Unfallhergangs wichtige Umstände. Die Fotos und das Unfallprotokoll sind der Vermieterin so schnell wie möglich, vorzugsweise per WhatsApp, zu übermitteln." },
          { kind: "p", text: "9.3.4 Vermieterin und Pannenhilfe kontaktieren: Nach der Sicherung der Unfallstelle und der erforderlichen Unfallaufnahme hat der Mieter erneut die Vermieterin zu kontaktieren. Ist diese nicht erreichbar oder wird Pannenhilfe benötigt, hat der Mieter die nachfolgende Pannenhilfe zu kontaktieren:" },
          {
            kind: "list",
            items: [
              "Pannenhilfe-Telefonnummer: 058 275 27 27",
              "Versicherungs-/Vertragsnummer: 6010 6169 937",
              "Vertragsname: Katamesh",
            ],
          },
          { kind: "p", text: "Der Mieter hat der Pannenhilfe seine Mobiltelefonnummer, den möglichst genauen Standort des Fahrzeugs sowie eine kurze Beschreibung des Unfalls und des Fahrzeugzustands mitzuteilen. Die Vertragsnummer und der Vertragsname sind zur Identifikation des Vertrags anzugeben. Der Mieter hat die Anweisungen der Pannenhilfe zu befolgen. Nach Übermittlung der erforderlichen Angaben kann er das Gespräch beenden und hat anschliessend an einem sicheren Ort auf die Unterstützung zu warten. Er muss telefonisch erreichbar bleiben, bis die Angelegenheit geklärt ist oder die Hilfe eingetroffen ist." },
          { kind: "p", text: "9.3.5 Weitere Massnahmen und Dokumentation: Der Mieter hat alle relevanten Informationen, Fotos, Unfallprotokolle, Polizeireferenznummern und Belege aufzubewahren und der Vermieterin auf Verlangen unverzüglich zur Verfügung zu stellen. Notwendige Sofortmassnahmen zur Gefahrenabwehr, zur Sicherung des Fahrzeugs oder zur Vermeidung erheblicher Folgeschäden bleiben jederzeit vorbehalten. Der Mieter hat die Vermieterin über solche Massnahmen so schnell wie möglich zu informieren." },
          { kind: "clause", num: "9.4", text: "Beauftragung von Abschleppdiensten, Pannendiensten und Werkstätten:" },
          { kind: "p", text: "Der Mieter darf ohne vorherige ausdrückliche telefonische oder schriftliche Freigabe der Vermieterin grundsätzlich keinen Abschleppdienst, Pannendienst oder eine Werkstatt im Namen oder auf Kosten der Vermieterin beauftragen." },
          { kind: "p", text: "Diese Einschränkung gilt nicht, wenn sofortige Massnahmen zur Abwehr einer Gefahr für Personen, zur Sicherung des Fahrzeugs oder zur Vermeidung erheblicher Folgeschäden erforderlich sind und die Vermieterin trotz angemessener Kontaktversuche nicht rechtzeitig erreichbar ist. In solchen Fällen darf der Mieter die erforderlichen und verhältnismässigen Massnahmen veranlassen. Er hat die Vermieterin so schnell wie möglich zu informieren und die getroffenen Massnahmen sowie die entstandenen Kosten zu dokumentieren." },
          { kind: "p", text: "Soweit es die konkrete Situation zulässt, hat der Mieter vor einer Beauftragung die Zustimmung der Vermieterin abzuwarten. Eine Beauftragung ohne vorherige Zustimmung begründet für sich allein keinen automatischen Anspruch auf Kostenübernahme durch die Vermieterin." },
          { kind: "clause", num: "9.5", text: "Kostenfolgen bei vertragswidriger Beauftragung Dritter:" },
          { kind: "p", text: "Veranlasst der Mieter entgegen den vorstehenden Bestimmungen ohne erforderliche Freigabe der Vermieterin Leistungen eines Abschleppdienstes, Pannendienstes oder einer Werkstatt, hat er die dadurch verursachten Kosten zu tragen, soweit diese auf einer ihm zurechenbaren Vertragsverletzung beruhen und ihm nach den gesetzlichen Bestimmungen auferlegt werden können." },
          { kind: "p", text: "Die Kosten können insbesondere Abschlepp-, Anfahrts-, Diagnose-, Reparatur- und Nebenkosten umfassen, sofern sie tatsächlich angefallen, angemessen und nachgewiesen sind. Die Kostenübernahme durch die Vermieterin richtet sich nach dem Mietvertrag, den anwendbaren Versicherungsbedingungen und den gesetzlichen Bestimmungen. Eine doppelte Verrechnung derselben Kosten oder desselben Schadens unter verschiedenen Positionen ist ausgeschlossen." },
          { kind: "clause", num: "9.6", text: "Unfall, Diebstahl und sonstige Schadenmeldung:" },
          { kind: "p", text: "Bei einem Unfall hat der Mieter die Unfallstelle zu sichern, erforderlichenfalls Verletzten Hilfe zu leisten und den Rettungsdienst über die Notrufnummer 144 zu alarmieren. Die Polizei ist zu verständigen, wenn dies gesetzlich vorgeschrieben oder aufgrund der Umstände erforderlich ist. Für Unfälle zwischen 00:00 und 07:00 Uhr gilt ergänzend Ziffer 9.3." },
          { kind: "p", text: "Soweit möglich und gefahrlos, hat der Mieter die Angaben der Beteiligten und Zeugen, Kontrollschilder, Versicherungsinformationen, Fotos der Schäden und Unfallstelle sowie einen Unfallbericht zu sichern." },
          { kind: "p", text: "Der Mieter darf ohne entsprechende Berechtigung kein Schuldanerkenntnis abgeben und keine verbindlichen Vergleiche über Schadenersatzansprüche abschliessen." },
          { kind: "p", text: "Jeder Unfall, Schaden, Diebstahl, Verlust oder sonstige versicherungsrelevante Vorfall ist der Vermieterin unverzüglich, möglichst innerhalb von 24 Stunden nach Kenntnisnahme, zu melden. Ist dies aufgrund von Verletzungen, behördlichen Massnahmen oder anderen wichtigen Gründen nicht möglich oder nicht zumutbar, ist die Meldung nach Wegfall des Hindernisses unverzüglich nachzuholen." },
          { kind: "p", text: "Der Mieter hat bei der Abklärung und Regulierung des Schadens vollständig und wahrheitsgemäss mitzuwirken sowie erforderliche und rechtmässig verlangte Unterlagen bereitzustellen." },
          { kind: "clause", num: "9.7", text: "Schadenminderung, Mitwirkung und Sicherheit:" },
          { kind: "p", text: "Der Mieter ist verpflichtet, zumutbare Massnahmen zur Begrenzung von Schäden und Kosten zu treffen und bei der Abklärung und Bearbeitung eines Pannen- oder Schadenfalls angemessen mitzuwirken." },
          { kind: "p", text: "Der Mieter hat sämtliche verfügbaren Rechnungen, Belege, Fotos, Unfallprotokolle und sonstigen relevanten Unterlagen aufzubewahren und der Vermieterin auf Verlangen unverzüglich zur Verfügung zu stellen." },
          { kind: "p", text: "Keine Bestimmung dieser Ziffer verpflichtet den Mieter, sich selbst oder Dritte zu gefährden, notwendige Erste-Hilfe-Massnahmen zu verzögern oder gesetzliche Pflichten zu verletzen. Gesetzliche Meldepflichten, polizeiliche Anweisungen und zwingende gesetzliche Vorschriften bleiben vorbehalten." },
        ],
      },
      {
        num: "10",
        title: "Rückgabe, Übergabeprotokoll und Ersatzfahrzeug",
        blocks: [
          { kind: "clause", num: "10.1", text: "Das Fahrzeug ist am vereinbarten Ort und zum vereinbarten Zeitpunkt mit sämtlichen Schlüsseln, Dokumenten und Zubehör zurückzugeben." },
          { kind: "clause", num: "10.2", text: "Bei Übergabe und Rückgabe sollen Fahrzeugzustand, vorhandene Schäden, Kilometerstand, Treibstoff- oder Ladezustand und Zubehör in einem Protokoll festgehalten werden. Fotos können ergänzend als Beweismittel dienen." },
          { kind: "clause", num: "10.3", text: "Der Mieter hat erkennbare Schäden oder Abweichungen bei der Übernahme unverzüglich zu melden. Eine unterlassene Meldung allein begründet nicht automatisch die Haftung des Mieters für einen Schaden, dessen Verursachung durch ihn nicht nachgewiesen werden kann. Die gesetzlichen Beweislastregeln bleiben vorbehalten." },
          { kind: "clause", num: "10.4", text: "Bei der Rückgabe festgestellte neue Schäden sind zu dokumentieren und dem Mieter zeitnah mitzuteilen. Die Verantwortlichkeit des Mieters richtet sich nach Gesetz und Vertrag." },
          { kind: "clause", num: "10.5", text: "Eine verspätete Rückgabe ist der Vermieterin unverzüglich mitzuteilen. Eine Verlängerung ist nur mit ausdrücklicher Zustimmung verbindlich. Bei unberechtigter verspäteter Rückgabe kann die Konventionalstrafe gemäss Ziffer 11 sowie ein gesetzlich geschuldeter weiterer Schadenersatz verlangt werden. Eine doppelte Entschädigung desselben Schadens ist ausgeschlossen." },
          { kind: "clause", num: "10.6", text: "Bei einer unverschuldeten Panne oder einem technischen Defekt bemüht sich die Vermieterin, nach Verfügbarkeit ein gleichwertiges Ersatzfahrzeug bereitzustellen. Ein genereller Anspruch auf ein Ersatzfahrzeug besteht nur, soweit er ausdrücklich vereinbart oder gesetzlich geschuldet ist. Zwingende gesetzliche Rechte des Mieters bleiben vorbehalten." },
          { kind: "clause", num: "10.7", text: "Die Rückgabe gilt als erfolgt, wenn das Fahrzeug und die überlassenen Gegenstände der Vermieterin oder einer von ihr autorisierten Person tatsächlich übergeben wurden oder die Vermieterin die Rückgabe anderweitig bestätigt hat." },
        ],
      },
      {
        num: "11",
        title: "Konventionalstrafen und Unkostenpauschalen",
        blocks: [
          { kind: "clause", num: "11.1", text: "Für die nachfolgend aufgeführten schuldhaften Vertragsverletzungen bzw. Schadenfälle können, sofern die jeweiligen gesetzlichen und vertraglichen Voraussetzungen erfüllt sind, folgende Konventionalstrafen bzw. Mindestpauschalen vereinbart werden:" },
          {
            kind: "table",
            head: ["Vertragsverletzung / Schadenfall", "Konventionalstrafe / Pauschale"],
            rows: [
              ["Unberechtigte verspätete Rückgabe, pro angefangenem Kalendertag", "CHF 100.00"],
              ["Wesentliche, schuldhafte Falschangabe zur Wohn- oder Zustelladresse, sofern sie für den Vertragsabschluss oder die Durchsetzung von Ansprüchen erheblich ist", "CHF 500.00"],
              ["Überlassung des Fahrzeugs an einen nicht zugelassenen Fahrer", "CHF 500.00"],
              ["Rauchen oder Dampfen im Fahrzeug", "CHF 250.00"],
              ["Vorsätzliche oder schuldhafte Manipulation, Entfernung oder unbefugte Deaktivierung des GPS- oder Ortungssystems", "CHF 800.00"],
              ["Schuldhafte, wesentliche Verletzung der Unfallmeldepflicht", "CHF 500.00"],
              ["Schuldhaft verursachter Reifen- oder Felgenschaden (z. B. Trottoirkantenkontakt, Schnitt, Riss oder unsachgemässe Handhabung)", "Mindestens CHF 100.00 (zzgl. effektiver Ersatzkosten & Mietausfall gemäss Ziff. 7.6)"],
            ],
          },
          { kind: "clause", num: "11.2", text: "Die Konventionalstrafen gelten nur, wenn die jeweilige Vertragsverletzung und die erforderlichen gesetzlichen Voraussetzungen vorliegen. Sie ersetzen nicht die Pflicht, eine Vertragsverletzung zu beenden oder das Fahrzeug zurückzugeben." },
          { kind: "clause", num: "11.3", text: "Übermässig hohe Konventionalstrafen können durch das zuständige Gericht nach Art. 163 Abs. 3 OR herabgesetzt werden." },
          { kind: "clause", num: "11.4", text: "Ein weitergehender nachgewiesener Schadenersatz bleibt im Rahmen des anwendbaren Rechts, insbesondere Art. 161 Abs. 2 OR, vorbehalten. Zahlungen und Entschädigungen werden so angerechnet, dass derselbe Schaden nicht doppelt ersetzt wird." },
        ],
      },
      {
        num: "12",
        title: "Kaution, Zahlungsrückstand und Gebühren",
        blocks: [
          { kind: "clause", num: "12.1", text: "Höhe, Zahlungsart und Zeitpunkt der Kaution sowie die akzeptierten Zahlungsmittel werden vor Vertragsabschluss im individuellen Mietvertrag oder in den Buchungsbedingungen festgelegt." },
          { kind: "clause", num: "12.2", text: "Die Kaution dient der Sicherung berechtigter Forderungen aus dem Mietverhältnis. Nachweislich geschuldete und fällige Beträge dürfen im gesetzlich zulässigen Umfang verrechnet werden. Die Vermieterin informiert den Mieter nachvollziehbar über solche Verrechnungen." },
          { kind: "clause", num: "12.3", text: "Sind bei der Rückgabe konkrete Ansprüche oder behördliche Anfragen (z. B. angekündigte Bussen, Radar-Fotos oder Halterauskünfte) erkennbar, die noch nicht abschliessend beziffert werden können, darf ein der erwarteten Forderung entsprechender Teilbetrag der Kaution bis zur vollständigen Klärung und Begleichung zurückbehalten werden. Ein unbestrittener Restbetrag wird fristgerecht zurückbezahlt." },
          { kind: "clause", num: "12.4", text: "Frist für die Kautionsrückzahlung:" },
          { kind: "p", text: "Die Rückzahlung der Kaution erfolgt frühestens nach 5 und spätestens innerhalb von 10 Arbeitstagen nach ordnungsgemässer Rückgabe des Fahrzeugs. Diese Frist dient insbesondere der Überprüfung und Abwicklung nachträglich eingehender Forderungen, wie etwa Verkehrs- und Ordnungsbussen (z. B. Geschwindigkeits- oder Rotlichtübertretungen / Radarfotos), Mautgebühren oder verdeckten Schäden, die zum Zeitpunkt der Fahrzeugrückgabe noch nicht bekannt waren. Die tatsächliche Gutschriftzeit auf dem Konto oder der Kreditkarte des Mieters kann je nach Zahlungsdienstleister variieren." },
          { kind: "clause", num: "12.5", text: "Bei Zahlungsverzug kann die Vermieterin die gesetzlich zulässigen Mahn-, Inkasso- und Betreibungsschritte einleiten. Die nachfolgenden Gebühren dürfen nur erhoben werden, soweit sie vor Vertragsabschluss wirksam vereinbart wurden und im konkreten Fall gesetzlich zulässig und angemessen sind:" },
          {
            kind: "table",
            head: ["Leistung", "Gebühr"],
            rows: [
              ["Bearbeitung einer Verkehrsbusse oder behördlichen Anfrage", "CHF 20.00"],
              ["Mahnung bei Zahlungsverzug", "CHF 20.00"],
              ["Interner administrativer Aufwand im Zusammenhang mit der Einleitung einer Betreibung", "CHF 80.00"],
              ["Organisation einer erforderlichen Fahrzeugrückholung", "Mindestens CHF 400.00"],
              ["Verwahrung des Fahrzeugs", "CHF 50.00 pro Tag"],
            ],
          },
          { kind: "clause", num: "12.6", text: "Gebühren nach Ziffer 12.5 werden nur im zulässigen Umfang verrechnet. Soweit tatsächlicher Aufwand oder Kosten Dritter geltend gemacht werden, sind sie auf Nachfrage nachvollziehbar zu belegen. Amtliche Gebühren und externe Kosten werden von internen Bearbeitungsgebühren unterschieden. Zusätzliche externe Kosten dürfen nur verrechnet werden, wenn sie tatsächlich angefallen, rechtlich zurechenbar und ersatzfähig sind." },
          { kind: "clause", num: "12.7", text: "Eine mehrfache Belastung desselben Aufwands oder Schadens unter verschiedenen Gebühren- oder Schadenersatzpositionen ist ausgeschlossen." },
        ],
      },
      {
        num: "13",
        title: "Fahrzeugrückforderung und rechtliche Schritte",
        blocks: [
          { kind: "clause", num: "13.1", text: "Nach Ablauf der vereinbarten Mietdauer oder nach wirksamer Beendigung des Mietvertrags hat der Mieter das Fahrzeug fristgerecht zurückzugeben." },
          { kind: "clause", num: "13.2", text: "Erfolgt die Rückgabe nicht, kann die Vermieterin die Rückgabe verlangen und, soweit erforderlich, eine angemessene Frist setzen. Bei Dringlichkeit oder konkreter Gefährdung des Fahrzeugs bleiben unmittelbar zulässige rechtliche Massnahmen vorbehalten." },
          { kind: "clause", num: "13.3", text: "Angemessene und nachgewiesene Kosten der Fahrzeugrückholung können dem Mieter auferlegt werden, soweit dieser die Rückholung schuldhaft verursacht hat und eine gesetzliche oder wirksam vereinbarte vertragliche Grundlage besteht." },
          { kind: "clause", num: "13.4", text: "Bei erheblichem Zahlungsverzug, unberechtigter Weitergabe, Manipulation von Sicherheitseinrichtungen oder sonstigen wesentlichen Vertragsverletzungen kann die Vermieterin geeignete, verhältnismässige und gesetzlich zulässige Massnahmen zur Sicherung und Rückforderung des Fahrzeugs ergreifen." },
          { kind: "clause", num: "13.5", text: "Die Vermieterin kann bei ausbleibender Rückgabe oder anderen erheblichen Vertragsverletzungen ihre zivilrechtlichen Ansprüche geltend machen und gegebenenfalls die zuständigen Behörden informieren. Eine verspätete Rückgabe oder sonstige Vertragsverletzung stellt nicht automatisch eine Straftat dar." },
        ],
      },
      {
        num: "14",
        title: "GPS-Tracking, Fahrzeugortung und Fernstilllegung",
        blocks: [
          { kind: "clause", num: "14.1", text: "Das Fahrzeug kann mit einem GPS-Ortungs- oder Flottenmanagementsystem ausgestattet sein. Standort- und Fahrzeugdaten dürfen für rechtmässige und verhältnismässige Zwecke bearbeitet werden, insbesondere zur Diebstahlprävention, zum Flottenmanagement, zur Fahrzeugsicherung und zur berechtigten Fahrzeugrückforderung." },
          { kind: "clause", num: "14.2", text: "Die Vermieterin informiert den Mieter in einer zugänglichen Datenschutzerklärung über die wesentlichen Aspekte der Datenbearbeitung, insbesondere die Zwecke, die betroffenen Datenkategorien, Empfänger, Aufbewahrungsdauer oder deren Kriterien sowie die verfügbaren Datenschutzrechte." },
          { kind: "clause", num: "14.3", text: "Standortdaten werden nur so lange aufbewahrt und nur denjenigen Personen zugänglich gemacht, wie dies für die genannten Zwecke erforderlich und rechtlich zulässig ist. Eine Weitergabe erfolgt nur auf einer zulässigen Rechtsgrundlage." },
          { kind: "clause", num: "14.4", text: "Der Mieter darf Ortungs- und Sicherheitseinrichtungen weder manipulieren noch entfernen, beschädigen oder unbefugt deaktivieren. Störungen sind der Vermieterin unverzüglich mitzuteilen." },
          { kind: "clause", num: "14.5", text: "Eine technische Fernstilllegung darf nur erfolgen, wenn sie im konkreten Fall gesetzlich zulässig, erforderlich und verhältnismässig ist. Sie darf insbesondere nicht während der Fahrt oder in einer Situation erfolgen, in der sie den Fahrer, Insassen oder andere Verkehrsteilnehmer gefährden könnte. Die Rückforderung des Fahrzeugs hat auf rechtmässigem Weg zu erfolgen." },
          { kind: "clause", num: "14.6", text: "Die Haftung im Zusammenhang mit Ortung, Fernstilllegung oder Fahrzeugrückforderung richtet sich nach dem anwendbaren Recht. Zwingende Haftungsbestimmungen bleiben vorbehalten." },
        ],
      },
      {
        num: "15",
        title: "Identität, Angaben und Mitwirkungspflichten",
        blocks: [
          { kind: "clause", num: "15.1", text: "Der Mieter bestätigt, dass seine Angaben sowie die von ihm vorgelegten Identitätsdokumente, Führerausweise, Bewilligungen und sonstigen Unterlagen nach bestem Wissen vollständig, wahrheitsgemäss und gültig sind." },
          { kind: "clause", num: "15.2", text: "Dies betrifft insbesondere Name, Identität, Geburtsdatum, Wohn- und Zustelladresse, Kontaktdaten, Zahlungsangaben sowie die für die Fahrzeugnutzung erforderlichen Fahrberechtigungen und Bewilligungen." },
          { kind: "clause", num: "15.3", text: "Wesentliche Änderungen seiner Kontakt- oder Zustelladresse sowie der Wegfall einer erforderlichen Fahrberechtigung sind der Vermieterin unverzüglich mitzuteilen." },
          { kind: "clause", num: "15.4", text: "Bei sachlichem Anlass darf die Vermieterin aktuelle Nachweise verlangen, soweit dies für den Vertragsabschluss, die sichere Fahrzeugüberlassung oder die Durchführung des Mietverhältnisses erforderlich und datenschutzrechtlich zulässig ist." },
          { kind: "clause", num: "15.5", text: "Vorsätzlich falsche oder irreführende Angaben sowie gefälschte oder ungültige Unterlagen können eine wesentliche Vertragsverletzung darstellen. Je nach Sachverhalt können strafrechtliche Tatbestände erfüllt sein; die Beurteilung obliegt den zuständigen Behörden und Gerichten." },
          { kind: "clause", num: "15.6", text: "Der Mieter haftet nach den gesetzlichen Bestimmungen für nachgewiesene, rechtlich zurechenbare Schäden, die er schuldhaft durch falsche Angaben oder die Verwendung unrichtiger Unterlagen verursacht. Ersatzfähige Mietausfälle, Fahrzeugrückführungskosten sowie notwendige und rechtlich ersatzfähige Inkasso- und Rechtsverfolgungskosten können geltend gemacht werden, soweit die gesetzlichen Voraussetzungen erfüllt sind. Eine doppelte Entschädigung desselben Schadens ist ausgeschlossen." },
        ],
      },
      {
        num: "16",
        title: "Berufsmässiger Personentransport und Plattformnutzung",
        blocks: [
          { kind: "clause", num: "16.1", text: "Die Nutzung für berufsmässigen Personentransport, Taxi- oder Plattformfahrten ist nur zulässig, wenn sie im individuellen Mietvertrag ausdrücklich vereinbart wurde." },
          { kind: "clause", num: "16.2", text: "Der Mieter ist dafür verantwortlich, während der gesamten Mietdauer sämtliche für die vereinbarte Nutzung erforderlichen gesetzlichen, behördlichen und vertraglichen Voraussetzungen einzuhalten. Dies umfasst insbesondere erforderliche Fahrberechtigungen (z. B. BPT / Code 121), Bewilligungen und anwendbare Vorschriften für den berufsmässigen Personentransport." },
          { kind: "clause", num: "16.3", text: "Der Mieter hat sicherzustellen, dass das Fahrzeug für den vereinbarten Einsatzzweck zugelassen, ausgerüstet und entsprechend versichert ist. Eine Plattformzulassung oder ein bestimmter Umsatz wird von der Vermieterin nicht garantiert." },
          { kind: "clause", num: "16.4", text: "Der Mieter informiert die Vermieterin unverzüglich über den Wegfall, die Einschränkung oder den Entzug einer für die vereinbarte Nutzung erforderlichen Berechtigung." },
        ],
      },
      {
        num: "17",
        title: "Datenschutz und Mitteilungen",
        blocks: [
          { kind: "clause", num: "17.1", text: "Die Vermieterin bearbeitet Personendaten zur Bearbeitung von Buchungsanfragen, zum Abschluss und zur Durchführung des Mietvertrags, zur Abwicklung von Zahlungen, zur Erfüllung gesetzlicher Pflichten, zur Schadenbearbeitung und zur Wahrung berechtigter Interessen im gesetzlich zulässigen Umfang." },
          { kind: "clause", num: "17.2", text: "Weitere Informationen, insbesondere zu Empfängern, Aufbewahrungsfristen, allfälligen Auslandbekanntgaben und den Rechten betroffener Personen, ergeben sich aus der Datenschutzerklärung der Vermieterin. Diese muss auf der Website leicht zugänglich sein und bei der Buchung bzw. Fahrzeugübernahme verfügbar gemacht werden." },
          { kind: "clause", num: "17.3", text: "Mitteilungen im Zusammenhang mit dem Mietverhältnis können an die im Mietvertrag angegebenen Kontaktadressen gesendet werden, sofern die jeweilige Mitteilung rechtlich in dieser Form zulässig ist." },
          { kind: "clause", num: "17.4", text: "Der Mieter hat Änderungen seiner Kontakt- und Zustelladresse unverzüglich mitzuteilen. Gesetzliche Vorschriften über den Zugang von Erklärungen bleiben vorbehalten." },
        ],
      },
      {
        num: "18",
        title: "Schlussbestimmungen",
        blocks: [
          { kind: "clause", num: "18.1", text: "Gesamte Vereinbarung: Der individuelle Mietvertrag, diese AGB und ausdrücklich einbezogene Zusatzvereinbarungen bilden die Vereinbarung der Parteien über das betreffende Mietverhältnis. Individuelle, ausdrücklich vereinbarte Vertragsbestimmungen gehen bei Widersprüchen diesen AGB vor." },
          { kind: "clause", num: "18.2", text: "Änderungen: Änderungen und Ergänzungen des Mietvertrags bedürfen der Textform, soweit nicht gesetzlich eine strengere Form vorgeschrieben ist oder die Parteien ausdrücklich eine strengere Form vereinbaren." },
          { kind: "clause", num: "18.3", text: "Kein Rechtsverzicht: Die vorübergehende Nichtausübung oder verspätete Durchsetzung eines Rechts durch die Vermieterin gilt nicht als Verzicht auf dieses Recht." },
          { kind: "clause", num: "18.4", text: "Höhere Gewalt: Keine Partei haftet im gesetzlich zulässigen Umfang für Leistungsstörungen, die unmittelbar auf aussergewöhnliche, nicht beherrschbare und trotz zumutbarer Sorgfalt nicht vermeidbare Ereignisse zurückzuführen sind. Die betroffene Partei informiert die andere Partei soweit möglich unverzüglich und trifft zumutbare Massnahmen zur Begrenzung der Auswirkungen. Zwingende gesetzliche Rechte und Haftungsregeln bleiben vorbehalten." },
          { kind: "clause", num: "18.5", text: "Salvatorische Klausel: Sollte eine Bestimmung dieser AGB ganz oder teilweise unwirksam oder undurchsetzbar sein oder werden, bleiben die übrigen Bestimmungen im gesetzlich zulässigen Umfang wirksam. Anstelle der unwirksamen Bestimmung gelten die anwendbaren gesetzlichen Vorschriften." },
          { kind: "clause", num: "18.6", text: "Anwendbares Recht: Es gilt schweizerisches materielles Recht, soweit dessen Anwendung gesetzlich zulässig ist. Zwingende Bestimmungen des internationalen Privatrechts und zwingende Verbraucherschutzvorschriften bleiben vorbehalten." },
          { kind: "clause", num: "18.7", text: "Gerichtsstand Zürich: Soweit eine Gerichtsstandsvereinbarung gesetzlich zulässig ist, wird für sämtliche Streitigkeiten aus oder im Zusammenhang mit dem Mietverhältnis Zürich, Schweiz, als Gerichtsstand vereinbart. Zwingende gesetzliche Gerichtsstände, insbesondere bei Konsumentenverträgen, bleiben vorbehalten. Wo eine vorgängige Gerichtsstandsvereinbarung gesetzlich nicht zulässig ist, gelten die gesetzlichen Gerichtsstände." },
        ],
      },
    ],
    closing: {
      lessor: [
        "Vermieterin: Rigitrade AG",
        "Sitz: Tannenstrasse 16, 8424 Embrach, Schweiz",
        "Geschäftsadresse: Schaffhauserstrasse 550, 8052 Zürich",
      ],
      text: "Diese AGB gelten nur, soweit sie wirksam in den jeweiligen Mietvertrag einbezogen wurden. Der Mieter bestätigt bei Vertragsabschluss, dass er die AGB zugänglich erhalten und ihnen zugestimmt hat.",
      signoff: "Oktober 2026",
    },
  },
  en: {
    title: "General Terms and Conditions (GTC)",
    updated: "As of 1 October 2026 / AK",
    sections: [
      {
        num: "1",
        title: "Scope and Incorporation into the Contract",
        blocks: [
          { kind: "clause", num: "1.1", text: "These General Terms and Conditions (\"GTC\") apply to all vehicle rental agreements of Rigitrade AG (the \"Lessor\") with natural persons and legal entities (the \"Renter\")." },
          { kind: "clause", num: "1.2", text: "The rental relationship comprises the individual vehicle rental agreement, these GTC and any expressly agreed additional terms and handover or return reports. In the event of conflict, the individually agreed provisions take precedence insofar as they expressly provide otherwise. Mandatory statutory provisions remain reserved." },
          { kind: "clause", num: "1.3", text: "The GTC are made available to the Renter before or upon conclusion of the contract. They become part of the contract if the Renter validly agrees to them when the contract is concluded. For online bookings, it must be possible to give this consent before the booking is completed, and the consent must be documented in a verifiable manner." },
          { kind: "clause", num: "1.4", text: "Special terms for tourist and private rentals or for professional passenger transport apply in addition, insofar as they have been expressly incorporated into the rental agreement." },
          { kind: "clause", num: "1.5", text: "The Renter must comply with the rental agreement, these GTC and the applicable statutory provisions throughout the entire rental period." },
        ],
      },
      {
        num: "2",
        title: "Booking, Conclusion of the Contract and Rental Period",
        blocks: [
          { kind: "clause", num: "2.1", text: "The individual rental agreement specifies in particular the rental vehicle, the start and end of the rental, the place of handover and return, the rental price, the payment terms, any deposit, the mileage arrangement and the agreed purpose of use." },
          { kind: "clause", num: "2.2", text: "A booking request does not yet constitute a binding commitment by the Lessor unless the booking has been expressly confirmed or the rental agreement has otherwise been validly concluded." },
          { kind: "clause", num: "2.3", text: "The rental period begins and ends at the times agreed in the rental agreement. An extension is binding only with the Lessor's express consent. A unilateral extension by the Renter is excluded." },
          { kind: "clause", num: "2.4", text: "Cancellations, changes to bookings, early returns and any refunds are governed by the booking terms communicated and agreed before the booking was completed and by mandatory statutory provisions." },
          { kind: "clause", num: "2.5", text: "Prices, additional services, mileage limits, fees, deposits and deductibles are shown transparently before the contract is concluded or before a binding booking is made, or are set out in the individual rental agreement. Additional services that have not been agreed are not owed solely on the basis of these GTC." },
        ],
      },
      {
        num: "3",
        title: "Identity, Driving Licence and Authorised Drivers",
        blocks: [
          { kind: "clause", num: "3.1", text: "Before the vehicle is handed over, the Renter must prove their identity and present a driving licence valid in Switzerland for the vehicle concerned. The Lessor may require suitable identity documents for this purpose, in particular a passport or an official identity card." },
          { kind: "clause", num: "3.2", text: "For foreign driving licences, the Renter must meet the Swiss requirements for their recognition. An international driving permit or a translation must be presented where required under the applicable regulations. An international driving permit does not replace the national driving licence." },
          { kind: "clause", num: "3.3", text: "The Renter must meet all minimum age, driving experience and other eligibility requirements set out in the individual rental agreement or in the terms communicated before booking. Any surcharges or restrictions for certain groups of drivers are disclosed before the contract is concluded." },
          { kind: "clause", num: "3.4", text: "The vehicle may be driven only by the Renter named in the rental agreement and by expressly authorised additional drivers. Additional drivers must have been identified, and their entitlement to drive verified, before the vehicle is handed over. The Renter's consent alone does not entitle any other person to drive the vehicle." },
          { kind: "clause", num: "3.5", text: "The Renter may not drive the vehicle or leave it to any person who is not entitled to drive, not fit to drive or not expressly authorised." },
          { kind: "clause", num: "3.6", text: "The Renter shall inform the Lessor without delay of the withdrawal, restriction or loss of any entitlement to drive required for the use of the vehicle." },
          { kind: "clause", num: "3.7", text: "The Lessor may refuse to hand over the vehicle if required documents are missing, invalid or subject to well-founded doubt, if eligibility requirements are not met, or if specific circumstances indicate that the vehicle would not be used safely or in accordance with the contract. Statutory claims remain reserved." },
        ],
      },
      {
        num: "4",
        title: "Permitted Use and Prohibited Uses",
        blocks: [
          { kind: "clause", num: "4.1", text: "The vehicle may be used only for the purpose agreed in the individual rental agreement. Private holiday and leisure trips are permitted if the rental agreement provides for private use." },
          { kind: "clause", num: "4.2", text: "Professional passenger transport, in particular via intermediary platforms, is permitted only if this use is expressly agreed in the rental agreement and all statutory, regulatory and insurance requirements are met." },
          { kind: "clause", num: "4.3", text: "The following are prohibited in particular:" },
          {
            kind: "lettered",
            items: [
              "a) leaving the vehicle to drivers who are not authorised, passing it on without authorisation or subletting it, and transferring the rental agreement without the Lessor's consent;",
              "b) use for criminal acts or other unlawful purposes;",
              "c) driving under the influence of alcohol, drugs or any other substance that impairs fitness to drive;",
              "d) races, motorsport events, driver training, test drives or the commercial transport of goods, unless such use has been expressly agreed;",
              "e) overloading, exceeding the permitted seating or weight limits, and any use contrary to the manufacturer's specifications;",
              "f) smoking and vaping in the vehicle, including the use of e-cigarettes;",
              "g) tampering with, removing, damaging or deactivating without authorisation any GPS, tracking or other security devices;",
              "h) using the vehicle despite a recognisable safety-relevant defect or a warning message for which continuing the journey is not safe or not justifiable;",
              "i) use outside the agreed area, or cross-border use contrary to clause 5.",
            ],
          },
          { kind: "clause", num: "4.4", text: "The Renter shall use the vehicle with care, safely and in accordance with the manufacturer's specifications. The Renter may not make any technical modifications on their own initiative." },
          { kind: "clause", num: "4.5", text: "In the event of a material breach of contract, the Lessor may terminate the rental agreement in accordance with the applicable law and demand the return of the vehicle. Where appropriate and necessary, the Lessor may set a deadline for the breach to be remedied. In serious or urgent circumstances, immediate measures permitted by law remain reserved." },
        ],
      },
      {
        num: "5",
        title: "Trips Abroad and Geographical Restrictions",
        blocks: [
          { kind: "clause", num: "5.1", text: "Trips abroad are permitted only to countries that the Lessor has expressly approved for the specific vehicle and rental. The approved countries must be recorded in the rental agreement, in the booking confirmation or in an expressly incorporated list of countries." },
          { kind: "clause", num: "5.2", text: "Before setting off, the Renter must check whether the required vehicle documents, insurance cover, entry requirements and, where applicable, breakdown assistance services are valid for the countries planned. The Renter must comply with all traffic and other statutory regulations applicable there." },
          { kind: "clause", num: "5.3", text: "Entering countries that have not been approved, and any use that jeopardises or breaches the insurance cover, is prohibited." },
          { kind: "clause", num: "5.4", text: "The Renter bears the tolls, vignettes, parking fees and other use-related road charges attributable to the Renter." },
        ],
      },
      {
        num: "6",
        title: "Rental Price, Mileage, Fuel and Charging",
        blocks: [
          { kind: "clause", num: "6.1", text: "The rental price, any mileage limit, the price of additional kilometres, the arrangement on fuel or charge level and any additional services are set out in the individual rental agreement or in the pricing terms expressly agreed before booking." },
          { kind: "clause", num: "6.2", text: "Unless otherwise agreed, the Renter bears the fuel and charging costs incurred during the rental period. The vehicle must be returned with the agreed fuel or charge level." },
          { kind: "clause", num: "6.3", text: "Missing fuel or charge, additional kilometres and agreed additional services may be charged only at the prices previously communicated, agreed and permitted by law." },
          { kind: "clause", num: "6.4", text: "The Renter must use the fuel prescribed for the vehicle and follow the manufacturer's operating and charging instructions. Damage resulting from the wrong fuel, improper operation or use contrary to the contract is borne by the Renter insofar as the Renter is liable for it under the law and the contract." },
          { kind: "clause", num: "6.5", text: "Parking fees, tolls, vignettes, traffic charges and other use-related costs are borne by the Renter insofar as they arise during the Renter's rental period and are legally attributable to the Renter." },
        ],
      },
      {
        num: "7",
        title: "Upkeep, Maintenance, Damage and Cleaning",
        blocks: [
          { kind: "clause", num: "7.1", text: "As a rule, the Lessor bears the costs of regular scheduled maintenance, the usual seasonal tyre change, the motor vehicle tax and the motor vehicle liability insurance agreed by it." },
          { kind: "clause", num: "7.2", text: "Ordinary mechanical repairs and technical defects not culpably caused by the Renter are, as a rule, borne by the Lessor, subject to the agreed contractual terms and mandatory statutory rights." },
          { kind: "clause", num: "7.3", text: "Before setting off and during the rental period, the Renter must, within reason, pay attention to obvious defects, warning messages, tyre damage and other safety-relevant irregularities." },
          { kind: "clause", num: "7.4", text: "In the event of a safety-relevant warning message or a significant defect, the Renter must interrupt the journey at a safe place and inform the Lessor without delay. Continuing the journey is permitted only if it is safe and justifiable in the circumstances or has been authorised accordingly." },
          { kind: "clause", num: "7.5", text: "As a rule, the Renter may arrange repairs only with the Lessor's prior consent. This does not apply to necessary immediate measures to avert danger or to prevent significant further damage if it is not possible or not reasonable to contact the Lessor in time. Receipts must be kept. Clause 9 also applies to breakdown and towing services." },
          { kind: "clause", num: "7.6", text: "Tyre and rim damage:" },
          { kind: "p", text: "The Renter must drive the vehicle with due care and, in particular, avoid damage to tyres and rims. This includes, in particular, not approaching or driving over pavement edges and kerbs improperly and passing obstacles with due caution." },
          { kind: "p", text: "If the Renter culpably causes damage to a tyre or rim, in particular a puncture, cut, tear, sidewall damage or other damage, the Renter is liable for the resulting costs to the extent permitted by law." },
          { kind: "p", text: "For tyre damage culpably caused by the Renter, the actual costs of the necessary tyre repair or tyre replacement, including fitting, are charged, but at least CHF 100.00 per damaged tyre. If a repair is not professionally possible or not economically reasonable, the actual costs of the necessary replacement of the damaged tyre or rim, including the necessary fitting, are charged. The replacement of both tyres on the same axle may also be charged if this is required by statutory provisions, the actual condition of the tyres or binding manufacturer specifications." },
          { kind: "p", text: "In addition, to the extent permitted by law, the Renter is liable for any actual and demonstrable loss of rental income caused by the damage and for other directly caused and reasonable costs, insofar as these are not already covered by the amounts above." },
          { kind: "p", text: "Liability requires that the damage can be legally attributed to the Renter. Damage for which the Renter is not responsible, in particular material defects or unavoidable external influences, is excluded." },
          { kind: "clause", num: "7.7", text: "The vehicle must be returned in proper condition. Normal wear and tear in accordance with the contract does not count as damage." },
          { kind: "clause", num: "7.8", text: "In the event of excessive soiling or soiling contrary to the contract, in particular from strong odours, animal hair, traces of smoke, spilled liquids or other soiling that requires professional specialist cleaning, the Lessor may charge the reasonable cleaning costs actually incurred. A minimum flat rate of CHF 150.00 applies only if it was agreed before the contract was concluded and is reasonable and legally permissible in the specific case." },
          { kind: "clause", num: "7.9", text: "The loss or theft of, or damage to, vehicle keys, the vehicle registration document, licence plates, charging cards or other accessories provided must be reported without delay. To the extent permitted by law, the Renter is liable for the necessary and reasonable costs of replacement and restoration insofar as the Renter is responsible for them." },
        ],
      },
      {
        num: "8",
        title: "Insurance, Deductible and Liability",
        blocks: [
          { kind: "clause", num: "8.1", text: "The insurance cover expressly specified in the rental agreement and the relevant insurance terms determine the scope of the cover. Before the contract is concluded, the Lessor informs the Renter of the agreed insurance cover, any deductible and material exclusions." },
          { kind: "clause", num: "8.2", text: "Cover for professional passenger transport or other special types of use exists only if it has actually been agreed and insured for the specific purpose. The Renter may not use the vehicle contrary to the agreed insurance terms." },
          { kind: "clause", num: "8.3", text: "Under the statutory provisions and the validly agreed rental agreement, the Renter is liable in particular for:" },
          {
            kind: "lettered",
            items: [
              "a) damage to the rental vehicle that the Renter has culpably caused or for which the Renter is answerable by law;",
              "b) an agreed insurance deductible, insofar as it is owed under the rental agreement and there is a corresponding loss event for which the Renter is responsible;",
              "c) damage and costs not covered, insofar as they are legally attributable to the Renter;",
              "d) traffic offences, fines and other sanctions, insofar as they were caused by the Renter's conduct and can legally be imposed on the Renter;",
              "e) legitimate claims of third parties, insofar as the Renter is liable for them by law.",
            ],
          },
          { kind: "clause", num: "8.4", text: "Liability for a total loss, loss of use, loss of rental income or other consequential damage exists only insofar as the respective requirements under the law and the contract are met, compensable damage has been proven and no double compensation results." },
          { kind: "clause", num: "8.5", text: "The Lessor's liability is governed by the applicable law. Limitations of liability apply only to the extent permitted by law. In particular, mandatory liability provisions and the statutory rules on intentional or grossly negligent conduct remain reserved." },
          { kind: "clause", num: "8.6", text: "The Renter must take reasonable measures to prevent and limit damage, must not jeopardise the insurance cover and must cooperate in the handling of claims. The reporting and cooperation obligations under clause 9 remain reserved." },
        ],
      },
      {
        num: "9",
        title: "Accident, Breakdown, Reachability and Claims Management",
        blocks: [
          { kind: "clause", num: "9.1", text: "General reachability of the Renter:" },
          { kind: "p", text: "During the rental period, the Renter must be reachable on the mobile phone number they provided and must ensure that their mobile phone is sufficiently charged and able to receive incoming calls and messages." },
          { kind: "p", text: "In the event of a breakdown, an accident, a technical defect or any other problem with the vehicle, the Renter must, insofar as safe and reasonable, set their mobile phone so that calls and messages from the Lessor are reliably noticed. In particular, silent mode and functions such as \"Do not disturb\" must be temporarily deactivated insofar as they impair reachability." },
          { kind: "p", text: "The Renter must respond to the Lessor's attempts to call them back without delay, at the latest within 10 minutes of becoming aware of the call attempt. As a rule, this also applies between 00:00 and 07:00, unless there are legitimate reasons preventing it. The safety of the Renter and of third parties and mandatory statutory provisions always take precedence." },
          { kind: "clause", num: "9.2", text: "Procedure in the event of breakdowns and technical defects:" },
          { kind: "p", text: "In the event of a breakdown, a warning message or a technical defect, the Renter must stop the vehicle at a safe place without delay, take the necessary safety measures and inform the Lessor by telephone. The Lessor's instructions must be followed insofar as they are lawful, reasonable and safe." },
          { kind: "p", text: "If the Lessor cannot be reached by telephone, the Renter must, as a rule, wait at least 15 minutes for a call back, insofar as this is safe and reasonable in the specific situation. During this time, the Renter must also send the Lessor a WhatsApp message asking to be called back, with a short description of the problem and the location of the vehicle." },
          { kind: "p", text: "While waiting, the Renter must remain reachable for a call back and avoid unnecessary phone calls. Insofar as technically possible and reasonable, the Renter must temporarily deactivate an active voicemail and any call forwarding that prevents immediate reachability. The settings required for this depend on the options and instructions of the respective mobile network provider." },
          { kind: "p", text: "The obligation to wait does not apply if immediate measures are necessary to avert danger, to secure the scene of an accident or to prevent significant consequential damage." },
          { kind: "clause", num: "9.3", text: "Special procedure for accidents between 00:00 and 07:00:" },
          { kind: "p", text: "In the event of a road accident between 00:00 and 07:00, the Renter must, in addition to the general reporting and cooperation obligations, follow the steps below insofar as this is safe and possible in the specific situation." },
          { kind: "p", text: "9.3.1 Secure the accident site and draw up an accident report: The Renter must stop the vehicle at a safe place, secure the accident site and initiate any necessary first-aid or emergency measures. If anyone is injured or there is immediate danger, the competent emergency services must be notified without delay. Where possible and safe, the Renter must draw up an accident report together with the other drivers involved. It must record in particular the personal and contact details of those involved, the licence plates, the insurance details and the information needed to document how the accident happened." },
          { kind: "p", text: "9.3.2 Notify the police: For accidents between 00:00 and 07:00, the Renter must, as a rule, contact the police on 117, report the accident and ask how to proceed. Statutory reporting obligations and police instructions must be complied with. If anyone is injured or there is acute danger, the competent emergency services must be alerted without delay." },
          { kind: "p", text: "9.3.3 Photos and preservation of evidence: Immediately after the accident, if this can be done safely, the Renter must take meaningful photos for documentation. They should show in particular: the licence plates of all vehicles involved; the position of the vehicles in relation to each other and their location at the accident site; all visible damage to the rental vehicle and to the vehicles involved; the accident site, relevant traffic signs and other circumstances important for reconstructing how the accident happened. The photos and the accident report must be sent to the Lessor as quickly as possible, preferably by WhatsApp." },
          { kind: "p", text: "9.3.4 Contact the Lessor and breakdown assistance: After securing the accident site and recording the accident as required, the Renter must contact the Lessor again. If the Lessor cannot be reached or breakdown assistance is needed, the Renter must contact the following breakdown assistance:" },
          {
            kind: "list",
            items: [
              "Breakdown assistance telephone number: 058 275 27 27",
              "Insurance/contract number: 6010 6169 937",
              "Contract name: Katamesh",
            ],
          },
          { kind: "p", text: "The Renter must give the breakdown assistance their mobile phone number, the most precise possible location of the vehicle and a short description of the accident and of the condition of the vehicle. The contract number and the contract name must be given to identify the contract. The Renter must follow the instructions of the breakdown assistance. After providing the necessary information, the Renter may end the call and must then wait for assistance at a safe place. The Renter must remain reachable by telephone until the matter has been resolved or help has arrived." },
          { kind: "p", text: "9.3.5 Further measures and documentation: The Renter must keep all relevant information, photos, accident reports, police reference numbers and receipts and make them available to the Lessor without delay on request. Necessary immediate measures to avert danger, to secure the vehicle or to prevent significant consequential damage remain reserved at all times. The Renter must inform the Lessor of any such measures as quickly as possible." },
          { kind: "clause", num: "9.4", text: "Instructing towing services, breakdown services and garages:" },
          { kind: "p", text: "Without the Lessor's prior express approval by telephone or in writing, the Renter may, as a rule, not instruct a towing service, breakdown service or garage in the Lessor's name or at the Lessor's expense." },
          { kind: "p", text: "This restriction does not apply if immediate measures are necessary to avert danger to persons, to secure the vehicle or to prevent significant consequential damage and the Lessor cannot be reached in time despite reasonable attempts to make contact. In such cases, the Renter may arrange the necessary and proportionate measures. The Renter must inform the Lessor as quickly as possible and document the measures taken and the costs incurred." },
          { kind: "p", text: "Insofar as the specific situation allows, the Renter must wait for the Lessor's consent before giving any such instruction. An instruction given without prior consent does not in itself entitle the Renter to have the costs automatically borne by the Lessor." },
          { kind: "clause", num: "9.5", text: "Cost consequences of instructing third parties in breach of contract:" },
          { kind: "p", text: "If, contrary to the above provisions, the Renter arranges services from a towing service, breakdown service or garage without the Lessor's required approval, the Renter must bear the costs caused as a result, insofar as these are based on a breach of contract attributable to the Renter and can be imposed on the Renter under the statutory provisions." },
          { kind: "p", text: "The costs may include in particular towing, call-out, diagnosis, repair and ancillary costs, provided that they were actually incurred, are reasonable and are proven. Whether the Lessor bears costs is governed by the rental agreement, the applicable insurance conditions and the statutory provisions. Charging the same costs or the same damage twice under different items is excluded." },
          { kind: "clause", num: "9.6", text: "Accident, theft and other reporting of damage:" },
          { kind: "p", text: "In the event of an accident, the Renter must secure the accident site, give assistance to injured persons where necessary and alert the ambulance service on the emergency number 144. The police must be notified if this is required by law or necessary in the circumstances. For accidents between 00:00 and 07:00, clause 9.3 also applies." },
          { kind: "p", text: "Where possible and safe, the Renter must secure the details of the persons involved and of witnesses, licence plates, insurance information, photos of the damage and of the accident site, and an accident report." },
          { kind: "p", text: "Without the relevant authority, the Renter may not make any acknowledgement of liability or enter into any binding settlement of claims for damages." },
          { kind: "p", text: "Every accident, damage, theft, loss or other incident relevant to insurance must be reported to the Lessor without delay, if possible within 24 hours of becoming aware of it. If this is not possible or not reasonable because of injuries, official measures or other important reasons, the report must be made without delay once the obstacle has ceased." },
          { kind: "p", text: "The Renter must cooperate fully and truthfully in the investigation and settlement of the damage and provide the documents that are necessary and lawfully requested." },
          { kind: "clause", num: "9.7", text: "Mitigation of damage, cooperation and safety:" },
          { kind: "p", text: "The Renter must take reasonable measures to limit damage and costs and cooperate appropriately in the investigation and handling of a breakdown or claim." },
          { kind: "p", text: "The Renter must keep all available invoices, receipts, photos, accident reports and other relevant documents and make them available to the Lessor without delay on request." },
          { kind: "p", text: "No provision of this clause obliges the Renter to endanger themselves or third parties, to delay necessary first-aid measures or to breach statutory obligations. Statutory reporting obligations, police instructions and mandatory statutory provisions remain reserved." },
        ],
      },
      {
        num: "10",
        title: "Return, Handover Report and Replacement Vehicle",
        blocks: [
          { kind: "clause", num: "10.1", text: "The vehicle must be returned at the agreed place and time with all keys, documents and accessories." },
          { kind: "clause", num: "10.2", text: "On handover and on return, the condition of the vehicle, existing damage, mileage, fuel or charge level and accessories should be recorded in a report. Photos may serve as additional evidence." },
          { kind: "clause", num: "10.3", text: "The Renter must report recognisable damage or discrepancies without delay when taking over the vehicle. A failure to report does not in itself automatically make the Renter liable for damage that cannot be proven to have been caused by the Renter. The statutory rules on the burden of proof remain reserved." },
          { kind: "clause", num: "10.4", text: "New damage found on return must be documented and communicated to the Renter promptly. The Renter's responsibility is governed by the law and the contract." },
          { kind: "clause", num: "10.5", text: "A late return must be notified to the Lessor without delay. An extension is binding only with express consent. In the event of an unjustified late return, the contractual penalty under clause 11 and any further damages owed by law may be claimed. Double compensation for the same damage is excluded." },
          { kind: "clause", num: "10.6", text: "In the event of a breakdown or technical defect not caused by the Renter, the Lessor endeavours to provide an equivalent replacement vehicle, subject to availability. A general entitlement to a replacement vehicle exists only insofar as it has been expressly agreed or is owed by law. The Renter's mandatory statutory rights remain reserved." },
          { kind: "clause", num: "10.7", text: "The return is deemed to have taken place when the vehicle and the items provided have actually been handed over to the Lessor or to a person authorised by the Lessor, or when the Lessor has otherwise confirmed the return." },
        ],
      },
      {
        num: "11",
        title: "Contractual Penalties and Flat-Rate Charges",
        blocks: [
          { kind: "clause", num: "11.1", text: "For the culpable breaches of contract or cases of damage listed below, the following contractual penalties or minimum flat rates may be agreed, provided that the respective statutory and contractual requirements are met:" },
          {
            kind: "table",
            head: ["Breach of contract / case of damage", "Contractual penalty / flat rate"],
            rows: [
              ["Unjustified late return, per calendar day or part thereof", "CHF 100.00"],
              ["Material, culpable false statement of the residential or postal address, insofar as it is relevant to the conclusion of the contract or to the enforcement of claims", "CHF 500.00"],
              ["Leaving the vehicle to a driver who is not authorised", "CHF 500.00"],
              ["Smoking or vaping in the vehicle", "CHF 250.00"],
              ["Intentional or culpable tampering with, removal or unauthorised deactivation of the GPS or tracking system", "CHF 800.00"],
              ["Culpable, material breach of the duty to report an accident", "CHF 500.00"],
              ["Culpably caused tyre or rim damage (e.g. contact with a kerb, cut, tear or improper handling)", "At least CHF 100.00 (plus actual replacement costs & loss of rental income under clause 7.6)"],
            ],
          },
          { kind: "clause", num: "11.2", text: "The contractual penalties apply only if the respective breach of contract and the necessary statutory requirements are present. They do not replace the obligation to end a breach of contract or to return the vehicle." },
          { kind: "clause", num: "11.3", text: "Excessively high contractual penalties may be reduced by the competent court under Art. 163 para. 3 CO." },
          { kind: "clause", num: "11.4", text: "Further proven damages remain reserved within the scope of the applicable law, in particular Art. 161 para. 2 CO. Payments and compensation are credited in such a way that the same damage is not compensated twice." },
        ],
      },
      {
        num: "12",
        title: "Deposit, Payment Default and Fees",
        blocks: [
          { kind: "clause", num: "12.1", text: "The amount, method of payment and timing of the deposit, and the accepted means of payment, are set before the contract is concluded in the individual rental agreement or in the booking terms." },
          { kind: "clause", num: "12.2", text: "The deposit serves to secure legitimate claims arising from the rental relationship. Amounts that are demonstrably owed and due may be set off to the extent permitted by law. The Lessor informs the Renter of any such set-off in a comprehensible manner." },
          { kind: "clause", num: "12.3", text: "If, on return, specific claims or enquiries from authorities (e.g. announced fines, speed camera photos or requests for information about the vehicle's keeper) are apparent that cannot yet be finally quantified, a part of the deposit corresponding to the expected claim may be withheld until the matter has been fully clarified and settled. An undisputed balance is repaid on time." },
          { kind: "clause", num: "12.4", text: "Period for repaying the deposit:" },
          { kind: "p", text: "The deposit is repaid no earlier than 5 and no later than 10 working days after the vehicle has been properly returned. This period serves in particular to check and settle claims that arrive afterwards, such as traffic and regulatory fines (e.g. speeding or red-light offences / speed camera photos), tolls or hidden damage that were not yet known when the vehicle was returned. The actual time it takes for the amount to be credited to the Renter's account or credit card may vary depending on the payment service provider." },
          { kind: "clause", num: "12.5", text: "In the event of payment default, the Lessor may take the reminder, debt collection and debt enforcement steps permitted by law. The following fees may be charged only insofar as they were validly agreed before the contract was concluded and are permitted by law and reasonable in the specific case:" },
          {
            kind: "table",
            head: ["Service", "Fee"],
            rows: [
              ["Processing a traffic fine or an enquiry from an authority", "CHF 20.00"],
              ["Reminder in the event of payment default", "CHF 20.00"],
              ["Internal administrative work in connection with initiating debt enforcement proceedings", "CHF 80.00"],
              ["Organising a necessary recovery of the vehicle", "At least CHF 400.00"],
              ["Storage of the vehicle", "CHF 50.00 per day"],
            ],
          },
          { kind: "clause", num: "12.6", text: "Fees under clause 12.5 are charged only to the extent permitted. Where actual expenses or third-party costs are claimed, they must be substantiated in a verifiable manner on request. Official fees and external costs are distinguished from internal processing fees. Additional external costs may be charged only if they were actually incurred, are legally attributable and are recoverable." },
          { kind: "clause", num: "12.7", text: "Charging the same expense or damage more than once under different fee or damages items is excluded." },
        ],
      },
      {
        num: "13",
        title: "Reclaiming the Vehicle and Legal Action",
        blocks: [
          { kind: "clause", num: "13.1", text: "After the agreed rental period has expired or the rental agreement has been validly terminated, the Renter must return the vehicle on time." },
          { kind: "clause", num: "13.2", text: "If the vehicle is not returned, the Lessor may demand its return and, where necessary, set a reasonable deadline. In urgent cases or where the vehicle is in specific danger, legal measures that are permissible immediately remain reserved." },
          { kind: "clause", num: "13.3", text: "Reasonable and proven costs of recovering the vehicle may be charged to the Renter insofar as the Renter culpably caused the recovery and there is a statutory or validly agreed contractual basis." },
          { kind: "clause", num: "13.4", text: "In the event of significant payment default, unauthorised passing on of the vehicle, tampering with security devices or other material breaches of contract, the Lessor may take suitable, proportionate measures permitted by law to secure and reclaim the vehicle." },
          { kind: "clause", num: "13.5", text: "If the vehicle is not returned, or in the event of other significant breaches of contract, the Lessor may assert its civil-law claims and, where appropriate, inform the competent authorities. A late return or other breach of contract does not automatically constitute a criminal offence." },
        ],
      },
      {
        num: "14",
        title: "GPS Tracking, Vehicle Location and Remote Immobilisation",
        blocks: [
          { kind: "clause", num: "14.1", text: "The vehicle may be equipped with a GPS tracking or fleet management system. Location and vehicle data may be processed for lawful and proportionate purposes, in particular for theft prevention, fleet management, securing the vehicle and the legitimate reclaiming of the vehicle." },
          { kind: "clause", num: "14.2", text: "The Lessor informs the Renter in an accessible privacy policy of the essential aspects of the data processing, in particular the purposes, the categories of data concerned, recipients, the retention period or the criteria for determining it, and the data protection rights available." },
          { kind: "clause", num: "14.3", text: "Location data is retained only for as long, and made accessible only to those persons, as is necessary and legally permissible for the stated purposes. It is disclosed only on a permissible legal basis." },
          { kind: "clause", num: "14.4", text: "The Renter may not tamper with, remove, damage or deactivate without authorisation any tracking or security devices. Malfunctions must be reported to the Lessor without delay." },
          { kind: "clause", num: "14.5", text: "A technical remote immobilisation may be carried out only if it is permitted by law, necessary and proportionate in the specific case. In particular, it may not take place while the vehicle is being driven or in a situation in which it could endanger the driver, occupants or other road users. The vehicle must be reclaimed by lawful means." },
          { kind: "clause", num: "14.6", text: "Liability in connection with tracking, remote immobilisation or reclaiming the vehicle is governed by the applicable law. Mandatory liability provisions remain reserved." },
        ],
      },
      {
        num: "15",
        title: "Identity, Information and Duties to Cooperate",
        blocks: [
          { kind: "clause", num: "15.1", text: "The Renter confirms that their information and the identity documents, driving licences, permits and other documents they have presented are, to the best of their knowledge, complete, truthful and valid." },
          { kind: "clause", num: "15.2", text: "This applies in particular to name, identity, date of birth, residential and postal address, contact details, payment details and the entitlements to drive and permits required for the use of the vehicle." },
          { kind: "clause", num: "15.3", text: "Material changes to the Renter's contact or postal address, and the loss of a required entitlement to drive, must be notified to the Lessor without delay." },
          { kind: "clause", num: "15.4", text: "Where there is objective cause, the Lessor may request current proof insofar as this is necessary for concluding the contract, safely handing over the vehicle or performing the rental relationship and is permissible under data protection law." },
          { kind: "clause", num: "15.5", text: "Intentionally false or misleading information and forged or invalid documents may constitute a material breach of contract. Depending on the facts, they may meet the elements of criminal offences; the assessment is a matter for the competent authorities and courts." },
          { kind: "clause", num: "15.6", text: "Under the statutory provisions, the Renter is liable for proven, legally attributable damage that they culpably cause through false information or the use of incorrect documents. Recoverable loss of rental income, costs of returning the vehicle, and necessary and legally recoverable debt collection and legal costs may be claimed insofar as the statutory requirements are met. Double compensation for the same damage is excluded." },
        ],
      },
      {
        num: "16",
        title: "Professional Passenger Transport and Use of Platforms",
        blocks: [
          { kind: "clause", num: "16.1", text: "Use for professional passenger transport, taxi rides or platform rides is permitted only if it has been expressly agreed in the individual rental agreement." },
          { kind: "clause", num: "16.2", text: "Throughout the rental period, the Renter is responsible for complying with all statutory, regulatory and contractual requirements necessary for the agreed use. This includes in particular the required entitlements to drive (e.g. BPT / Code 121), permits and the applicable regulations for professional passenger transport." },
          { kind: "clause", num: "16.3", text: "The Renter must ensure that the vehicle is registered, equipped and insured accordingly for the agreed purpose. The Lessor does not guarantee admission to a platform or any particular turnover." },
          { kind: "clause", num: "16.4", text: "The Renter shall inform the Lessor without delay of the loss, restriction or withdrawal of any authorisation required for the agreed use." },
        ],
      },
      {
        num: "17",
        title: "Data Protection and Notices",
        blocks: [
          { kind: "clause", num: "17.1", text: "The Lessor processes personal data to handle booking requests, to conclude and perform the rental agreement, to process payments, to fulfil statutory obligations, to handle claims and to safeguard legitimate interests, to the extent permitted by law." },
          { kind: "clause", num: "17.2", text: "Further information, in particular on recipients, retention periods, any disclosures abroad and the rights of data subjects, is set out in the Lessor's privacy policy. It must be easily accessible on the website and made available at the time of booking or vehicle pick-up." },
          { kind: "clause", num: "17.3", text: "Notices in connection with the rental relationship may be sent to the contact addresses given in the rental agreement, provided that the notice in question is legally permissible in this form." },
          { kind: "clause", num: "17.4", text: "The Renter must notify changes to their contact and postal address without delay. Statutory provisions on the receipt of declarations remain reserved." },
        ],
      },
      {
        num: "18",
        title: "Final Provisions",
        blocks: [
          { kind: "clause", num: "18.1", text: "Entire agreement: The individual rental agreement, these GTC and expressly incorporated supplementary agreements constitute the agreement between the parties on the rental relationship concerned. In the event of conflict, individual, expressly agreed contractual provisions take precedence over these GTC." },
          { kind: "clause", num: "18.2", text: "Amendments: Amendments and supplements to the rental agreement must be made in text form, unless a stricter form is required by law or the parties expressly agree on a stricter form." },
          { kind: "clause", num: "18.3", text: "No waiver: The Lessor's temporary failure to exercise a right, or its delayed enforcement of a right, does not constitute a waiver of that right." },
          { kind: "clause", num: "18.4", text: "Force majeure: To the extent permitted by law, neither party is liable for failures of performance directly attributable to extraordinary events that are beyond control and could not be avoided despite reasonable care. The affected party informs the other party without delay where possible and takes reasonable measures to limit the effects. Mandatory statutory rights and liability rules remain reserved." },
          { kind: "clause", num: "18.5", text: "Severability: Should any provision of these GTC be or become invalid or unenforceable in whole or in part, the remaining provisions remain valid to the extent permitted by law. The applicable statutory provisions apply in place of the invalid provision." },
          { kind: "clause", num: "18.6", text: "Governing law: Substantive Swiss law applies, insofar as its application is permitted by law. Mandatory provisions of private international law and mandatory consumer protection provisions remain reserved." },
          { kind: "clause", num: "18.7", text: "Place of jurisdiction Zurich: Insofar as an agreement on jurisdiction is permitted by law, Zurich, Switzerland, is agreed as the place of jurisdiction for all disputes arising from or in connection with the rental relationship. Mandatory statutory places of jurisdiction, in particular for consumer contracts, remain reserved. Where a prior agreement on jurisdiction is not permitted by law, the statutory places of jurisdiction apply." },
        ],
      },
    ],
    closing: {
      lessor: [
        "Lessor: Rigitrade AG",
        "Registered office: Tannenstrasse 16, 8424 Embrach, Switzerland",
        "Business address: Schaffhauserstrasse 550, 8052 Zürich",
      ],
      text: "These GTC apply only insofar as they have been validly incorporated into the respective rental agreement. On concluding the contract, the Renter confirms that the GTC were made accessible to them and that they have agreed to them.",
      signoff: "October 2026",
    },
  },
  fr: {
    title: "Conditions Générales de Location (CGV)",
    updated: "État au 1er octobre 2026 / AK",
    sections: [
      {
        num: "1",
        title: "Champ d'application et intégration au contrat",
        blocks: [
          { kind: "clause", num: "1.1", text: "Les présentes Conditions générales de location (« CGV ») s'appliquent à tous les contrats de location de véhicules conclus par Rigitrade AG (le « Loueur ») avec des personnes physiques et morales (le « Locataire »)." },
          { kind: "clause", num: "1.2", text: "Font partie de la relation de location le contrat individuel de location de véhicule, les présentes CGV ainsi que les conditions complémentaires expressément convenues et les procès-verbaux de remise et de restitution. En cas de contradiction, les dispositions convenues individuellement prévalent, dans la mesure où elles prévoient expressément une règle différente. Les dispositions légales impératives demeurent réservées." },
          { kind: "clause", num: "1.3", text: "Les CGV sont rendues accessibles au Locataire avant ou lors de la conclusion du contrat. Elles font partie du contrat si le Locataire y consent valablement lors de la conclusion du contrat. Pour les réservations en ligne, le consentement doit pouvoir être donné avant la finalisation de la réservation et être documenté de manière vérifiable." },
          { kind: "clause", num: "1.4", text: "Les conditions particulières applicables aux locations touristiques et privées ou au transport professionnel de personnes s'appliquent à titre complémentaire, dans la mesure où elles ont été expressément intégrées au contrat de location." },
          { kind: "clause", num: "1.5", text: "Le Locataire est tenu de respecter le contrat de location, les présentes CGV et les prescriptions légales applicables pendant toute la durée de la location." },
        ],
      },
      {
        num: "2",
        title: "Réservation, conclusion du contrat et durée de location",
        blocks: [
          { kind: "clause", num: "2.1", text: "Le contrat de location individuel fixe notamment le véhicule loué, le début et la fin de la location, le lieu de remise et de restitution, le prix de location, les conditions de paiement, une éventuelle caution, le régime kilométrique ainsi que l'usage convenu." },
          { kind: "clause", num: "2.2", text: "Une demande de réservation ne constitue pas encore un engagement ferme du Loueur, à moins que la réservation n'ait été expressément confirmée ou que le contrat de location n'ait été valablement conclu d'une autre manière." },
          { kind: "clause", num: "2.3", text: "La durée de location commence et prend fin aux moments convenus dans le contrat de location. Une prolongation n'a d'effet obligatoire qu'avec l'accord exprès du Loueur. Toute prolongation unilatérale par le Locataire est exclue." },
          { kind: "clause", num: "2.4", text: "Les annulations, modifications de réservation, restitutions anticipées et éventuels remboursements sont régis par les conditions de réservation communiquées et convenues avant la finalisation de la réservation ainsi que par les dispositions légales impératives." },
          { kind: "clause", num: "2.5", text: "Les prix, prestations supplémentaires, limitations de kilométrage, frais, cautions et franchises sont indiqués de manière transparente avant la conclusion du contrat ou avant la réservation ferme, ou sont fixés dans le contrat de location individuel. Les prestations supplémentaires non convenues ne sont pas dues sur la seule base des présentes CGV." },
        ],
      },
      {
        num: "3",
        title: "Identité, permis de conduire et conducteurs autorisés",
        blocks: [
          { kind: "clause", num: "3.1", text: "Avant la remise du véhicule, le Locataire doit justifier de son identité et présenter un permis de conduire valable en Suisse pour le véhicule concerné. Le Loueur peut exiger à cet effet des documents d'identité appropriés, notamment un passeport ou une carte d'identité officielle." },
          { kind: "clause", num: "3.2", text: "En cas de permis de conduire étranger, le Locataire doit remplir les exigences suisses relatives à sa reconnaissance. Un permis de conduire international ou une traduction doit être présenté lorsque les prescriptions applicables l'exigent. Un permis de conduire international ne remplace pas le permis de conduire national." },
          { kind: "clause", num: "3.3", text: "Le Locataire doit remplir toutes les conditions d'âge minimum, d'expérience de conduite et autres conditions d'admission fixées dans le contrat de location individuel ou dans les conditions communiquées avant la réservation. D'éventuels suppléments ou restrictions pour certaines catégories de conducteurs sont communiqués avant la conclusion du contrat." },
          { kind: "clause", num: "3.4", text: "Le véhicule ne peut être conduit que par le Locataire désigné dans le contrat de location et par les conducteurs supplémentaires expressément autorisés. Les conducteurs supplémentaires doivent avoir été identifiés et leur droit de conduire vérifié avant la remise du véhicule. Le seul accord du Locataire n'autorise aucune autre personne à conduire le véhicule." },
          { kind: "clause", num: "3.5", text: "Le Locataire ne peut ni conduire le véhicule ni le confier à une personne qui n'a pas le droit de conduire, qui n'est pas en état de conduire ou qui n'est pas expressément autorisée." },
          { kind: "clause", num: "3.6", text: "Le Locataire informe le Loueur sans délai du retrait, de la restriction ou de la perte d'un droit de conduire nécessaire à l'utilisation du véhicule." },
          { kind: "clause", num: "3.7", text: "Le Loueur peut refuser la remise du véhicule si des documents requis font défaut, ne sont pas valables ou suscitent des doutes fondés, si les conditions d'admission ne sont pas remplies ou si des circonstances concrètes s'opposent à une utilisation sûre ou conforme au contrat. Les prétentions légales demeurent réservées." },
        ],
      },
      {
        num: "4",
        title: "Utilisation autorisée et interdictions d'utilisation",
        blocks: [
          { kind: "clause", num: "4.1", text: "Le véhicule ne peut être utilisé que pour l'usage convenu dans le contrat de location individuel. Les trajets privés de vacances et de loisirs sont autorisés si le contrat de location prévoit un usage privé." },
          { kind: "clause", num: "4.2", text: "Le transport professionnel de personnes, notamment par l'intermédiaire de plateformes de mise en relation, n'est autorisé que si cet usage est expressément convenu dans le contrat de location et que toutes les conditions légales, administratives et d'assurance sont remplies." },
          { kind: "clause", num: "4.3", text: "Sont notamment interdits :" },
          {
            kind: "lettered",
            items: [
              "a) la mise à disposition du véhicule à des conducteurs non autorisés, la remise non autorisée à des tiers ou la sous-location ainsi que la cession du contrat de location sans l'accord du Loueur ;",
              "b) l'utilisation pour commettre des actes punissables ou à d'autres fins illicites ;",
              "c) la conduite sous l'influence de l'alcool, de stupéfiants ou de toute autre substance rendant inapte à la conduite ;",
              "d) les courses, les manifestations de sport automobile, les cours de conduite, les trajets d'essai ou le transport commercial de marchandises, sauf si cet usage a été expressément convenu ;",
              "e) la surcharge, le dépassement du nombre de places ou des limites de poids autorisés ainsi que toute utilisation contraire aux prescriptions du constructeur ;",
              "f) le fait de fumer et de vapoter dans le véhicule, y compris l'utilisation de cigarettes électroniques ;",
              "g) la manipulation, le retrait, l'endommagement ou la désactivation non autorisée de dispositifs GPS, de localisation ou d'autres dispositifs de sécurité ;",
              "h) l'utilisation du véhicule malgré un défaut reconnaissable affectant la sécurité ou un message d'avertissement pour lequel la poursuite du trajet n'est pas sûre ou pas justifiable ;",
              "i) l'utilisation en dehors de la zone convenue ou l'utilisation transfrontalière contraire au chiffre 5.",
            ],
          },
          { kind: "clause", num: "4.4", text: "Le Locataire doit utiliser le véhicule avec soin, de manière sûre pour la circulation et conformément aux indications du constructeur. Il ne peut procéder à aucune modification technique de sa propre initiative." },
          { kind: "clause", num: "4.5", text: "En cas de violation essentielle du contrat, le Loueur peut mettre fin au contrat de location conformément au droit applicable et exiger la restitution du véhicule. Dans la mesure où cela est approprié et nécessaire, il peut impartir un délai pour remédier à la violation du contrat. En cas de circonstances graves ou urgentes, les mesures immédiates autorisées par la loi demeurent réservées." },
        ],
      },
      {
        num: "5",
        title: "Trajets à l'étranger et restrictions géographiques",
        blocks: [
          { kind: "clause", num: "5.1", text: "Les trajets à l'étranger ne sont autorisés qu'à destination des pays que le Loueur a expressément autorisés pour le véhicule et la location concernés. Les pays autorisés doivent figurer dans le contrat de location, dans la confirmation de réservation ou dans une liste de pays expressément intégrée au contrat." },
          { kind: "clause", num: "5.2", text: "Avant le départ, le Locataire doit vérifier si les documents du véhicule requis, les couvertures d'assurance, les conditions d'entrée et, le cas échéant, les prestations d'assistance en cas de panne sont valables pour les pays prévus. Il doit respecter toutes les prescriptions de circulation et autres prescriptions légales qui y sont applicables." },
          { kind: "clause", num: "5.3", text: "L'entrée dans des pays non autorisés ainsi que toute utilisation qui compromet ou viole la couverture d'assurance sont interdites." },
          { kind: "clause", num: "5.4", text: "Le Locataire prend en charge les péages, vignettes, frais de stationnement et autres redevances routières liées à l'utilisation qui lui sont imputables." },
        ],
      },
      {
        num: "6",
        title: "Prix de location, kilomètres, carburant et recharge",
        blocks: [
          { kind: "clause", num: "6.1", text: "Le prix de location, une éventuelle limitation du kilométrage, le prix des kilomètres supplémentaires, la règle applicable au niveau de carburant ou de charge ainsi que les éventuelles prestations supplémentaires résultent du contrat de location individuel ou des conditions tarifaires expressément convenues avant la réservation." },
          { kind: "clause", num: "6.2", text: "Sauf convention contraire, le Locataire prend en charge les frais de carburant et de recharge encourus pendant la durée de la location. Le véhicule doit être restitué avec le niveau de carburant ou de charge convenu." },
          { kind: "clause", num: "6.3", text: "Le carburant ou la charge manquants, les kilomètres supplémentaires et les prestations supplémentaires convenues ne peuvent être facturés qu'aux prix préalablement communiqués, convenus et autorisés par la loi." },
          { kind: "clause", num: "6.4", text: "Le Locataire est tenu d'utiliser le carburant prescrit pour le véhicule et de respecter les instructions d'utilisation et de recharge du constructeur. Les dommages résultant d'un carburant erroné, d'une utilisation inappropriée ou d'une utilisation contraire au contrat sont à la charge du Locataire dans la mesure où il en répond selon la loi et le contrat." },
          { kind: "clause", num: "6.5", text: "Les frais de stationnement, péages, vignettes, taxes de circulation et autres frais liés à l'utilisation sont à la charge du Locataire dans la mesure où ils surviennent pendant sa durée de location et lui sont juridiquement imputables." },
        ],
      },
      {
        num: "7",
        title: "Entretien, maintenance, dommages et nettoyage",
        blocks: [
          { kind: "clause", num: "7.1", text: "En principe, le Loueur prend en charge les frais des travaux de maintenance réguliers et planifiés, du changement saisonnier habituel des pneus, de l'impôt sur les véhicules à moteur ainsi que de l'assurance responsabilité civile pour véhicules à moteur conclue par lui." },
          { kind: "clause", num: "7.2", text: "Les réparations mécaniques ordinaires et les défauts techniques que le Locataire n'a pas causés par sa faute sont en principe à la charge du Loueur, sous réserve des conditions contractuelles convenues et des droits légaux impératifs." },
          { kind: "clause", num: "7.3", text: "Avant le départ et pendant la durée de la location, le Locataire doit, dans la mesure de ce qui peut raisonnablement être exigé, prêter attention aux défauts manifestes, messages d'avertissement, dommages aux pneus et autres anomalies affectant la sécurité." },
          { kind: "clause", num: "7.4", text: "En cas de message d'avertissement relatif à la sécurité ou de défaut important, le Locataire doit interrompre le trajet dans un endroit sûr et informer le Loueur sans délai. La poursuite du trajet n'est autorisée que si elle est sûre et justifiable au vu des circonstances ou si elle a été autorisée en conséquence." },
          { kind: "clause", num: "7.5", text: "En principe, le Locataire ne peut faire effectuer des réparations qu'avec l'accord préalable du Loueur. Font exception les mesures immédiates nécessaires pour écarter un danger ou éviter un dommage supplémentaire important, lorsqu'il n'est pas possible ou pas raisonnablement exigible de contacter le Loueur à temps. Les justificatifs doivent être conservés. Le chiffre 9 s'applique en outre aux services de dépannage et de remorquage." },
          { kind: "clause", num: "7.6", text: "Dommages aux pneus et aux jantes :" },
          { kind: "p", text: "Le Locataire est tenu de conduire le véhicule avec la diligence requise et notamment d'éviter les dommages aux pneus et aux jantes. Il doit en particulier éviter d'aborder ou de franchir de manière inappropriée les bords de trottoir et les bordures, et franchir les obstacles avec la prudence requise." },
          { kind: "p", text: "Si le Locataire cause fautivement un dommage à un pneu ou à une jante, notamment une crevaison, une coupure, une déchirure, un dommage au flanc ou tout autre dommage, il répond des frais qui en résultent dans la mesure autorisée par la loi." },
          { kind: "p", text: "En cas de dommage à un pneu causé fautivement par le Locataire, les frais effectifs de la réparation ou du remplacement nécessaire du pneu, montage compris, sont facturés, mais au minimum CHF 100.00 par pneu endommagé. Si une réparation n'est pas possible dans les règles de l'art ou n'est pas raisonnablement exigible sur le plan économique, les frais effectifs du remplacement nécessaire du pneu ou de la jante endommagés, montage nécessaire compris, sont facturés. Le remplacement des deux pneus d'un même essieu peut en outre être facturé si des prescriptions légales, l'état effectif des pneus ou des prescriptions contraignantes du constructeur l'exigent." },
          { kind: "p", text: "En outre, dans la mesure autorisée par la loi, le Locataire répond de la perte de location effective et démontrable causée par le dommage ainsi que des autres frais directement causés et appropriés, dans la mesure où ceux-ci ne sont pas déjà couverts par les montants susmentionnés." },
          { kind: "p", text: "La responsabilité suppose que le dommage puisse être juridiquement imputé au Locataire. Les dommages dont le Locataire ne répond pas, notamment les défauts de matériel ou les influences extérieures inévitables, sont exclus." },
          { kind: "clause", num: "7.7", text: "Le véhicule doit être restitué en bon état. L'usure normale conforme au contrat ne constitue pas un dommage." },
          { kind: "clause", num: "7.8", text: "En cas de salissure excessive ou contraire au contrat, notamment due à de fortes odeurs, des poils d'animaux, des traces de fumée, des liquides renversés ou d'autres salissures nécessitant un nettoyage professionnel spécialisé, le Loueur peut facturer les frais de nettoyage appropriés effectivement encourus. Un forfait minimum de CHF 150.00 ne s'applique que s'il a été convenu avant la conclusion du contrat et qu'il est approprié et juridiquement admissible dans le cas concret." },
          { kind: "clause", num: "7.9", text: "La perte, le vol ou l'endommagement des clés du véhicule, du permis de circulation, des plaques de contrôle, des cartes de recharge ou d'autres accessoires mis à disposition doivent être signalés sans délai. Dans la mesure autorisée par la loi, le Locataire répond des frais de remplacement et de remise en état nécessaires et appropriés, dans la mesure où il en est responsable." },
        ],
      },
      {
        num: "8",
        title: "Assurance, franchise et responsabilité",
        blocks: [
          { kind: "clause", num: "8.1", text: "La couverture d'assurance expressément désignée dans le contrat de location et les conditions d'assurance déterminantes définissent l'étendue de la couverture. Avant la conclusion du contrat, le Loueur informe le Locataire de la couverture d'assurance convenue, d'une éventuelle franchise et des exclusions essentielles." },
          { kind: "clause", num: "8.2", text: "Une couverture pour le transport professionnel de personnes ou d'autres types d'utilisation particuliers n'existe que si elle a effectivement été convenue et assurée pour l'usage concret. Le Locataire ne peut pas utiliser le véhicule de manière contraire aux conditions d'assurance convenues." },
          { kind: "clause", num: "8.3", text: "Conformément aux dispositions légales et au contrat de location valablement conclu, le Locataire répond notamment :" },
          {
            kind: "lettered",
            items: [
              "a) des dommages au véhicule loué qu'il a causés par sa faute ou dont il doit répondre en vertu de la loi ;",
              "b) d'une franchise d'assurance convenue, dans la mesure où elle est due selon le contrat de location et qu'il existe un sinistre correspondant imputable au Locataire ;",
              "c) des dommages et frais non couverts, dans la mesure où ils sont juridiquement imputables au Locataire ;",
              "d) des infractions à la circulation routière, amendes et autres sanctions, dans la mesure où elles ont été causées par son comportement et peuvent légalement lui être infligées ;",
              "e) des prétentions légitimes de tiers, dans la mesure où le Locataire en répond en vertu de la loi.",
            ],
          },
          { kind: "clause", num: "8.4", text: "Une responsabilité pour dommage total, perte d'usage, perte de loyers ou autres dommages consécutifs n'existe que dans la mesure où les conditions respectives selon la loi et le contrat sont remplies, qu'un dommage indemnisable est prouvé et qu'il n'en résulte aucune double indemnisation." },
          { kind: "clause", num: "8.5", text: "La responsabilité du Loueur est régie par le droit applicable. Les limitations de responsabilité ne s'appliquent que dans la mesure autorisée par la loi. Demeurent notamment réservées les dispositions impératives en matière de responsabilité et les règles légales relatives au comportement intentionnel ou gravement négligent." },
          { kind: "clause", num: "8.6", text: "Le Locataire doit prendre les mesures raisonnables pour prévenir et limiter les dommages, ne pas compromettre la couverture d'assurance et collaborer au règlement des sinistres. Les obligations de déclaration et de collaboration selon le chiffre 9 demeurent réservées." },
        ],
      },
      {
        num: "9",
        title: "Accident, panne, joignabilité et gestion des sinistres",
        blocks: [
          { kind: "clause", num: "9.1", text: "Joignabilité générale du Locataire :" },
          { kind: "p", text: "Pendant la durée de la location, le Locataire est tenu d'être joignable au numéro de téléphone mobile qu'il a indiqué et de s'assurer que son téléphone mobile est suffisamment chargé et prêt à recevoir les appels et messages entrants." },
          { kind: "p", text: "En cas de panne, d'accident, de défaut technique ou de tout autre problème lié au véhicule, le Locataire doit, dans la mesure où cela est sûr et raisonnablement exigible, régler son téléphone mobile de manière à percevoir de façon fiable les appels et messages du Loueur. Il doit notamment désactiver temporairement le mode silencieux et les fonctions telles que « Ne pas déranger », dans la mesure où elles nuisent à sa joignabilité." },
          { kind: "p", text: "Le Locataire doit répondre sans délai aux tentatives de rappel du Loueur, au plus tard dans les 10 minutes après en avoir pris connaissance. Cela vaut en principe également entre 00:00 et 07:00, à moins que des motifs légitimes ne l'en empêchent. La sécurité du Locataire et des tiers ainsi que les prescriptions légales impératives priment en tout temps." },
          { kind: "clause", num: "9.2", text: "Procédure en cas de panne et de défaut technique :" },
          { kind: "p", text: "En cas de panne, de message d'avertissement ou de défaut technique, le Locataire doit arrêter sans délai le véhicule dans un endroit sûr, prendre les mesures de sécurité nécessaires et informer le Loueur par téléphone. Les instructions du Loueur doivent être suivies dans la mesure où elles sont licites, raisonnablement exigibles et sûres." },
          { kind: "p", text: "Si le Loueur n'est pas joignable par téléphone, le Locataire doit en principe attendre un rappel pendant au moins 15 minutes, dans la mesure où cela est sûr et raisonnablement exigible au vu de la situation concrète. Pendant ce temps, le Locataire doit en outre envoyer au Loueur un message WhatsApp lui demandant de le rappeler, avec une brève description du problème et l'emplacement du véhicule." },
          { kind: "p", text: "Pendant le temps d'attente, le Locataire doit rester joignable pour un rappel et éviter les appels téléphoniques inutiles. Dans la mesure où cela est techniquement possible et raisonnablement exigible, il doit désactiver temporairement une messagerie vocale active ainsi que les renvois d'appel qui empêchent une joignabilité immédiate. Les réglages nécessaires dépendent des possibilités et des instructions de l'opérateur de téléphonie mobile concerné." },
          { kind: "p", text: "L'obligation d'attendre ne s'applique pas lorsque des mesures immédiates sont nécessaires pour écarter un danger, sécuriser le lieu de l'accident ou éviter des dommages consécutifs importants." },
          { kind: "clause", num: "9.3", text: "Procédure particulière en cas d'accident entre 00:00 et 07:00 :" },
          { kind: "p", text: "En cas d'accident de la circulation entre 00:00 et 07:00, le Locataire doit, en plus des obligations générales de déclaration et de collaboration, suivre les étapes ci-après, dans la mesure où cela est sûr et possible au vu de la situation concrète." },
          { kind: "p", text: "9.3.1 Sécuriser le lieu de l'accident et établir un constat : Le Locataire doit arrêter le véhicule dans un endroit sûr, sécuriser le lieu de l'accident et prendre les mesures de premiers secours ou d'urgence nécessaires. En présence de blessés ou de danger immédiat, les services d'urgence compétents doivent être avertis sans délai. Dans la mesure du possible et sans danger, le Locataire doit établir un constat d'accident avec les autres conducteurs impliqués. Celui-ci doit notamment consigner l'identité et les coordonnées des personnes impliquées, les plaques de contrôle, les informations d'assurance ainsi que les informations nécessaires pour documenter le déroulement de l'accident." },
          { kind: "p", text: "9.3.2 Avertir la police : En cas d'accident entre 00:00 et 07:00, le Locataire doit en principe contacter la police au 117, déclarer l'accident et s'informer de la marche à suivre. Les obligations légales de déclaration et les instructions de la police doivent être respectées. En présence de blessés ou de danger aigu, les services d'urgence compétents doivent être alertés sans délai." },
          { kind: "p", text: "9.3.3 Photos et conservation des preuves : Immédiatement après l'accident, si cela est possible sans danger, le Locataire doit prendre des photos probantes à des fins de documentation. Celles-ci doivent notamment montrer : les plaques de contrôle de tous les véhicules impliqués ; la position des véhicules les uns par rapport aux autres et leur emplacement sur le lieu de l'accident ; tous les dommages visibles au véhicule de location et aux véhicules impliqués ; le lieu de l'accident, la signalisation routière pertinente et les autres circonstances importantes pour reconstituer le déroulement de l'accident. Les photos et le constat d'accident doivent être transmis au Loueur le plus rapidement possible, de préférence par WhatsApp." },
          { kind: "p", text: "9.3.4 Contacter le Loueur et l'assistance dépannage : Après avoir sécurisé le lieu de l'accident et effectué le constat nécessaire, le Locataire doit à nouveau contacter le Loueur. Si celui-ci n'est pas joignable ou si une assistance dépannage est nécessaire, le Locataire doit contacter l'assistance dépannage suivante :" },
          {
            kind: "list",
            items: [
              "Numéro de téléphone de l'assistance dépannage : 058 275 27 27",
              "Numéro d'assurance/de contrat : 6010 6169 937",
              "Nom du contrat : Katamesh",
            ],
          },
          { kind: "p", text: "Le Locataire doit communiquer à l'assistance dépannage son numéro de téléphone mobile, l'emplacement le plus précis possible du véhicule ainsi qu'une brève description de l'accident et de l'état du véhicule. Le numéro et le nom du contrat doivent être indiqués pour identifier le contrat. Le Locataire doit suivre les instructions de l'assistance dépannage. Après avoir transmis les informations nécessaires, il peut mettre fin à l'appel et doit ensuite attendre l'assistance dans un endroit sûr. Il doit rester joignable par téléphone jusqu'à ce que l'affaire soit réglée ou que l'aide soit arrivée." },
          { kind: "p", text: "9.3.5 Autres mesures et documentation : Le Locataire doit conserver toutes les informations pertinentes, photos, constats d'accident, numéros de référence de la police et justificatifs et les mettre sans délai à la disposition du Loueur sur demande. Les mesures immédiates nécessaires pour écarter un danger, sécuriser le véhicule ou éviter des dommages consécutifs importants demeurent réservées en tout temps. Le Locataire doit informer le Loueur de telles mesures le plus rapidement possible." },
          { kind: "clause", num: "9.4", text: "Mandat de services de remorquage, de dépannage et de garages :" },
          { kind: "p", text: "Sans l'autorisation préalable expresse du Loueur, donnée par téléphone ou par écrit, le Locataire ne peut en principe mandater aucun service de remorquage, service de dépannage ni garage au nom ou aux frais du Loueur." },
          { kind: "p", text: "Cette restriction ne s'applique pas lorsque des mesures immédiates sont nécessaires pour écarter un danger pour des personnes, sécuriser le véhicule ou éviter des dommages consécutifs importants et que le Loueur n'est pas joignable à temps malgré des tentatives de contact raisonnables. Dans de tels cas, le Locataire peut faire prendre les mesures nécessaires et proportionnées. Il doit en informer le Loueur le plus rapidement possible et documenter les mesures prises ainsi que les frais encourus." },
          { kind: "p", text: "Dans la mesure où la situation concrète le permet, le Locataire doit attendre l'accord du Loueur avant de donner un tel mandat. Un mandat donné sans accord préalable ne fonde pas à lui seul un droit automatique à la prise en charge des frais par le Loueur." },
          { kind: "clause", num: "9.5", text: "Conséquences financières d'un mandat donné à des tiers en violation du contrat :" },
          { kind: "p", text: "Si, contrairement aux dispositions qui précèdent, le Locataire fait appel aux prestations d'un service de remorquage, d'un service de dépannage ou d'un garage sans l'autorisation requise du Loueur, il supporte les frais ainsi causés, dans la mesure où ceux-ci reposent sur une violation du contrat qui lui est imputable et peuvent lui être mis à charge selon les dispositions légales." },
          { kind: "p", text: "Ces frais peuvent notamment comprendre les frais de remorquage, de déplacement, de diagnostic, de réparation et les frais accessoires, pour autant qu'ils aient été effectivement encourus et qu'ils soient appropriés et prouvés. La prise en charge des frais par le Loueur est régie par le contrat de location, les conditions d'assurance applicables et les dispositions légales. Toute double facturation des mêmes frais ou du même dommage sous différents postes est exclue." },
          { kind: "clause", num: "9.6", text: "Accident, vol et autres déclarations de sinistre :" },
          { kind: "p", text: "En cas d'accident, le Locataire doit sécuriser le lieu de l'accident, porter secours aux blessés si nécessaire et alerter les services de sauvetage au numéro d'urgence 144. La police doit être avisée lorsque la loi l'exige ou que les circonstances le rendent nécessaire. Pour les accidents entre 00:00 et 07:00, le chiffre 9.3 s'applique en complément." },
          { kind: "p", text: "Dans la mesure du possible et sans danger, le Locataire doit recueillir les coordonnées des personnes impliquées et des témoins, les plaques de contrôle, les informations d'assurance, des photos des dommages et du lieu de l'accident ainsi qu'un constat d'accident." },
          { kind: "p", text: "Sans y être habilité, le Locataire ne peut faire aucune reconnaissance de responsabilité ni conclure de transaction contraignante portant sur des prétentions en dommages-intérêts." },
          { kind: "p", text: "Tout accident, dommage, vol, perte ou autre événement pertinent pour l'assurance doit être déclaré au Loueur sans délai, si possible dans les 24 heures après en avoir eu connaissance. Si cela n'est pas possible ou pas raisonnablement exigible en raison de blessures, de mesures prises par les autorités ou d'autres motifs importants, la déclaration doit être faite sans délai dès que l'empêchement a cessé." },
          { kind: "p", text: "Le Locataire doit collaborer de manière complète et conforme à la vérité à l'instruction et au règlement du sinistre et fournir les documents nécessaires et légitimement demandés." },
          { kind: "clause", num: "9.7", text: "Limitation du dommage, collaboration et sécurité :" },
          { kind: "p", text: "Le Locataire est tenu de prendre des mesures raisonnables pour limiter les dommages et les frais et de collaborer de manière appropriée à l'examen et au traitement d'une panne ou d'un sinistre." },
          { kind: "p", text: "Le Locataire doit conserver toutes les factures, justificatifs, photos, constats d'accident et autres documents pertinents disponibles et les mettre sans délai à la disposition du Loueur sur demande." },
          { kind: "p", text: "Aucune disposition du présent chiffre n'oblige le Locataire à se mettre en danger ou à mettre des tiers en danger, à retarder les mesures de premiers secours nécessaires ou à violer des obligations légales. Les obligations légales de déclaration, les instructions de la police et les prescriptions légales impératives demeurent réservées." },
        ],
      },
      {
        num: "10",
        title: "Restitution, procès-verbal de remise et véhicule de remplacement",
        blocks: [
          { kind: "clause", num: "10.1", text: "Le véhicule doit être restitué au lieu et au moment convenus avec l'ensemble des clés, documents et accessoires." },
          { kind: "clause", num: "10.2", text: "Lors de la remise et de la restitution, l'état du véhicule, les dommages existants, le kilométrage, le niveau de carburant ou de charge et les accessoires devraient être consignés dans un procès-verbal. Des photos peuvent servir de moyens de preuve complémentaires." },
          { kind: "clause", num: "10.3", text: "Le Locataire doit signaler sans délai les dommages ou écarts reconnaissables lors de la prise en charge du véhicule. L'absence de signalement ne fonde pas à elle seule automatiquement la responsabilité du Locataire pour un dommage dont il ne peut être prouvé qu'il l'a causé. Les règles légales sur le fardeau de la preuve demeurent réservées." },
          { kind: "clause", num: "10.4", text: "Les nouveaux dommages constatés lors de la restitution doivent être documentés et communiqués au Locataire dans les meilleurs délais. La responsabilité du Locataire est régie par la loi et le contrat." },
          { kind: "clause", num: "10.5", text: "Toute restitution tardive doit être communiquée au Loueur sans délai. Une prolongation n'a d'effet obligatoire qu'avec un accord exprès. En cas de restitution tardive injustifiée, la peine conventionnelle selon le chiffre 11 ainsi que des dommages-intérêts supplémentaires dus selon la loi peuvent être réclamés. Une double indemnisation du même dommage est exclue." },
          { kind: "clause", num: "10.6", text: "En cas de panne ou de défaut technique non imputable au Locataire, le Loueur s'efforce, selon les disponibilités, de mettre à disposition un véhicule de remplacement équivalent. Un droit général à un véhicule de remplacement n'existe que s'il a été expressément convenu ou est dû selon la loi. Les droits légaux impératifs du Locataire demeurent réservés." },
          { kind: "clause", num: "10.7", text: "La restitution est réputée effectuée lorsque le véhicule et les objets mis à disposition ont été effectivement remis au Loueur ou à une personne autorisée par lui, ou lorsque le Loueur a confirmé la restitution d'une autre manière." },
        ],
      },
      {
        num: "11",
        title: "Peines conventionnelles et forfaits de frais",
        blocks: [
          { kind: "clause", num: "11.1", text: "Pour les violations fautives du contrat ou les cas de dommage énumérés ci-après, les peines conventionnelles ou forfaits minimaux suivants peuvent être convenus, pour autant que les conditions légales et contractuelles respectives soient remplies :" },
          {
            kind: "table",
            head: ["Violation du contrat / cas de dommage", "Peine conventionnelle / forfait"],
            rows: [
              ["Restitution tardive injustifiée, par jour civil entamé", "CHF 100.00"],
              ["Indication fausse, essentielle et fautive de l'adresse de domicile ou de l'adresse postale, dans la mesure où elle est déterminante pour la conclusion du contrat ou pour faire valoir des prétentions", "CHF 500.00"],
              ["Mise à disposition du véhicule à un conducteur non autorisé", "CHF 500.00"],
              ["Fumer ou vapoter dans le véhicule", "CHF 250.00"],
              ["Manipulation, retrait ou désactivation non autorisée, intentionnels ou fautifs, du système GPS ou de localisation", "CHF 800.00"],
              ["Violation fautive et essentielle de l'obligation de déclarer un accident", "CHF 500.00"],
              ["Dommage à un pneu ou à une jante causé fautivement (p. ex. contact avec une bordure de trottoir, coupure, déchirure ou manipulation inappropriée)", "Au minimum CHF 100.00 (plus les frais de remplacement effectifs et la perte de location selon le ch. 7.6)"],
            ],
          },
          { kind: "clause", num: "11.2", text: "Les peines conventionnelles ne s'appliquent que si la violation du contrat concernée et les conditions légales requises sont réalisées. Elles ne remplacent pas l'obligation de mettre fin à une violation du contrat ou de restituer le véhicule." },
          { kind: "clause", num: "11.3", text: "Les peines conventionnelles excessives peuvent être réduites par le tribunal compétent conformément à l'art. 163 al. 3 CO." },
          { kind: "clause", num: "11.4", text: "La réparation d'un dommage supplémentaire prouvé demeure réservée dans le cadre du droit applicable, notamment de l'art. 161 al. 2 CO. Les paiements et indemnités sont imputés de manière à ce que le même dommage ne soit pas réparé deux fois." },
        ],
      },
      {
        num: "12",
        title: "Caution, retard de paiement et frais",
        blocks: [
          { kind: "clause", num: "12.1", text: "Le montant, le mode et la date de paiement de la caution ainsi que les moyens de paiement acceptés sont fixés avant la conclusion du contrat dans le contrat de location individuel ou dans les conditions de réservation." },
          { kind: "clause", num: "12.2", text: "La caution sert à garantir les créances légitimes découlant de la relation de location. Les montants dont il est prouvé qu'ils sont dus et exigibles peuvent être compensés dans la mesure autorisée par la loi. Le Loueur informe le Locataire de manière compréhensible de telles compensations." },
          { kind: "clause", num: "12.3", text: "Si, lors de la restitution, des prétentions concrètes ou des demandes d'autorités (p. ex. amendes annoncées, photos radar ou demandes de renseignements sur le détenteur) sont reconnaissables mais ne peuvent pas encore être chiffrées définitivement, une partie de la caution correspondant à la créance attendue peut être retenue jusqu'à la clarification et au règlement complets. Un solde non contesté est remboursé dans les délais." },
          { kind: "clause", num: "12.4", text: "Délai de remboursement de la caution :" },
          { kind: "p", text: "La caution est remboursée au plus tôt après 5 et au plus tard dans les 10 jours ouvrables suivant la restitution en bonne et due forme du véhicule. Ce délai sert notamment à vérifier et à régler les créances reçues ultérieurement, telles que les amendes de circulation et d'ordre (p. ex. excès de vitesse ou franchissement d'un feu rouge / photos radar), les péages ou les dommages cachés qui n'étaient pas encore connus au moment de la restitution du véhicule. Le délai effectif de crédit sur le compte ou la carte de crédit du Locataire peut varier selon le prestataire de services de paiement." },
          { kind: "clause", num: "12.5", text: "En cas de retard de paiement, le Loueur peut engager les démarches de rappel, d'encaissement et de poursuite autorisées par la loi. Les frais suivants ne peuvent être perçus que dans la mesure où ils ont été valablement convenus avant la conclusion du contrat et sont autorisés par la loi et appropriés dans le cas concret :" },
          {
            kind: "table",
            head: ["Prestation", "Frais"],
            rows: [
              ["Traitement d'une amende de circulation ou d'une demande d'une autorité", "CHF 20.00"],
              ["Rappel en cas de retard de paiement", "CHF 20.00"],
              ["Charge administrative interne liée à l'introduction d'une poursuite", "CHF 80.00"],
              ["Organisation d'une récupération nécessaire du véhicule", "Au moins CHF 400.00"],
              ["Gardiennage du véhicule", "CHF 50.00 par jour"],
            ],
          },
          { kind: "clause", num: "12.6", text: "Les frais selon le chiffre 12.5 ne sont facturés que dans la mesure admissible. Lorsque des dépenses effectives ou des frais de tiers sont invoqués, ils doivent être justifiés de manière vérifiable sur demande. Les émoluments officiels et les frais externes sont distingués des frais de traitement internes. Des frais externes supplémentaires ne peuvent être facturés que s'ils ont été effectivement encourus et sont juridiquement imputables et indemnisables." },
          { kind: "clause", num: "12.7", text: "Toute facturation multiple de la même dépense ou du même dommage sous différents postes de frais ou de dommages-intérêts est exclue." },
        ],
      },
      {
        num: "13",
        title: "Réclamation du véhicule et démarches juridiques",
        blocks: [
          { kind: "clause", num: "13.1", text: "À l'expiration de la durée de location convenue ou après qu'il a été valablement mis fin au contrat de location, le Locataire doit restituer le véhicule dans les délais." },
          { kind: "clause", num: "13.2", text: "Si la restitution n'a pas lieu, le Loueur peut exiger la restitution et, si nécessaire, impartir un délai raisonnable. En cas d'urgence ou de mise en danger concrète du véhicule, les mesures juridiques immédiatement admissibles demeurent réservées." },
          { kind: "clause", num: "13.3", text: "Les frais appropriés et prouvés de récupération du véhicule peuvent être mis à la charge du Locataire dans la mesure où celui-ci a causé la récupération par sa faute et qu'il existe une base légale ou contractuelle valablement convenue." },
          { kind: "clause", num: "13.4", text: "En cas de retard de paiement important, de remise non autorisée à des tiers, de manipulation de dispositifs de sécurité ou d'autres violations essentielles du contrat, le Loueur peut prendre des mesures appropriées, proportionnées et autorisées par la loi pour sécuriser et réclamer le véhicule." },
          { kind: "clause", num: "13.5", text: "En cas de non-restitution ou d'autres violations importantes du contrat, le Loueur peut faire valoir ses prétentions de droit civil et, le cas échéant, informer les autorités compétentes. Une restitution tardive ou une autre violation du contrat ne constitue pas automatiquement une infraction pénale." },
        ],
      },
      {
        num: "14",
        title: "Suivi GPS, localisation du véhicule et immobilisation à distance",
        blocks: [
          { kind: "clause", num: "14.1", text: "Le véhicule peut être équipé d'un système de localisation GPS ou de gestion de flotte. Les données de localisation et du véhicule peuvent être traitées à des fins licites et proportionnées, notamment pour la prévention du vol, la gestion de flotte, la sécurisation du véhicule et la réclamation légitime du véhicule." },
          { kind: "clause", num: "14.2", text: "Le Loueur informe le Locataire, dans une déclaration de protection des données accessible, des aspects essentiels du traitement des données, notamment des finalités, des catégories de données concernées, des destinataires, de la durée de conservation ou des critères permettant de la déterminer ainsi que des droits disponibles en matière de protection des données." },
          { kind: "clause", num: "14.3", text: "Les données de localisation ne sont conservées que pendant la durée, et ne sont rendues accessibles qu'aux personnes, nécessaires et juridiquement admissibles pour les finalités mentionnées. Elles ne sont communiquées que sur une base juridique admissible." },
          { kind: "clause", num: "14.4", text: "Le Locataire ne peut ni manipuler, ni retirer, ni endommager, ni désactiver sans autorisation les dispositifs de localisation et de sécurité. Les dysfonctionnements doivent être signalés sans délai au Loueur." },
          { kind: "clause", num: "14.5", text: "Une immobilisation technique à distance ne peut être effectuée que si elle est autorisée par la loi, nécessaire et proportionnée dans le cas concret. Elle ne peut notamment pas intervenir pendant la conduite ni dans une situation où elle pourrait mettre en danger le conducteur, les passagers ou d'autres usagers de la route. La réclamation du véhicule doit se faire par des voies légales." },
          { kind: "clause", num: "14.6", text: "La responsabilité en lien avec la localisation, l'immobilisation à distance ou la réclamation du véhicule est régie par le droit applicable. Les dispositions impératives en matière de responsabilité demeurent réservées." },
        ],
      },
      {
        num: "15",
        title: "Identité, informations et obligations de collaborer",
        blocks: [
          { kind: "clause", num: "15.1", text: "Le Locataire confirme que ses informations ainsi que les documents d'identité, permis de conduire, autorisations et autres documents qu'il a présentés sont, au mieux de ses connaissances, complets, véridiques et valables." },
          { kind: "clause", num: "15.2", text: "Cela concerne notamment le nom, l'identité, la date de naissance, l'adresse de domicile et l'adresse postale, les coordonnées, les données de paiement ainsi que les droits de conduire et autorisations nécessaires à l'utilisation du véhicule." },
          { kind: "clause", num: "15.3", text: "Les modifications importantes de ses coordonnées ou de son adresse postale ainsi que la perte d'un droit de conduire nécessaire doivent être communiquées sans délai au Loueur." },
          { kind: "clause", num: "15.4", text: "En cas de motif objectif, le Loueur peut exiger des justificatifs actuels dans la mesure où cela est nécessaire à la conclusion du contrat, à la remise sûre du véhicule ou à l'exécution de la relation de location et admissible au regard de la protection des données." },
          { kind: "clause", num: "15.5", text: "Des indications intentionnellement fausses ou trompeuses ainsi que des documents falsifiés ou non valables peuvent constituer une violation essentielle du contrat. Selon les faits, les éléments constitutifs d'infractions pénales peuvent être réalisés ; leur appréciation incombe aux autorités et tribunaux compétents." },
          { kind: "clause", num: "15.6", text: "Le Locataire répond, conformément aux dispositions légales, des dommages prouvés et juridiquement imputables qu'il cause par sa faute au moyen d'indications fausses ou de l'utilisation de documents inexacts. Les pertes de loyers indemnisables, les frais de rapatriement du véhicule ainsi que les frais d'encaissement et de procédure nécessaires et juridiquement indemnisables peuvent être réclamés dans la mesure où les conditions légales sont remplies. Une double indemnisation du même dommage est exclue." },
        ],
      },
      {
        num: "16",
        title: "Transport professionnel de personnes et utilisation de plateformes",
        blocks: [
          { kind: "clause", num: "16.1", text: "L'utilisation pour le transport professionnel de personnes, les courses de taxi ou les courses via des plateformes n'est autorisée que si elle a été expressément convenue dans le contrat de location individuel." },
          { kind: "clause", num: "16.2", text: "Pendant toute la durée de la location, le Locataire est responsable du respect de toutes les conditions légales, administratives et contractuelles nécessaires à l'usage convenu. Cela comprend notamment les droits de conduire requis (p. ex. BPT / code 121), les autorisations requises ainsi que les prescriptions applicables au transport professionnel de personnes." },
          { kind: "clause", num: "16.3", text: "Le Locataire doit s'assurer que le véhicule est immatriculé, équipé et assuré en conséquence pour l'usage convenu. Le Loueur ne garantit ni l'admission à une plateforme ni un chiffre d'affaires déterminé." },
          { kind: "clause", num: "16.4", text: "Le Locataire informe sans délai le Loueur de la perte, de la restriction ou du retrait d'une autorisation nécessaire à l'usage convenu." },
        ],
      },
      {
        num: "17",
        title: "Protection des données et communications",
        blocks: [
          { kind: "clause", num: "17.1", text: "Le Loueur traite des données personnelles pour traiter les demandes de réservation, conclure et exécuter le contrat de location, traiter les paiements, remplir ses obligations légales, gérer les sinistres et préserver des intérêts légitimes, dans la mesure autorisée par la loi." },
          { kind: "clause", num: "17.2", text: "De plus amples informations, notamment sur les destinataires, les durées de conservation, les éventuelles communications de données à l'étranger et les droits des personnes concernées, figurent dans la déclaration de protection des données du Loueur. Celle-ci doit être facilement accessible sur le site internet et mise à disposition lors de la réservation ou de la prise en charge du véhicule." },
          { kind: "clause", num: "17.3", text: "Les communications en lien avec la relation de location peuvent être envoyées aux adresses de contact indiquées dans le contrat de location, pour autant que la communication concernée soit juridiquement admissible sous cette forme." },
          { kind: "clause", num: "17.4", text: "Le Locataire doit communiquer sans délai les modifications de ses coordonnées et de son adresse postale. Les dispositions légales relatives à la réception des déclarations demeurent réservées." },
        ],
      },
      {
        num: "18",
        title: "Dispositions finales",
        blocks: [
          { kind: "clause", num: "18.1", text: "Intégralité de l'accord : Le contrat de location individuel, les présentes CGV et les conventions complémentaires expressément intégrées constituent l'accord des parties relatif à la relation de location concernée. En cas de contradiction, les dispositions contractuelles individuelles expressément convenues prévalent sur les présentes CGV." },
          { kind: "clause", num: "18.2", text: "Modifications : Les modifications et compléments du contrat de location requièrent la forme textuelle, à moins que la loi ne prescrive une forme plus stricte ou que les parties ne conviennent expressément d'une forme plus stricte." },
          { kind: "clause", num: "18.3", text: "Absence de renonciation : Le non-exercice temporaire ou l'exercice tardif d'un droit par le Loueur ne vaut pas renonciation à ce droit." },
          { kind: "clause", num: "18.4", text: "Force majeure : Dans la mesure autorisée par la loi, aucune partie ne répond des perturbations dans l'exécution des prestations directement imputables à des événements extraordinaires, échappant à tout contrôle et inévitables malgré la diligence raisonnablement exigible. La partie concernée en informe l'autre partie sans délai dans la mesure du possible et prend des mesures raisonnables pour en limiter les effets. Les droits légaux et les règles de responsabilité impératifs demeurent réservés." },
          { kind: "clause", num: "18.5", text: "Clause salvatrice : Si une disposition des présentes CGV est ou devient invalide ou inexécutable en tout ou en partie, les autres dispositions demeurent valables dans la mesure autorisée par la loi. Les dispositions légales applicables remplacent la disposition invalide." },
          { kind: "clause", num: "18.6", text: "Droit applicable : Le droit matériel suisse est applicable, dans la mesure où son application est autorisée par la loi. Les dispositions impératives du droit international privé et les dispositions impératives en matière de protection des consommateurs demeurent réservées." },
          { kind: "clause", num: "18.7", text: "For à Zurich : Dans la mesure où une élection de for est autorisée par la loi, Zurich, Suisse, est convenu comme for pour tous les litiges découlant de la relation de location ou en lien avec celle-ci. Les fors légaux impératifs, notamment pour les contrats conclus avec des consommateurs, demeurent réservés. Lorsqu'une élection de for préalable n'est pas autorisée par la loi, les fors légaux s'appliquent." },
        ],
      },
    ],
    closing: {
      lessor: [
        "Loueur : Rigitrade AG",
        "Siège : Tannenstrasse 16, 8424 Embrach, Suisse",
        "Adresse commerciale : Schaffhauserstrasse 550, 8052 Zürich",
      ],
      text: "Les présentes CGV ne s'appliquent que dans la mesure où elles ont été valablement intégrées au contrat de location concerné. Lors de la conclusion du contrat, le Locataire confirme que les CGV lui ont été rendues accessibles et qu'il les a acceptées.",
      signoff: "Octobre 2026",
    },
  },
};

export default gtc;
