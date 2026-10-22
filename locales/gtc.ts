// The terms, in the three languages a renter can read them in.
//
// The version of 22.10.2026 is the lessor's revision received from Mr Ahmed
// as AGB_22.10.2026.docx. It carries no date of its own, so it is dated by its
// file name. It opens with two lines before Art. 1 (who the lessor is, and that
// the version made accessible before signing applies) and has no closing after
// Art. 18, so the lessor's address and sign-off of 01.10.2026 are gone. Most
// clauses are reworded. In substance: 2.6 (the handover may be refused) and
// 4.3 j) are new; 7.6 is now lettered a)–g) and replaces the minimum of CHF
// 100.00 a tyre with a handling fee of at most CHF 100.– a case; Art. 9 is
// shortened, and 9.3's night-time steps are lettered a)–e) without the
// breakdown service's number, which the handover papers are now to give; the
// table in 11.1 becomes a list of conditional penalties with no tyre row; the
// table in 12.5 becomes a list; and 12.4 pays the deposit back within ten
// working days at the latest, with no earliest day. The German is the docx's
// wording, clause for clause, with the articles' capitals set in title case;
// the English and French were translated here, reusing the earlier versions'
// wording wherever the German did not change.
//
// The version of 01.10.2026 is the lessor's revision received on 18.10.2026 as
// AGB_GTC_18.10.2026.docx, dated "Stand: 01 Oktober 2026 / AK". It added 7.6 on
// tyre and rim damage, rewrote Art. 9 on reachability, breakdowns, accidents at
// night and towing, and paid the deposit back no earlier than five and no later
// than ten working days after the return.
//
// The version of 15.10.2026 is the lessor's own rewrite, received as
// GTC_AGB_DE_15.10.2026.docx: eighteen articles of numbered clauses, which
// replace the twelve articles of the earlier versions outright. The English and
// French cite the Code of Obligations as "CO" and write amounts as the German
// does. Earlier versions (30.07, 06.10, 08.10, 15.10, 16.10 and 01.10.2026) are
// in git history, and their PDFs stay published.
//
// This file is the source and the published PDFs are built from it
// (`pnpm gtc:pdf`), so the website, the PDFs and the contract appendix cannot
// drift apart. Changing the wording is a new version: change GTC_DATE and every
// `updated` line with it, then rebuild the PDFs.

/**
 * One piece of an article. Since 15.10.2026 the terms are written as numbered
 * clauses without headings, so a `clause` carries the number that the contract
 * and the confirmations point at ("15.1"). `lettered` holds the "a) … j)" items
 * under a clause; they carry their own letters, so they are set without
 * bullets. A clause that runs to several paragraphs holds its heading
 * ("Erreichbarkeit:"), followed by `p` paragraphs, `lettered` items or a
 * `list`, all set on the clause text's edge. `sub` and `table` are how earlier
 * versions were written, and every renderer still sets them.
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

export type GtcDocument = {
  title: string;
  updated: string;
  /**
   * What the document says before its first article, one line each as it
   * prints them: since 22.10.2026, who the lessor is and which version of the
   * terms applies.
   */
  intro: string[];
  sections: GtcSection[];
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
export const GTC_DATE = "22.10.2026";

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
    updated: "Stand: 22. Oktober 2026",
    intro: [
      "Vermieterin: Rigitrade AG («Vermieterin»)",
      "Massgebend ist die jeweils vor Vertragsabschluss zugänglich gemachte und wirksam einbezogene Fassung.",
    ],
    sections: [
      {
        num: "1",
        title: "Geltungsbereich und Vertragsbestandteile",
        blocks: [
          { kind: "clause", num: "1.1", text: "Diese Allgemeinen Geschäftsbedingungen («AGB») gelten für Fahrzeugmietverträge zwischen Rigitrade AG («Vermieterin») und der im jeweiligen Mietvertrag bezeichneten natürlichen oder juristischen Person («Mieter»)." },
          { kind: "clause", num: "1.2", text: "Vertragsbestandteile sind, soweit wirksam vereinbart: der individuelle Mietvertrag, diese AGB, die vor Vertragsabschluss zugänglich gemachten Buchungs- und Preisbedingungen, ausdrücklich vereinbarte Zusatzbedingungen sowie Übergabe- und Rückgabeprotokolle. Bei Widersprüchen gehen individuell ausgehandelte und ausdrücklich abweichende Vertragsbestimmungen vor. Zwingendes Recht bleibt vorbehalten." },
          { kind: "clause", num: "1.3", text: "Die AGB müssen dem Mieter vor oder spätestens bei Vertragsabschluss zugänglich gemacht werden. Bei Online-Buchungen muss der Mieter vor Abgabe der verbindlichen Buchungserklärung eine zumutbare Möglichkeit erhalten, die AGB einzusehen und ihnen zuzustimmen. Die Zustimmung und die verwendete Fassung sollen nachvollziehbar dokumentiert werden." },
          { kind: "clause", num: "1.4", text: "Besondere Bedingungen für private oder touristische Mieten, grenzüberschreitende Fahrten sowie berufsmässigen Personentransport gelten nur, soweit sie vor Vertragsabschluss transparent mitgeteilt und wirksam in den Vertrag einbezogen wurden." },
          { kind: "clause", num: "1.5", text: "Zwingende gesetzliche Bestimmungen, insbesondere zwingende Konsumenten- und Datenschutzvorschriften, gehen entgegenstehenden Vertragsbestimmungen vor." },
        ],
      },
      {
        num: "2",
        title: "Buchung, Vertragsabschluss und Mietdauer",
        blocks: [
          { kind: "clause", num: "2.1", text: "Der individuelle Mietvertrag legt insbesondere Fahrzeug, Mietbeginn und Mietende, Übergabe- und Rückgabeort, Mietpreis, Zahlungsbedingungen, Kaution, Kilometerregelung, Nutzungszweck, vereinbarte Versicherung, Selbstbehalt sowie ausdrücklich vereinbarte Zusatzleistungen fest." },
          { kind: "clause", num: "2.2", text: "Eine unverbindliche Anfrage begründet noch keinen Mietvertrag. Ein Vertrag kommt zustande, wenn die Vermieterin die Buchung bestätigt oder die Parteien ihn auf andere Weise rechtswirksam abschliessen." },
          { kind: "clause", num: "2.3", text: "Die Mietdauer richtet sich nach den im Mietvertrag vereinbarten Zeitpunkten. Eine Verlängerung ist nur verbindlich, wenn die Vermieterin sie ausdrücklich bestätigt. Eine Anfrage zur Verlängerung gilt nicht als Zustimmung. Der Mieter muss eine Verlängerung rechtzeitig anfragen und das Fahrzeug bis zur bestätigten Verlängerung zum ursprünglich vereinbarten Zeitpunkt zurückgeben." },
          { kind: "clause", num: "2.4", text: "Stornierungen, Umbuchungen, No-show-Fälle, vorzeitige Rückgaben und Rückerstattungen richten sich nach den dem Mieter vor der verbindlichen Buchung mitgeteilten und wirksam vereinbarten Buchungsbedingungen sowie dem zwingenden Recht. Nicht vorab mitgeteilte Stornierungs- oder Bearbeitungsgebühren werden nicht allein durch diese AGB begründet." },
          { kind: "clause", num: "2.5", text: "Mietpreise, Kautionen, Selbstbehalte, Kilometerbegrenzungen, Mehrkilometerpreise, Treibstoff- oder Ladebedingungen, Zustellungs- und Abholkosten sowie weitere Zusatzleistungen müssen vor Vertragsabschluss transparent ausgewiesen oder im Mietvertrag festgehalten werden. Nicht vereinbarte Zusatzleistungen sind nicht geschuldet." },
          { kind: "clause", num: "2.6", text: "Die Vermieterin darf die Übergabe verweigern, wenn wesentliche Vertragsvoraussetzungen nicht erfüllt sind, erforderliche Zahlungen oder Sicherheiten ausstehen oder konkrete, sachlich begründete Zweifel an Identität, Fahrberechtigung, Zahlungsabwicklung oder sicherer und vertragsgemässer Nutzung bestehen. Gesetzliche Ansprüche bleiben vorbehalten." },
        ],
      },
      {
        num: "3",
        title: "Identität, Führerausweis und zugelassene Fahrer",
        blocks: [
          { kind: "clause", num: "3.1", text: "Vor der Fahrzeugübergabe muss der Mieter seine Identität mit einem gültigen amtlichen Dokument nachweisen und einen für das Fahrzeug gültigen Führerausweis vorlegen. Die Vermieterin darf die für Vertragsabschluss, Fahrberechtigung und berechtigte Forderungsdurchsetzung erforderlichen Angaben erheben und dokumentieren, soweit dies datenschutzrechtlich zulässig und verhältnismässig ist." },
          { kind: "clause", num: "3.2", text: "Bei ausländischen Führerausweisen muss der Mieter die in der Schweiz geltenden Anerkennungsanforderungen erfüllen. Ein internationaler Führerausweis oder eine Übersetzung ist zusätzlich vorzulegen, sofern dies rechtlich erforderlich ist; er ersetzt den nationalen Führerausweis nicht." },
          { kind: "clause", num: "3.3", text: "Mindestalter, Mindestdauer des Führerausweisbesitzes, allfällige Zuschläge und weitere Zulassungsvoraussetzungen müssen vor Vertragsabschluss mitgeteilt und, soweit relevant, im Mietvertrag festgehalten werden." },
          { kind: "clause", num: "3.4", text: "Das Fahrzeug darf nur vom Mieter und von Zusatzfahrern geführt werden, die im Mietvertrag oder in einer von der Vermieterin bestätigten Ergänzung ausdrücklich zugelassen sind. Zusatzfahrer müssen vor der ersten Fahrt identifiziert und hinsichtlich ihrer Fahrberechtigung geprüft werden." },
          { kind: "clause", num: "3.5", text: "Der Mieter darf das Fahrzeug keiner Person überlassen, die nicht zugelassen, nicht fahrberechtigt, fahruntüchtig oder nach anwendbarem Recht vom Führen ausgeschlossen ist. Der Mieter hat zumutbare Massnahmen zu treffen, um eine unbefugte Nutzung zu verhindern." },
          { kind: "clause", num: "3.6", text: "Der Mieter informiert die Vermieterin unverzüglich, wenn eine erforderliche Fahrberechtigung entzogen, eingeschränkt, ungültig oder anderweitig weggefallen ist." },
          { kind: "clause", num: "3.7", text: "Die Vermieterin darf die Übergabe verweigern oder bei bereits erfolgter Übergabe rechtmässige Schutzmassnahmen ergreifen, wenn erforderliche Dokumente fehlen oder begründet zweifelhaft sind, Zulassungsvoraussetzungen nicht erfüllt sind oder konkrete Umstände gegen eine sichere bzw. vertragsgemässe Nutzung sprechen." },
        ],
      },
      {
        num: "4",
        title: "Zulässige Nutzung und Nutzungsverbote",
        blocks: [
          { kind: "clause", num: "4.1", text: "Das Fahrzeug darf nur für den im Mietvertrag vereinbarten Zweck und innerhalb des vereinbarten Gebiets genutzt werden. Private Ferien- und Freizeitfahrten sind zulässig, wenn eine private Nutzung vereinbart wurde." },
          { kind: "clause", num: "4.2", text: "Berufsmässiger Personentransport, Taxi- und Plattformfahrten, gewerbliche Gütertransporte sowie sonstige gewerbliche Nutzungen sind nur erlaubt, wenn die konkrete Nutzung im Mietvertrag ausdrücklich vereinbart und rechtlich sowie versicherungsvertraglich zulässig ist." },
          { kind: "clause", num: "4.3", text: "Ohne ausdrückliche schriftliche oder in Textform dokumentierte Zustimmung der Vermieterin sind insbesondere untersagt:" },
          {
            kind: "lettered",
            items: [
              "a) Überlassung, Weitergabe oder Untervermietung des Fahrzeugs an nicht zugelassene Personen sowie Übertragung des Mietvertrags;",
              "b) Nutzung zu rechtswidrigen Zwecken;",
              "c) Führen unter Alkohol-, Drogen- oder sonstigem fahruntüchtig machendem Einfluss;",
              "d) Rennen, Motorsportveranstaltungen, Fahrschulungen, Wettbewerbe, Testfahrten oder entgeltliche Beförderung bzw. Gütertransporte, sofern nicht ausdrücklich vereinbart;",
              "e) Überladung, Überschreitung der zulässigen Sitzplatz- oder Gewichtsgrenzen oder Nutzung entgegen wesentlichen Herstellervorgaben;",
              "f) Rauchen oder Dampfen im Fahrzeug;",
              "g) Manipulation, Entfernung, Beschädigung oder unbefugte Deaktivierung von GPS-, Ortungs- oder Sicherheitseinrichtungen;",
              "h) Weiterfahrt trotz eines erkennbaren sicherheitsrelevanten Defekts oder einer Warnmeldung, wenn eine Weiterfahrt nicht sicher oder nicht vertretbar ist;",
              "i) grenzüberschreitende Nutzung entgegen Ziffer 5;",
              "j) Nutzung für Abschlepp-, Zug-, Renn- oder sonstige Sonderzwecke, für die das Fahrzeug nicht zugelassen oder ausgerüstet ist.",
            ],
          },
          { kind: "clause", num: "4.4", text: "Der Mieter hat das Fahrzeug sorgfältig, verkehrssicher und gemäss den Bedienungs- und Herstellervorgaben zu benutzen. Technische Veränderungen, Reparaturen oder Einbauten dürfen nur mit Zustimmung der Vermieterin vorgenommen werden, ausgenommen notwendige Sofortmassnahmen nach Ziffer 7.5 und 9." },
          { kind: "clause", num: "4.5", text: "Bei einer wesentlichen Vertragsverletzung darf die Vermieterin nach Massgabe des anwendbaren Rechts die Vertragserfüllung verlangen, den Vertrag beenden und die Rückgabe des Fahrzeugs fordern. Soweit angemessen und rechtlich erforderlich, ist eine Frist zur Behebung zu setzen. Bei schwerwiegenden oder dringlichen Umständen bleiben gesetzlich zulässige sofortige Massnahmen vorbehalten." },
        ],
      },
      {
        num: "5",
        title: "Auslandfahrten und geografische Beschränkungen",
        blocks: [
          { kind: "clause", num: "5.1", text: "Fahrten ins Ausland sind nur in Länder zulässig, die für das konkrete Fahrzeug und Mietverhältnis ausdrücklich freigegeben wurden. Die freigegebenen Länder sind im Mietvertrag, in der Buchungsbestätigung oder in einer vor Vertragsabschluss zugänglich gemachten und einbezogenen Länderliste festzuhalten." },
          { kind: "clause", num: "5.2", text: "Der Mieter muss vor Reiseantritt prüfen, ob Fahrzeugdokumente, Versicherungsdeckung, Einreisevoraussetzungen, Strassenabgaben und allfällige Pannenhilfeleistungen für die geplanten Länder gültig sind. Er hat die jeweils anwendbaren Verkehrs- und sonstigen gesetzlichen Vorschriften einzuhalten." },
          { kind: "clause", num: "5.3", text: "Fahrten in nicht freigegebene Länder oder Nutzungen, die den Versicherungsschutz verletzen oder gefährden, sind untersagt. Eine Zustimmung der Vermieterin erweitert den Versicherungsschutz nur, wenn die Versicherungsdeckung tatsächlich besteht." },
          { kind: "clause", num: "5.4", text: "Der Mieter trägt ihm rechtlich zurechenbare Maut-, Vignetten-, Park-, Umweltzonen- und sonstige nutzungsbedingte Strassengebühren, soweit diese während der Mietdauer entstehen." },
        ],
      },
      {
        num: "6",
        title: "Mietpreis, Kilometer, Treibstoff und Ladung",
        blocks: [
          { kind: "clause", num: "6.1", text: "Mietpreis, Kilometerbegrenzung, Mehrkilometerpreis, Treibstoff- oder Ladezustandsregelung und Zusatzleistungen richten sich nach dem Mietvertrag und den vor Vertragsabschluss wirksam vereinbarten Preisbedingungen." },
          { kind: "clause", num: "6.2", text: "Soweit nichts anderes vereinbart ist, trägt der Mieter die während der Mietdauer anfallenden Treibstoff- und Ladekosten. Das Fahrzeug ist mit dem vereinbarten Treibstoff- bzw. Ladezustand zurückzugeben." },
          { kind: "clause", num: "6.3", text: "Fehlender Treibstoff oder Ladezustand, Mehrkilometer und Zusatzleistungen dürfen nur nach den zuvor transparent mitgeteilten und wirksam vereinbarten Preisen verrechnet werden. Fehlt eine wirksame Preisvereinbarung, können nur gesetzlich geschuldete und nachgewiesene Ansprüche geltend gemacht werden." },
          { kind: "clause", num: "6.4", text: "Der Mieter muss den vorgeschriebenen Treibstoff verwenden und Bedienungs- und Ladehinweise einhalten. Für Schäden aus falschem Treibstoff, Fehlbedienung oder vertragswidriger Nutzung haftet er nur, soweit die gesetzlichen und vertraglichen Voraussetzungen erfüllt sind." },
          { kind: "clause", num: "6.5", text: "Park-, Maut-, Vignetten-, Umweltzonen- und Verkehrsgebühren sowie sonstige nutzungsbedingte Kosten trägt der Mieter, soweit sie während der Mietdauer entstanden, ihm zurechenbar und rechtlich auf ihn überwälzbar sind. Behördliche Bussen werden nicht als eigene Busse der Vermieterin weitergegeben, sondern nach den anwendbaren gesetzlichen Regeln behandelt." },
        ],
      },
      {
        num: "7",
        title: "Unterhalt, Wartung, Schäden, Reifen und Reinigung",
        blocks: [
          { kind: "clause", num: "7.1", text: "Die Vermieterin trägt grundsätzlich die Kosten der regulären planmässigen Wartung, des üblichen saisonalen Reifenwechsels, der Motorfahrzeugsteuer und der von ihr übernommenen Motorfahrzeughaftpflichtversicherung, soweit im Mietvertrag nichts Wirksames und Zulässiges anderes vereinbart ist." },
          { kind: "clause", num: "7.2", text: "Gewöhnliche mechanische Reparaturen und technische Defekte, die der Mieter nicht zu vertreten hat, gehen grundsätzlich zulasten der Vermieterin. Zwingende gesetzliche Rechte bleiben vorbehalten." },
          { kind: "clause", num: "7.3", text: "Der Mieter hat vor Fahrtantritt und während der Mietdauer im zumutbaren Umfang auf offensichtliche Mängel, Warnmeldungen, Reifenschäden und andere sicherheitsrelevante Auffälligkeiten zu achten. Er meldet solche Feststellungen unverzüglich." },
          { kind: "clause", num: "7.4", text: "Bei sicherheitsrelevanten Warnmeldungen oder erheblichen Defekten muss der Mieter an einem sicheren Ort anhalten und die Vermieterin unverzüglich informieren. Eine Weiterfahrt ist nur erlaubt, wenn sie nach den Umständen sicher und vertretbar ist oder entsprechend autorisiert wurde. Anweisungen dürfen nicht befolgt werden, wenn sie Personen gefährden oder rechtswidrig wären." },
          { kind: "clause", num: "7.5", text: "Reparaturen dürfen grundsätzlich nur nach vorheriger Zustimmung der Vermieterin veranlasst werden. Ausgenommen sind erforderliche, verhältnismässige Sofortmassnahmen zur Abwehr einer Gefahr oder zur Vermeidung erheblicher Folgeschäden, wenn eine rechtzeitige Kontaktaufnahme nicht möglich oder nicht zumutbar ist. Belege sind aufzubewahren und der Vermieterin so bald wie möglich zu übermitteln." },
          { kind: "clause", num: "7.6", text: "Reifen- und Felgenschäden" },
          {
            kind: "lettered",
            items: [
              "a) Sorgfaltspflicht: Der Mieter hat das Fahrzeug mit der gebotenen Sorgfalt zu führen und Schäden durch unsachgemässe Handhabung zu vermeiden. Dies gilt insbesondere für das Anfahren oder Überfahren von Bordsteinen, Trottoirkanten und Strassenrändern sowie für vermeidbare Kontakte mit Hindernissen.",
              "b) Haftung des Mieters: Verursacht der Mieter schuldhaft einen Reifen- oder Felgenschaden, insbesondere Schnitt- oder Rissschäden, Flankenschäden oder Schäden durch Felgenkontakte, haftet er im gesetzlich zulässigen Umfang für den tatsächlich entstandenen, erforderlichen und nachgewiesenen Schaden. Allfälliger Versicherungsschutz und vertragliche Haftungsbeschränkungen bleiben vorbehalten.",
              "c) Reparatur und Ersatz: Verrechnet werden dürfen die angemessenen effektiven Kosten einer fachgerechten Reparatur oder – wenn eine Reparatur technisch nicht sicher, nicht fachgerecht möglich oder wirtschaftlich nicht zumutbar ist – des erforderlichen Ersatzes einschliesslich notwendiger Montagekosten. Bei einem Reifenersatz sind Alter, Profil, Zustand und verbleibender Nutzungswert des beschädigten Reifens angemessen zu berücksichtigen. Ein Neuteil darf nicht ohne sachlichen Grund zu einer ungerechtfertigten Bereicherung führen.",
              "d) Ersatz beider Reifen einer Achse: Der Ersatz beider Reifen derselben Achse darf nur verrechnet werden, wenn er aufgrund anwendbarer Vorschriften, verbindlicher Herstellervorgaben oder des konkreten Reifen- und Fahrzeugzustands objektiv erforderlich ist.",
              "e) Bearbeitungsgebühr: Für die notwendige Bearbeitung eines vom Mieter schuldhaft verursachten Reifen- oder Felgenschadens kann zusätzlich eine Bearbeitungsgebühr von höchstens CHF 100.– pro Schadensfall erhoben werden, sofern diese vor Vertragsabschluss transparent vereinbart wurde, rechtlich zulässig ist und im konkreten Fall einen angemessenen, nachvollziehbaren Bearbeitungsaufwand abdeckt. Die Gebühr darf nicht zu einer doppelten Verrechnung bereits abgegoltener Leistungen oder zu einer unverhältnismässigen Belastung des Mieters führen. Zwingende gesetzliche Bestimmungen bleiben vorbehalten.",
              "f) Mietausfall und weitere Schäden: Nachgewiesener Mietausfall und weitere unmittelbare Schäden können zusätzlich geltend gemacht werden, soweit die gesetzlichen Voraussetzungen erfüllt sind, die Höhe nachgewiesen ist und derselbe Schaden nicht bereits anderweitig entschädigt wird.",
              "g) Ausschluss der Haftung: Keine Haftung des Mieters besteht, soweit ihm der Schaden rechtlich nicht zugerechnet werden kann, insbesondere bei einem nicht von ihm verursachten Materialfehler oder einer unvermeidbaren Fremdeinwirkung.",
            ],
          },
          { kind: "clause", num: "7.7", text: "Normale, vertragsgemässe Abnutzung ist kein Schaden. Der Zustand bei Übernahme und Rückgabe soll durch Protokolle und, soweit sinnvoll, datierte Fotos dokumentiert werden." },
          { kind: "clause", num: "7.8", text: "Bei übermässiger oder vertragswidriger Verschmutzung, die über die übliche Reinigung hinaus eine Spezialreinigung erfordert, kann die Vermieterin die tatsächlich angefallenen, angemessenen und nachgewiesenen Reinigungskosten verrechnen. Beispiele sind starke Rauch- oder Geruchsbelastung, erhebliche Tierhaare, Flüssigkeitsverschüttungen oder starke Verschmutzungen. Eine Mindestpauschale von CHF 150 darf nur verlangt werden, wenn sie vor Vertragsabschluss ausdrücklich vereinbart, im konkreten Fall angemessen und rechtlich zulässig ist; andernfalls gelten die nachgewiesenen effektiven Kosten." },
          { kind: "clause", num: "7.9", text: "Verlust, Diebstahl oder Beschädigung von Schlüsseln, Fahrzeugausweis, Kontrollschildern, Ladekarten oder überlassenem Zubehör sind unverzüglich zu melden. Der Mieter haftet für erforderliche, angemessene und nachgewiesene Ersatz- oder Wiederherstellungskosten, soweit er den Verlust oder Schaden rechtlich zu vertreten hat." },
        ],
      },
      {
        num: "8",
        title: "Versicherung, Selbstbehalt und Haftung",
        blocks: [
          { kind: "clause", num: "8.1", text: "Massgeblich sind der im Mietvertrag bezeichnete Versicherungsschutz und die anwendbaren Versicherungsbedingungen. Vor Vertragsabschluss werden dem Mieter der vereinbarte Schutz, ein allfälliger Selbstbehalt und wesentliche Ausschlüsse mitgeteilt. Die Vermieterin kann keine Deckung versprechen, die der Versicherungsvertrag nicht vorsieht." },
          { kind: "clause", num: "8.2", text: "Versicherungsschutz für berufsmässigen Personentransport, Taxi- oder Plattformfahrten, Auslandfahrten oder andere besondere Nutzungen besteht nur, wenn die konkrete Nutzung ausdrücklich vereinbart und tatsächlich versichert ist." },
          { kind: "clause", num: "8.3", text: "Der Mieter haftet nach Gesetz und wirksamem Vertrag insbesondere für:" },
          {
            kind: "lettered",
            items: [
              "a) Schäden am Mietfahrzeug, soweit er sie schuldhaft verursacht oder gesetzlich zu vertreten hat;",
              "b) einen ausdrücklich vereinbarten Selbstbehalt, soweit ein gedecktes oder nach den Vertragsbedingungen selbstbehaltspflichtiges Schadenereignis vorliegt und der Mieter dafür einzustehen hat;",
              "c) nicht gedeckte Schäden und Kosten, soweit diese dem Mieter rechtlich zurechenbar sind;",
              "d) rechtlich auf ihn entfallende Verkehrs- und Nutzungsgebühren sowie Folgen seiner Verkehrsverstösse;",
              "e) berechtigte Ansprüche Dritter, soweit er dafür gesetzlich haftet.",
            ],
          },
          { kind: "clause", num: "8.4", text: "Totalschaden, Wertminderung, Nutzungsausfall, Mietausfall und sonstige Folgeschäden können nur geltend gemacht werden, soweit eine gesetzliche oder wirksame vertragliche Grundlage besteht, ein ersatzfähiger Schaden und dessen Höhe nachgewiesen sind, der Schaden dem Mieter zurechenbar ist und keine doppelte Entschädigung erfolgt. Ein allfälliger Restwert, ersparte Aufwendungen und eine angemessene Anrechnung des Fahrzeugzustands sind zu berücksichtigen, soweit rechtlich erforderlich." },
          { kind: "clause", num: "8.5", text: "Die Haftung der Vermieterin richtet sich nach dem anwendbaren Recht. Ein Ausschluss oder eine Beschränkung der Haftung gilt nur im gesetzlich zulässigen Umfang. Zwingende Haftungsvorschriften, insbesondere die gesetzlichen Regeln zur Haftung für Absicht und grobe Fahrlässigkeit, bleiben vorbehalten." },
          { kind: "clause", num: "8.6", text: "Beide Parteien haben im Rahmen des Zumutbaren zur Vermeidung und Begrenzung von Schäden beizutragen. Der Mieter muss die Vermieterin unverzüglich informieren, zumutbare Schutzmassnahmen treffen, den Versicherungsschutz nicht schuldhaft gefährden und an der Schadenabwicklung angemessen mitwirken." },
        ],
      },
      {
        num: "9",
        title: "Unfall, Panne, Erreichbarkeit und Schadenmanagement",
        blocks: [
          { kind: "clause", num: "9.1", text: "Erreichbarkeit:" },
          { kind: "p", text: "Der Mieter stellt sicher, dass die bei der Buchung angegebene Telefonnummer während der Mietdauer grundsätzlich erreichbar ist und sein Mobiltelefon ausreichend geladen ist. Bei einem Unfall, einer Panne oder einem Fahrzeugproblem hat er Rückrufversuche der Vermieterin so bald wie vernünftigerweise möglich zu beantworten. Soweit sicher und zumutbar, soll er Stumm- oder «Bitte nicht stören»-Funktionen vorübergehend so einstellen, dass dringende Rückrufe wahrgenommen werden können. Eine Rückmeldung innerhalb von 10 Minuten nach Kenntnisnahme eines Rückrufversuchs wird erwartet, soweit dies unter den konkreten Umständen möglich und zumutbar ist; Sicherheit, Notfallmassnahmen, Schlaf, fehlender Empfang und andere berechtigte Hinderungsgründe gehen vor. Diese Erwartung gilt auch zwischen 00:00 und 07:00 Uhr nur im Rahmen dieser Einschränkungen." },
          { kind: "clause", num: "9.2", text: "Pannen und technische Defekte:" },
          { kind: "p", text: "Bei einer Panne, Warnmeldung oder einem technischen Defekt muss der Mieter das Fahrzeug, soweit erforderlich, an einem sicheren Ort anhalten, Warn- und Schutzmassnahmen treffen und die Vermieterin telefonisch informieren. Er hat zumutbare und sichere Anweisungen zu befolgen. Ist die Vermieterin nicht erreichbar, soll er zusätzlich eine Nachricht mit einer kurzen Problembeschreibung und dem Standort senden und auf einen Rückruf warten, soweit dies sicher und zumutbar ist. Eine Wartezeit von 15 Minuten gilt nicht, wenn sofortiges Handeln zur Gefahrenabwehr, zur Sicherung der Unfallstelle oder zur Vermeidung erheblicher Folgeschäden erforderlich ist." },
          { kind: "clause", num: "9.3", text: "Unfälle zwischen 00:00 und 07:00 Uhr:" },
          {
            kind: "lettered",
            items: [
              "a) Der Mieter sichert die Unfallstelle, leistet erforderliche Erste Hilfe und alarmiert bei Verletzten oder unmittelbarer Gefahr unverzüglich die zuständigen Notdienste. Er befolgt gesetzliche Meldepflichten und behördliche Anweisungen.",
              "b) Die Polizei ist zu verständigen, wenn dies gesetzlich vorgeschrieben ist oder die Umstände es erfordern. Für Unfälle zwischen 00:00 und 07:00 Uhr soll der Mieter grundsätzlich die Polizei unter 117 kontaktieren, um das weitere Vorgehen abzuklären, soweit dies unter den Umständen sicher und angemessen ist. Diese Vertragsvorgabe darf keine Notfallmassnahme verzögern und begründet keine Pflicht, entgegen polizeilichen Anweisungen zu handeln.",
              "c) Soweit sicher und möglich, dokumentiert der Mieter Beteiligte, Kontaktdaten, Kontrollschilder, Versicherungsangaben, Zeugen, Unfallhergang und sichtbare Schäden. Er erstellt, soweit möglich, ein Unfallprotokoll und macht aussagekräftige Fotos der Fahrzeuge, Schäden, Positionen und Unfallstelle.",
              "d) Nach Sicherung der Unfallstelle kontaktiert der Mieter die Vermieterin. Ist sie nicht erreichbar oder wird Pannenhilfe benötigt, ist der vom Vermieter für das konkrete Fahrzeug mitgeteilte Pannendienst zu kontaktieren. Die erforderliche Telefonnummer und Vertragsreferenz werden separat in den Übergabeunterlagen oder den fahrzeugspezifischen Notfallinformationen bekanntgegeben.",
              "e) Der Mieter bewahrt relevante Fotos, Protokolle, Polizeireferenznummern und Belege auf und stellt sie der Vermieterin so bald wie möglich zur Verfügung.",
            ],
          },
          { kind: "clause", num: "9.4", text: "Abschleppdienste, Pannendienste und Werkstätten:" },
          { kind: "p", text: "Ohne vorherige Zustimmung der Vermieterin darf der Mieter grundsätzlich keinen Abschleppdienst, Pannendienst oder eine Werkstatt im Namen oder auf Kosten der Vermieterin beauftragen. Ausgenommen sind notwendige und verhältnismässige Sofortmassnahmen zur Abwehr einer Gefahr für Personen, zur Sicherung des Fahrzeugs oder zur Vermeidung erheblicher Folgeschäden, wenn eine rechtzeitige Kontaktaufnahme nicht möglich oder nicht zumutbar ist. Die Vermieterin ist so bald wie möglich zu informieren; Belege und Gründe sind zu dokumentieren." },
          { kind: "clause", num: "9.5", text: "Kosten einer nicht genehmigten Beauftragung:" },
          { kind: "p", text: "Kosten eines ohne erforderliche Freigabe beauftragten Dritten können dem Mieter nur auferlegt werden, soweit die Beauftragung eine ihm zurechenbare Vertragsverletzung darstellt, die Kosten tatsächlich angefallen, erforderlich, angemessen und nachgewiesen sind und eine gesetzliche oder wirksame vertragliche Grundlage besteht. Die blosse fehlende Zustimmung begründet nicht automatisch eine Zahlungspflicht, insbesondere wenn eine notwendige Notfallmassnahme vorlag. Eine doppelte Verrechnung ist ausgeschlossen." },
          { kind: "clause", num: "9.6", text: "Unfall, Diebstahl und sonstige Schadenmeldung:" },
          { kind: "p", text: "Bei einem Unfall sichert der Mieter die Unfallstelle, leistet erforderlichenfalls Erste Hilfe und alarmiert bei Bedarf den Rettungsdienst unter 144. Polizei ist zu verständigen, wenn gesetzlich vorgeschrieben oder aufgrund der Umstände erforderlich. Unfälle, Schäden, Diebstahl, Verlust und sonstige versicherungsrelevante Ereignisse sind der Vermieterin unverzüglich, möglichst innerhalb von 24 Stunden nach Kenntnisnahme, zu melden. Ist dies wegen Verletzungen, behördlicher Massnahmen oder anderer wichtiger Gründe nicht möglich oder unzumutbar, ist die Meldung unverzüglich nach Wegfall des Hindernisses nachzuholen. Der Mieter darf ohne entsprechende Berechtigung kein verbindliches Schuldanerkenntnis abgeben oder Vergleiche über Ansprüche der Vermieterin abschliessen. Er muss bei der Schadenabklärung wahrheitsgemäss und angemessen mitwirken." },
          { kind: "clause", num: "9.7", text: "Schadenminderung und Sicherheit:" },
          { kind: "p", text: "Der Mieter trifft zumutbare Massnahmen zur Begrenzung von Schäden und Kosten und bewahrt verfügbare Belege, Fotos und Unterlagen auf. Keine Bestimmung verpflichtet ihn, sich oder Dritte zu gefährden, notwendige Erste Hilfe zu verzögern oder gesetzliche Pflichten zu verletzen." },
        ],
      },
      {
        num: "10",
        title: "Rückgabe, Protokoll und Ersatzfahrzeug",
        blocks: [
          { kind: "clause", num: "10.1", text: "Das Fahrzeug ist am vereinbarten Ort und zum vereinbarten Zeitpunkt mit sämtlichen Schlüsseln, Dokumenten, Karten und Zubehör zurückzugeben. Der Mieter darf das Fahrzeug nicht unbeaufsichtigt an einem anderen Ort zurücklassen, ausser die Vermieterin hat dies ausdrücklich bestätigt oder eine Notlage lässt keine zumutbare Alternative zu." },
          { kind: "clause", num: "10.2", text: "Bei Übergabe und Rückgabe sollen Zustand, vorhandene Schäden, Kilometerstand, Treibstoff- oder Ladezustand und Zubehör dokumentiert werden. Fotos können ergänzend verwendet werden. Der Mieter soll eine Kopie des Protokolls erhalten oder auf angemessene Weise darauf zugreifen können." },
          { kind: "clause", num: "10.3", text: "Erkennbare Mängel oder Schäden bei Übernahme hat der Mieter möglichst vor Fahrtantritt zu melden und dokumentieren zu lassen. Das Unterlassen einer Meldung begründet allein keine automatische Haftung für einen Schaden, dessen Verursachung durch den Mieter nicht nachgewiesen werden kann. Die gesetzlichen Beweislastregeln bleiben vorbehalten." },
          { kind: "clause", num: "10.4", text: "Neue Schäden, die bei der Rückgabe festgestellt werden, sind möglichst zeitnah zu dokumentieren und dem Mieter mitzuteilen. Soweit eine Prüfung bei der Rückgabe nicht möglich ist, soll die Vermieterin die Feststellungen nach Entdeckung ohne unnötigen Aufschub mitteilen. Die Verantwortlichkeit richtet sich nach Gesetz und Vertrag." },
          { kind: "clause", num: "10.5", text: "Eine verspätete Rückgabe ist der Vermieterin unverzüglich mitzuteilen. Die Verlängerung ist erst nach ausdrücklicher Bestätigung verbindlich. Für eine schuldhafte, unberechtigte verspätete Rückgabe können vereinbarte und rechtlich zulässige Entschädigungen sowie nachgewiesene weitere Schäden geltend gemacht werden. Eine Doppelentschädigung ist ausgeschlossen." },
          { kind: "clause", num: "10.6", text: "Bei einer unverschuldeten Panne oder einem technischen Defekt bemüht sich die Vermieterin, soweit verfügbar und organisatorisch zumutbar, ein Ersatzfahrzeug oder eine andere angemessene Lösung anzubieten. Ein Anspruch auf ein gleichwertiges Ersatzfahrzeug besteht nur, soweit ausdrücklich vereinbart oder gesetzlich geschuldet. Zwingende gesetzliche Rechte bleiben vorbehalten." },
          { kind: "clause", num: "10.7", text: "Die Rückgabe gilt als erfolgt, sobald das Fahrzeug und die überlassenen Gegenstände der Vermieterin oder einer von ihr autorisierten Person tatsächlich übergeben wurden oder die Vermieterin die Rückgabe anderweitig bestätigt hat. Das blosse Abstellen oder Hinterlassen des Fahrzeugs ohne vereinbarte Rückgabeprozedur genügt nicht zwingend." },
        ],
      },
      {
        num: "11",
        title: "Vertragsstrafen und Pauschalen",
        blocks: [
          { kind: "clause", num: "11.1", text: "Eine Vertragsstrafe wird nur geschuldet, wenn sie vor Vertragsabschluss klar, transparent und wirksam vereinbart wurde, der konkret bezeichnete Tatbestand erfüllt ist und die gesetzlichen Voraussetzungen vorliegen. Die nachfolgende Übersicht gilt nur, wenn die jeweilige Position im individuellen Mietvertrag oder in einer vor Vertragsabschluss ausdrücklich einbezogenen Gebührenübersicht aufgeführt ist:" },
          {
            kind: "list",
            items: [
              "Unberechtigt verspätete Rückgabe: CHF 100 pro angefangenem Kalendertag, sofern diese Vertragsstrafe wirksam vereinbart, angesichts der Umstände angemessen und rechtlich durchsetzbar ist. Sie wird nicht automatisch zusätzlich zu einer Entschädigung für denselben Schaden geschuldet.",
              "Wesentliche, schuldhafte Falschangabe zur Wohn- oder Zustelladresse: CHF 500, sofern die Angabe für Vertragsschluss, Fahrzeugüberlassung oder berechtigte Anspruchsdurchsetzung erheblich ist und die Strafe im konkreten Fall angemessen und wirksam vereinbart ist.",
              "Überlassung an einen nicht zugelassenen Fahrer: CHF 500, sofern wirksam vereinbart und im konkreten Fall rechtlich durchsetzbar.",
              "Rauchen oder Dampfen im Fahrzeug: CHF 250, sofern wirksam vereinbart und angemessen; nachgewiesene zusätzliche Reinigungskosten können nur unter Anrechnung einer allfälligen bereits abgegoltenen Position verlangt werden.",
              "Vorsätzliche oder schuldhafte Manipulation, Entfernung oder unbefugte Deaktivierung eines GPS- oder Ortungssystems: CHF 800, sofern wirksam vereinbart und im konkreten Fall angemessen und rechtlich durchsetzbar.",
              "Wesentliche, schuldhafte Verletzung der Unfallmeldepflicht: CHF 500, sofern wirksam vereinbart, die Pflichtverletzung erheblich ist und die Strafe im konkreten Fall angemessen ist.",
            ],
          },
          { kind: "p", text: "Reifen- und Felgenschäden: Es gilt Ziffer 7.6. Eine allfällige Bearbeitungsgebühr richtet sich ausschliesslich nach Ziffer 7.6(e) und darf höchstens den dort genannten Betrag sowie den tatsächlich angefallenen, angemessenen und rechtlich ersatzfähigen Bearbeitungsaufwand abdecken. Sie ist nicht automatisch geschuldet. Eine zusätzliche pauschale Vertragsstrafe von CHF 100.– pro Reifen wird nicht allein durch diese Bestimmung begründet." },
          { kind: "clause", num: "11.2", text: "Die Vertragsstrafe entbindet den Mieter nicht davon, eine Vertragsverletzung zu beenden, das Fahrzeug zurückzugeben oder gesetzliche Mitwirkungspflichten einzuhalten." },
          { kind: "clause", num: "11.3", text: "Übermässig hohe Vertragsstrafen können durch das zuständige Gericht nach Art. 163 Abs. 3 OR herabgesetzt werden." },
          { kind: "clause", num: "11.4", text: "Weitergehender Schadenersatz kann nur verlangt werden, soweit dies gesetzlich zulässig ist, ein zusätzlicher Schaden nachgewiesen wurde und keine doppelte Entschädigung erfolgt. Bereits bezahlte Vertragsstrafen oder Entschädigungen sind bei der Berechnung anzurechnen, soweit sie denselben Schaden abdecken." },
        ],
      },
      {
        num: "12",
        title: "Kaution, Zahlungsrückstand und Gebühren",
        blocks: [
          { kind: "clause", num: "12.1", text: "Höhe, Zahlungsart, Fälligkeit und zulässige Verwendung der Kaution sowie die akzeptierten Zahlungsmittel werden vor Vertragsabschluss im Mietvertrag oder in den Buchungsbedingungen festgelegt." },
          { kind: "clause", num: "12.2", text: "Die Kaution dient der Sicherung berechtigter Forderungen aus dem Mietverhältnis. Die Vermieterin darf nur tatsächlich geschuldete, fällige und rechtlich verrechenbare Forderungen anrechnen und muss die Abzüge nachvollziehbar aufschlüsseln. Zwingende gesetzliche Rechte bleiben vorbehalten." },
          { kind: "clause", num: "12.3", text: "Ist bei Rückgabe ein konkreter Anspruch noch nicht abschliessend bezifferbar, darf nur ein angemessener Teil der Kaution zurückbehalten werden, sofern dafür eine rechtliche Grundlage besteht und der Betrag in einem vernünftigen Verhältnis zur voraussichtlichen Forderung steht. Der unbestrittene und nicht benötigte Rest ist ohne unnötigen Aufschub zurückzuzahlen. Eine blosse abstrakte Möglichkeit künftiger Forderungen rechtfertigt keine unbegrenzte Zurückbehaltung." },
          { kind: "clause", num: "12.4", text: "Die Vermieterin bemüht sich, die Kaution nach ordnungsgemässer Rückgabe und den erforderlichen Prüfungen unverzüglich zurückzuzahlen. Soweit keine konkreten, begründeten offenen Forderungen bestehen, soll die Rückzahlung spätestens innerhalb von 10 Arbeitstagen veranlasst werden. Die tatsächliche Gutschrift kann von der Bank oder dem Zahlungsdienstleister abhängen. Für konkrete, noch nicht bezifferbare Forderungen gilt Ziffer 12.3." },
          { kind: "clause", num: "12.5", text: "Die folgenden Gebühren dürfen nur erhoben werden, wenn sie vor Vertragsabschluss ausdrücklich und transparent vereinbart wurden, im konkreten Fall rechtlich zulässig und angemessen sind und keine zwingenden gesetzlichen Regeln entgegenstehen:" },
          {
            kind: "list",
            items: [
              "Bearbeitung einer Verkehrsbusse oder behördlichen Halteranfrage: CHF 20 pro Vorgang;",
              "Mahnung bei Zahlungsverzug: CHF 20 pro Mahnung, soweit rechtlich zulässig;",
              "interner administrativer Aufwand im Zusammenhang mit einer Betreibung: CHF 80, soweit rechtlich zulässig und angemessen;",
              "Organisation einer erforderlichen Fahrzeugrückholung: mindestens CHF 400 nur, soweit eine wirksame Grundlage besteht und der Betrag im konkreten Fall angemessen ist; tatsächlich angefallene Kosten Dritter können zusätzlich nur verlangt werden, soweit keine Doppelverrechnung erfolgt;",
              "Verwahrung des Fahrzeugs: CHF 50 pro Tag nur, soweit eine wirksame Grundlage besteht und die Gebühr die tatsächlichen, angemessenen und zurechenbaren Kosten nicht unangemessen übersteigt.",
            ],
          },
          { kind: "clause", num: "12.6", text: "Externe Kosten, amtliche Gebühren und interne Bearbeitungsgebühren sind voneinander zu unterscheiden. Auf Nachfrage legt die Vermieterin die Berechnung und vorhandene Belege in angemessenem Umfang offen. Externe Kosten dürfen nur verrechnet werden, wenn sie tatsächlich angefallen, erforderlich, angemessen, rechtlich zurechenbar und ersatzfähig sind." },
          { kind: "clause", num: "12.7", text: "Eine mehrfache Belastung desselben Aufwands oder Schadens unter verschiedenen Gebühren- oder Schadenersatzpositionen ist ausgeschlossen. Gesetzliche Verzugszinsen und tatsächlich geschuldete Inkasso- oder Rechtsverfolgungskosten bleiben vorbehalten, soweit die gesetzlichen Voraussetzungen erfüllt sind." },
        ],
      },
      {
        num: "13",
        title: "Fahrzeugrückforderung und rechtliche Schritte",
        blocks: [
          { kind: "clause", num: "13.1", text: "Nach Ablauf der vereinbarten Mietdauer oder nach wirksamer Beendigung des Mietvertrags muss der Mieter das Fahrzeug fristgerecht zurückgeben." },
          { kind: "clause", num: "13.2", text: "Erfolgt die Rückgabe nicht, darf die Vermieterin die Rückgabe verlangen und, soweit angemessen oder gesetzlich erforderlich, eine Frist setzen. Bei Dringlichkeit oder konkreter Gefährdung des Fahrzeugs bleiben rechtmässige dringliche Massnahmen vorbehalten." },
          { kind: "clause", num: "13.3", text: "Angemessene, erforderliche und nachgewiesene Kosten einer Fahrzeugrückholung können dem Mieter auferlegt werden, soweit er die Rückholung schuldhaft verursacht hat und eine gesetzliche oder wirksame vertragliche Grundlage besteht." },
          { kind: "clause", num: "13.4", text: "Bei erheblichem Zahlungsverzug, unberechtigter Weitergabe, Manipulation von Sicherheitseinrichtungen oder anderen wesentlichen Vertragsverletzungen darf die Vermieterin verhältnismässige und gesetzlich zulässige Massnahmen zur Sicherung und Rückforderung des Fahrzeugs ergreifen. Sie darf dabei keine unzulässige Selbsthilfe anwenden und keine Rechte Dritter verletzen." },
          { kind: "clause", num: "13.5", text: "Bei ausbleibender Rückgabe oder anderen erheblichen Vertragsverletzungen kann die Vermieterin ihre zivilrechtlichen Ansprüche geltend machen und gegebenenfalls die zuständigen Behörden informieren. Eine verspätete Rückgabe oder sonstige Vertragsverletzung stellt nicht automatisch eine Straftat dar; die strafrechtliche Beurteilung obliegt den zuständigen Behörden und Gerichten." },
        ],
      },
      {
        num: "14",
        title: "GPS-Tracking, Fahrzeugortung und Fernstilllegung",
        blocks: [
          { kind: "clause", num: "14.1", text: "Das Fahrzeug kann mit GPS-Ortung oder einem Flottenmanagementsystem ausgestattet sein. Standort- und Fahrzeugdaten dürfen nur auf einer zulässigen Rechtsgrundlage und für festgelegte, legitime und verhältnismässige Zwecke bearbeitet werden, insbesondere zur Diebstahlprävention, Fahrzeugsicherung, Flottenverwaltung, technischen Diagnose oder rechtmässigen Fahrzeugrückforderung." },
          { kind: "clause", num: "14.2", text: "Die Vermieterin stellt vor bzw. bei der Datenerhebung eine zugängliche Datenschutzerklärung bereit, welche die nach geltendem Datenschutzrecht erforderlichen Angaben enthält. Dazu gehören insbesondere Identität und Kontaktangaben der verantwortlichen Stelle, Bearbeitungszwecke, Datenkategorien, Empfänger oder Empfängerkategorien, Aufbewahrungsdauer oder Kriterien, allfällige Auslandbekanntgaben und die Rechte betroffener Personen." },
          { kind: "clause", num: "14.3", text: "Standortdaten werden nur im erforderlichen Umfang und so lange wie notwendig aufbewahrt. Zugriff erhalten nur befugte Personen und Dienstleister. Geeignete technische und organisatorische Sicherheitsmassnahmen sind zu treffen. Weitergaben erfolgen nur auf einer zulässigen Rechtsgrundlage." },
          { kind: "clause", num: "14.4", text: "Der Mieter darf Ortungs- und Sicherheitseinrichtungen weder manipulieren noch entfernen, beschädigen oder unbefugt deaktivieren. Störungen sind der Vermieterin unverzüglich zu melden." },
          { kind: "clause", num: "14.5", text: "Eine technische Fernstilllegung darf nur eingesetzt werden, wenn sie im konkreten Fall rechtlich zulässig, erforderlich und verhältnismässig ist. Sie darf insbesondere nicht während der Fahrt oder in einer Situation erfolgen, in der sie den Fahrer, Insassen oder andere Verkehrsteilnehmer gefährden könnte. Eine Stilllegung darf nicht als unzulässiges Druckmittel zur Eintreibung bestrittener Forderungen verwendet werden. Die Fahrzeugrückforderung hat auf rechtmässigem Weg zu erfolgen." },
          { kind: "clause", num: "14.6", text: "Haftung im Zusammenhang mit Ortung, Fernstilllegung und Fahrzeugrückforderung richtet sich nach dem anwendbaren Recht. Zwingende Haftungsbestimmungen bleiben vorbehalten." },
        ],
      },
      {
        num: "15",
        title: "Identität, Angaben und Mitwirkungspflichten",
        blocks: [
          { kind: "clause", num: "15.1", text: "Der Mieter bestätigt, dass seine Angaben und vorgelegten Identitätsdokumente, Führerausweise, Bewilligungen und sonstigen Unterlagen nach bestem Wissen vollständig, richtig und gültig sind." },
          { kind: "clause", num: "15.2", text: "Dies betrifft insbesondere Name, Identität, Geburtsdatum, Wohn- und Zustelladresse, Kontaktdaten, Zahlungsangaben sowie Fahrberechtigungen und Bewilligungen, die für die vereinbarte Fahrzeugnutzung erforderlich sind." },
          { kind: "clause", num: "15.3", text: "Wesentliche Änderungen von Kontakt- oder Zustellangaben sowie der Wegfall einer erforderlichen Fahrberechtigung sind der Vermieterin unverzüglich mitzuteilen." },
          { kind: "clause", num: "15.4", text: "Bei sachlichem Anlass darf die Vermieterin aktuelle Nachweise verlangen, soweit dies für Vertragsabschluss, sichere Fahrzeugüberlassung, Durchführung des Mietverhältnisses oder berechtigte Anspruchsdurchsetzung erforderlich, verhältnismässig und datenschutzrechtlich zulässig ist." },
          { kind: "clause", num: "15.5", text: "Vorsätzlich falsche oder irreführende Angaben sowie gefälschte oder ungültige Unterlagen können eine wesentliche Vertragsverletzung darstellen. Ob ein strafrechtlich relevanter Sachverhalt vorliegt, beurteilen die zuständigen Behörden und Gerichte." },
          { kind: "clause", num: "15.6", text: "Der Mieter haftet nach den gesetzlichen Bestimmungen für nachgewiesene und rechtlich zurechenbare Schäden, die er schuldhaft durch falsche Angaben oder unrichtige Unterlagen verursacht hat. Ersatzfähige Mietausfälle, Rückführungskosten sowie notwendige Inkasso- und Rechtsverfolgungskosten können nur geltend gemacht werden, soweit sie gesetzlich ersatzfähig, angemessen und nachgewiesen sind. Eine doppelte Entschädigung ist ausgeschlossen." },
        ],
      },
      {
        num: "16",
        title: "Berufsmässiger Personentransport und Plattformnutzung",
        blocks: [
          { kind: "clause", num: "16.1", text: "Berufsmässiger Personentransport, Taxi- oder Plattformfahrten sind nur zulässig, wenn sie im individuellen Mietvertrag ausdrücklich vereinbart wurden." },
          { kind: "clause", num: "16.2", text: "Der Mieter ist dafür verantwortlich, während der gesamten Mietdauer die für die vereinbarte Nutzung geltenden gesetzlichen, behördlichen und vertraglichen Voraussetzungen einzuhalten. Dazu gehören insbesondere erforderliche Fahrberechtigungen, Bewilligungen und anwendbare Vorschriften für den berufsmässigen Personentransport." },
          { kind: "clause", num: "16.3", text: "Der Mieter darf das Fahrzeug nur für den vereinbarten Zweck einsetzen und muss sicherstellen, dass Fahrzeugzulassung, Ausrüstung und tatsächlicher Versicherungsschutz die Nutzung erlauben. Die Vermieterin garantiert weder eine Zulassung durch eine Plattform noch einen bestimmten Umsatz, eine bestimmte Anzahl Aufträge oder eine ununterbrochene Verfügbarkeit des Fahrzeugs." },
          { kind: "clause", num: "16.4", text: "Der Mieter informiert die Vermieterin unverzüglich über den Wegfall, die Einschränkung oder den Entzug einer für die vereinbarte Nutzung erforderlichen Berechtigung. Die Vermieterin darf bei Wegfall einer wesentlichen Voraussetzung die weitere Nutzung untersagen und nach Massgabe des anwendbaren Rechts die Rückgabe verlangen." },
        ],
      },
      {
        num: "17",
        title: "Datenschutz und Mitteilungen",
        blocks: [
          { kind: "clause", num: "17.1", text: "Die Vermieterin bearbeitet Personendaten zur Bearbeitung von Anfragen, zum Abschluss und zur Durchführung des Mietvertrags, zur Zahlungsabwicklung, zur Erfüllung gesetzlicher Pflichten, zur Schadenbearbeitung, zur Verwaltung und Sicherung der Fahrzeuge sowie zur Wahrung berechtigter Interessen im gesetzlich zulässigen Umfang." },
          { kind: "clause", num: "17.2", text: "Einzelheiten zur Bearbeitung von Personendaten, insbesondere zu Empfängern, Aufbewahrungsfristen, Auslandbekanntgaben, GPS- und Standortdaten sowie den Rechten betroffener Personen, ergeben sich aus der separaten Datenschutzerklärung. Diese ist leicht zugänglich und muss vor bzw. bei der Datenerhebung in angemessener Weise verfügbar sein. Diese AGB ersetzen die Datenschutzerklärung nicht." },
          { kind: "clause", num: "17.3", text: "Mitteilungen zum Mietverhältnis können an die im Mietvertrag angegebenen Post- und elektronischen Kontaktadressen gesendet werden, soweit die jeweilige Mitteilung rechtlich in dieser Form zulässig ist. Für rechtlich formgebundene Erklärungen bleiben die gesetzlichen Formvorschriften vorbehalten." },
          { kind: "clause", num: "17.4", text: "Der Mieter hat wesentliche Änderungen seiner Kontakt- und Zustelladresse unverzüglich mitzuteilen. Die Vermieterin darf notwendige Mitteilungen an die zuletzt wirksam bekannt gegebene Adresse senden, soweit dies gesetzlich zulässig ist; zwingende Regeln zum Zugang von Erklärungen bleiben vorbehalten." },
        ],
      },
      {
        num: "18",
        title: "Schlussbestimmungen",
        blocks: [
          { kind: "clause", num: "18.1", text: "Gesamte Vereinbarung:" },
          { kind: "p", text: "Der individuelle Mietvertrag, diese AGB und ausdrücklich einbezogene Zusatzvereinbarungen bilden die Vereinbarung der Parteien über das betreffende Mietverhältnis. Individuell ausgehandelte und ausdrücklich abweichende Bestimmungen gehen diesen AGB vor." },
          { kind: "clause", num: "18.2", text: "Änderungen:" },
          { kind: "p", text: "Änderungen und Ergänzungen bedürfen der Textform, soweit nicht das Gesetz eine strengere Form verlangt oder die Parteien wirksam eine strengere Form vereinbart haben. Gesetzliche Anforderungen an Vertragsänderungen und an den Nachweis einer Vereinbarung bleiben vorbehalten." },
          { kind: "clause", num: "18.3", text: "Kein Rechtsverzicht:" },
          { kind: "p", text: "Die vorübergehende Nichtausübung oder verspätete Durchsetzung eines Rechts gilt nicht ohne Weiteres als Verzicht auf dieses Recht." },
          { kind: "clause", num: "18.4", text: "Höhere Gewalt:" },
          { kind: "p", text: "Keine Partei haftet im gesetzlich zulässigen Umfang für Leistungsstörungen, die unmittelbar auf aussergewöhnliche, nicht beherrschbare und trotz zumutbarer Sorgfalt nicht vermeidbare Ereignisse zurückzuführen sind. Die betroffene Partei informiert die andere Partei, soweit möglich, unverzüglich und trifft zumutbare Massnahmen zur Begrenzung der Auswirkungen. Zwingende gesetzliche Rechte und Haftungsregeln bleiben vorbehalten." },
          { kind: "clause", num: "18.5", text: "Teilunwirksamkeit:" },
          { kind: "p", text: "Sollte eine Bestimmung dieser AGB ganz oder teilweise unwirksam oder undurchsetzbar sein oder werden, bleiben die übrigen Bestimmungen im gesetzlich zulässigen Umfang bestehen. Anstelle der unwirksamen Bestimmung gelten die anwendbaren gesetzlichen Vorschriften. Diese Klausel begründet keine automatische Ersetzung durch eine wirtschaftlich möglichst ähnliche Bestimmung." },
          { kind: "clause", num: "18.6", text: "Anwendbares Recht:" },
          { kind: "p", text: "Es gilt schweizerisches materielles Recht, soweit dessen Anwendung gesetzlich zulässig ist. Zwingende Bestimmungen des internationalen Privatrechts und zwingende Schutzvorschriften, insbesondere für Konsumenten, bleiben vorbehalten." },
          { kind: "clause", num: "18.7", text: "Gerichtsstand Zürich:" },
          { kind: "p", text: "Soweit eine Gerichtsstandsvereinbarung gesetzlich zulässig ist, wird Zürich, Schweiz, als Gerichtsstand für Streitigkeiten aus oder im Zusammenhang mit dem Mietverhältnis vereinbart. Zwingende gesetzliche Gerichtsstände und Einschränkungen bei Konsumentenverträgen bleiben vorbehalten. Soweit eine vorgängige Gerichtsstandsvereinbarung nicht zulässig oder nicht wirksam ist, gelten die gesetzlichen Gerichtsstände." },
        ],
      },
    ],
  },
  en: {
    title: "General Terms and Conditions (GTC)",
    updated: "As of 22 October 2026",
    intro: [
      "Lessor: Rigitrade AG (the \"Lessor\")",
      "The version made accessible and validly incorporated before the contract was concluded is authoritative in each case.",
    ],
    sections: [
      {
        num: "1",
        title: "Scope and Components of the Contract",
        blocks: [
          { kind: "clause", num: "1.1", text: "These General Terms and Conditions (\"GTC\") apply to vehicle rental agreements between Rigitrade AG (the \"Lessor\") and the natural person or legal entity named in the respective rental agreement (the \"Renter\")." },
          { kind: "clause", num: "1.2", text: "The components of the contract, insofar as validly agreed, are: the individual rental agreement, these GTC, the booking and pricing terms made accessible before the contract was concluded, expressly agreed additional terms, and the handover and return reports. In the event of conflict, individually negotiated and expressly deviating contractual provisions take precedence. Mandatory law remains reserved." },
          { kind: "clause", num: "1.3", text: "The GTC must be made accessible to the Renter before or at the latest upon conclusion of the contract. For online bookings, the Renter must be given a reasonable opportunity to view and agree to the GTC before submitting the binding booking declaration. The consent and the version used should be documented in a verifiable manner." },
          { kind: "clause", num: "1.4", text: "Special terms for private or tourist rentals, cross-border trips and professional passenger transport apply only insofar as they were communicated transparently before the contract was concluded and validly incorporated into the contract." },
          { kind: "clause", num: "1.5", text: "Mandatory statutory provisions, in particular mandatory consumer protection and data protection provisions, take precedence over conflicting contractual provisions." },
        ],
      },
      {
        num: "2",
        title: "Booking, Conclusion of the Contract and Rental Period",
        blocks: [
          { kind: "clause", num: "2.1", text: "The individual rental agreement specifies in particular the vehicle, the start and end of the rental, the place of handover and return, the rental price, the payment terms, the deposit, the mileage arrangement, the purpose of use, the agreed insurance, the deductible and any expressly agreed additional services." },
          { kind: "clause", num: "2.2", text: "A non-binding enquiry does not yet establish a rental agreement. A contract is concluded when the Lessor confirms the booking or the parties conclude it with legal effect in another way." },
          { kind: "clause", num: "2.3", text: "The rental period is governed by the times agreed in the rental agreement. An extension is binding only if the Lessor expressly confirms it. A request for an extension does not count as consent. The Renter must request an extension in good time and, until the extension is confirmed, return the vehicle at the originally agreed time." },
          { kind: "clause", num: "2.4", text: "Cancellations, changes to bookings, no-shows, early returns and refunds are governed by the booking terms communicated to the Renter and validly agreed before the binding booking, and by mandatory law. Cancellation or processing fees not communicated in advance are not established by these GTC alone." },
          { kind: "clause", num: "2.5", text: "Rental prices, deposits, deductibles, mileage limits, prices for additional kilometres, fuel or charging terms, delivery and collection costs and other additional services must be shown transparently before the contract is concluded or set out in the rental agreement. Additional services that have not been agreed are not owed." },
          { kind: "clause", num: "2.6", text: "The Lessor may refuse the handover if essential contractual requirements are not met, required payments or securities are outstanding, or there are specific, objectively justified doubts about identity, entitlement to drive, payment processing or safe use in accordance with the contract. Statutory claims remain reserved." },
        ],
      },
      {
        num: "3",
        title: "Identity, Driving Licence and Authorised Drivers",
        blocks: [
          { kind: "clause", num: "3.1", text: "Before the vehicle is handed over, the Renter must prove their identity with a valid official document and present a driving licence valid for the vehicle. The Lessor may collect and document the information required for concluding the contract, for the entitlement to drive and for the legitimate enforcement of claims, insofar as this is permissible under data protection law and proportionate." },
          { kind: "clause", num: "3.2", text: "For foreign driving licences, the Renter must meet the recognition requirements applicable in Switzerland. An international driving permit or a translation must also be presented where this is legally required; it does not replace the national driving licence." },
          { kind: "clause", num: "3.3", text: "The minimum age, the minimum period of holding a driving licence, any surcharges and other eligibility requirements must be communicated before the contract is concluded and, where relevant, set out in the rental agreement." },
          { kind: "clause", num: "3.4", text: "The vehicle may be driven only by the Renter and by additional drivers who are expressly authorised in the rental agreement or in a supplement confirmed by the Lessor. Additional drivers must be identified, and their entitlement to drive checked, before the first journey." },
          { kind: "clause", num: "3.5", text: "The Renter may not leave the vehicle to any person who is not authorised, not entitled to drive, not fit to drive or barred from driving under the applicable law. The Renter must take reasonable measures to prevent unauthorised use." },
          { kind: "clause", num: "3.6", text: "The Renter shall inform the Lessor without delay if a required entitlement to drive has been withdrawn, restricted or invalidated or has otherwise ceased to exist." },
          { kind: "clause", num: "3.7", text: "The Lessor may refuse the handover or, if the vehicle has already been handed over, take lawful protective measures if required documents are missing or subject to well-founded doubt, eligibility requirements are not met or specific circumstances indicate that the vehicle would not be used safely or in accordance with the contract." },
        ],
      },
      {
        num: "4",
        title: "Permitted Use and Prohibited Uses",
        blocks: [
          { kind: "clause", num: "4.1", text: "The vehicle may be used only for the purpose agreed in the rental agreement and within the agreed area. Private holiday and leisure trips are permitted if private use has been agreed." },
          { kind: "clause", num: "4.2", text: "Professional passenger transport, taxi and platform rides, the commercial transport of goods and other commercial uses are permitted only if the specific use is expressly agreed in the rental agreement and is permissible under the law and the insurance contract." },
          { kind: "clause", num: "4.3", text: "Without the Lessor's express consent, given in writing or documented in text form, the following are prohibited in particular:" },
          {
            kind: "lettered",
            items: [
              "a) leaving, passing on or subletting the vehicle to persons who are not authorised, and transferring the rental agreement;",
              "b) use for unlawful purposes;",
              "c) driving under the influence of alcohol, drugs or any other substance that impairs fitness to drive;",
              "d) races, motorsport events, driver training, competitions, test drives or transporting passengers or goods for payment, unless expressly agreed;",
              "e) overloading, exceeding the permitted seating or weight limits, or use contrary to essential manufacturer specifications;",
              "f) smoking or vaping in the vehicle;",
              "g) tampering with, removing, damaging or deactivating without authorisation any GPS, tracking or security devices;",
              "h) continuing to drive despite a recognisable safety-relevant defect or a warning message, if continuing is not safe or not justifiable;",
              "i) cross-border use contrary to clause 5;",
              "j) use for towing, pulling, racing or other special purposes for which the vehicle is not approved or equipped.",
            ],
          },
          { kind: "clause", num: "4.4", text: "The Renter shall use the vehicle with care, safely and in accordance with the operating instructions and manufacturer specifications. Technical modifications, repairs or installations may be made only with the Lessor's consent, except for necessary immediate measures under clauses 7.5 and 9." },
          { kind: "clause", num: "4.5", text: "In the event of a material breach of contract, the Lessor may, in accordance with the applicable law, demand performance of the contract, terminate the contract and demand the return of the vehicle. Where appropriate and legally required, a deadline for remedying the breach must be set. In serious or urgent circumstances, immediate measures permitted by law remain reserved." },
        ],
      },
      {
        num: "5",
        title: "Trips Abroad and Geographical Restrictions",
        blocks: [
          { kind: "clause", num: "5.1", text: "Trips abroad are permitted only to countries that have been expressly approved for the specific vehicle and rental. The approved countries must be recorded in the rental agreement, in the booking confirmation or in a list of countries made accessible before the contract was concluded and incorporated into it." },
          { kind: "clause", num: "5.2", text: "Before setting off, the Renter must check whether the vehicle documents, insurance cover, entry requirements, road charges and any breakdown assistance services are valid for the countries planned. The Renter must comply with the traffic and other statutory regulations applicable in each case." },
          { kind: "clause", num: "5.3", text: "Trips to countries that have not been approved, and uses that breach or jeopardise the insurance cover, are prohibited. The Lessor's consent extends the insurance cover only if the insurance cover actually exists." },
          { kind: "clause", num: "5.4", text: "The Renter bears the tolls, vignettes, parking fees, environmental-zone charges and other use-related road charges legally attributable to the Renter, insofar as they arise during the rental period." },
        ],
      },
      {
        num: "6",
        title: "Rental Price, Mileage, Fuel and Charging",
        blocks: [
          { kind: "clause", num: "6.1", text: "The rental price, the mileage limit, the price of additional kilometres, the arrangement on fuel or charge level and additional services are governed by the rental agreement and by the pricing terms validly agreed before the contract was concluded." },
          { kind: "clause", num: "6.2", text: "Unless otherwise agreed, the Renter bears the fuel and charging costs incurred during the rental period. The vehicle must be returned with the agreed fuel or charge level." },
          { kind: "clause", num: "6.3", text: "Missing fuel or charge, additional kilometres and additional services may be charged only at the prices previously communicated transparently and validly agreed. If there is no valid price agreement, only claims that are owed by law and proven may be asserted." },
          { kind: "clause", num: "6.4", text: "The Renter must use the prescribed fuel and follow the operating and charging instructions. The Renter is liable for damage resulting from the wrong fuel, incorrect operation or use contrary to the contract only insofar as the statutory and contractual requirements are met." },
          { kind: "clause", num: "6.5", text: "Parking fees, tolls, vignettes, environmental-zone charges, traffic charges and other use-related costs are borne by the Renter insofar as they arose during the rental period, are attributable to the Renter and can legally be passed on to the Renter. Fines imposed by authorities are not passed on as the Lessor's own fine but are dealt with under the applicable statutory rules." },
        ],
      },
      {
        num: "7",
        title: "Upkeep, Maintenance, Damage, Tyres and Cleaning",
        blocks: [
          { kind: "clause", num: "7.1", text: "As a rule, the Lessor bears the costs of regular scheduled maintenance, the usual seasonal tyre change, the motor vehicle tax and the motor vehicle liability insurance it has taken out, unless something else that is valid and permissible has been agreed in the rental agreement." },
          { kind: "clause", num: "7.2", text: "Ordinary mechanical repairs and technical defects for which the Renter is not responsible are, as a rule, borne by the Lessor. Mandatory statutory rights remain reserved." },
          { kind: "clause", num: "7.3", text: "Before setting off and during the rental period, the Renter must, within reason, pay attention to obvious defects, warning messages, tyre damage and other safety-relevant irregularities. The Renter reports any such findings without delay." },
          { kind: "clause", num: "7.4", text: "In the event of safety-relevant warning messages or significant defects, the Renter must stop at a safe place and inform the Lessor without delay. Continuing the journey is permitted only if it is safe and justifiable in the circumstances or has been authorised accordingly. Instructions must not be followed if they would endanger persons or be unlawful." },
          { kind: "clause", num: "7.5", text: "As a rule, repairs may be arranged only with the Lessor's prior consent. This does not apply to necessary, proportionate immediate measures to avert danger or to prevent significant consequential damage if it is not possible or not reasonable to make contact in time. Receipts must be kept and sent to the Lessor as soon as possible." },
          { kind: "clause", num: "7.6", text: "Tyre and rim damage" },
          {
            kind: "lettered",
            items: [
              "a) Duty of care: The Renter must drive the vehicle with due care and avoid damage caused by improper handling. This applies in particular to approaching or driving over kerbs, pavement edges and road edges and to avoidable contact with obstacles.",
              "b) Renter's liability: If the Renter culpably causes damage to a tyre or rim, in particular cuts or tears, sidewall damage or damage from rim contact, the Renter is liable, to the extent permitted by law, for the damage actually incurred, necessary and proven. Any insurance cover and contractual limitations of liability remain reserved.",
              "c) Repair and replacement: The reasonable actual costs of a professional repair may be charged or – if a repair is not technically safe, not professionally possible or not economically reasonable – of the necessary replacement, including the necessary fitting costs. For a tyre replacement, the age, tread, condition and remaining useful value of the damaged tyre must be taken into account appropriately. A new part must not lead to unjustified enrichment without objective reason.",
              "d) Replacing both tyres on an axle: The replacement of both tyres on the same axle may be charged only if it is objectively necessary under applicable regulations, binding manufacturer specifications or the specific condition of the tyres and vehicle.",
              "e) Handling fee: For the necessary handling of tyre or rim damage culpably caused by the Renter, a handling fee of at most CHF 100.– per case of damage may also be charged, provided that it was transparently agreed before the contract was concluded, is legally permissible and covers a reasonable, comprehensible handling effort in the specific case. The fee must not lead to double charging for services already paid for or to a disproportionate burden on the Renter. Mandatory statutory provisions remain reserved.",
              "f) Loss of rental income and further damage: Proven loss of rental income and other direct damage may also be claimed insofar as the statutory requirements are met, the amount has been proven and the same damage has not already been compensated otherwise.",
              "g) Exclusion of liability: The Renter is not liable insofar as the damage cannot legally be attributed to the Renter, in particular in the case of a material defect not caused by the Renter or an unavoidable external influence.",
            ],
          },
          { kind: "clause", num: "7.7", text: "Normal wear and tear in accordance with the contract is not damage. The condition on takeover and on return should be documented by reports and, where appropriate, dated photos." },
          { kind: "clause", num: "7.8", text: "In the event of excessive soiling or soiling contrary to the contract that requires specialist cleaning beyond the usual cleaning, the Lessor may charge the reasonable and proven cleaning costs actually incurred. Examples are heavy smoke or odour contamination, considerable animal hair, spilled liquids or heavy soiling. A minimum flat rate of CHF 150 may be charged only if it was expressly agreed before the contract was concluded and is reasonable and legally permissible in the specific case; otherwise the proven actual costs apply." },
          { kind: "clause", num: "7.9", text: "The loss or theft of, or damage to, keys, the vehicle registration document, licence plates, charging cards or accessories provided must be reported without delay. The Renter is liable for the necessary, reasonable and proven costs of replacement or restoration insofar as the Renter is legally responsible for the loss or damage." },
        ],
      },
      {
        num: "8",
        title: "Insurance, Deductible and Liability",
        blocks: [
          { kind: "clause", num: "8.1", text: "The insurance cover specified in the rental agreement and the applicable insurance terms are authoritative. Before the contract is concluded, the Renter is informed of the agreed cover, any deductible and material exclusions. The Lessor cannot promise any cover that the insurance contract does not provide." },
          { kind: "clause", num: "8.2", text: "Insurance cover for professional passenger transport, taxi or platform rides, trips abroad or other special uses exists only if the specific use has been expressly agreed and is actually insured." },
          { kind: "clause", num: "8.3", text: "Under the law and the valid contract, the Renter is liable in particular for:" },
          {
            kind: "lettered",
            items: [
              "a) damage to the rental vehicle, insofar as the Renter culpably caused it or is answerable for it by law;",
              "b) an expressly agreed deductible, insofar as there is a loss event that is covered or subject to the deductible under the contractual terms and the Renter is answerable for it;",
              "c) damage and costs not covered, insofar as they are legally attributable to the Renter;",
              "d) traffic and use charges legally falling to the Renter and the consequences of the Renter's traffic offences;",
              "e) legitimate claims of third parties, insofar as the Renter is liable for them by law.",
            ],
          },
          { kind: "clause", num: "8.4", text: "A total loss, depreciation, loss of use, loss of rental income and other consequential damage may be claimed only insofar as there is a statutory or valid contractual basis, compensable damage and its amount have been proven, the damage is attributable to the Renter and no double compensation results. Any residual value, expenses saved and an appropriate allowance for the condition of the vehicle must be taken into account insofar as legally required." },
          { kind: "clause", num: "8.5", text: "The Lessor's liability is governed by the applicable law. An exclusion or limitation of liability applies only to the extent permitted by law. Mandatory liability provisions, in particular the statutory rules on liability for intent and gross negligence, remain reserved." },
          { kind: "clause", num: "8.6", text: "Within reason, both parties must help to prevent and limit damage. The Renter must inform the Lessor without delay, take reasonable protective measures, not culpably jeopardise the insurance cover and cooperate appropriately in the handling of the claim." },
        ],
      },
      {
        num: "9",
        title: "Accident, Breakdown, Reachability and Claims Management",
        blocks: [
          { kind: "clause", num: "9.1", text: "Reachability:" },
          { kind: "p", text: "The Renter ensures that the telephone number given when booking is, as a rule, reachable during the rental period and that their mobile phone is sufficiently charged. In the event of an accident, a breakdown or a problem with the vehicle, the Renter must answer the Lessor's call-back attempts as soon as reasonably possible. Insofar as safe and reasonable, the Renter should temporarily set silent or \"Do not disturb\" functions so that urgent call-backs can be noticed. A response within 10 minutes of becoming aware of a call-back attempt is expected, insofar as this is possible and reasonable in the specific circumstances; safety, emergency measures, sleep, lack of reception and other legitimate obstacles take precedence. Between 00:00 and 07:00, too, this expectation applies only within these limits." },
          { kind: "clause", num: "9.2", text: "Breakdowns and technical defects:" },
          { kind: "p", text: "In the event of a breakdown, a warning message or a technical defect, the Renter must, where necessary, stop the vehicle at a safe place, take warning and protective measures and inform the Lessor by telephone. The Renter must follow reasonable and safe instructions. If the Lessor cannot be reached, the Renter should also send a message with a short description of the problem and the location and wait for a call back, insofar as this is safe and reasonable. A waiting time of 15 minutes does not apply if immediate action is necessary to avert danger, to secure the accident site or to prevent significant consequential damage." },
          { kind: "clause", num: "9.3", text: "Accidents between 00:00 and 07:00:" },
          {
            kind: "lettered",
            items: [
              "a) The Renter secures the accident site, gives any necessary first aid and alerts the competent emergency services without delay if anyone is injured or there is immediate danger. The Renter complies with statutory reporting obligations and official instructions.",
              "b) The police must be notified if this is required by law or the circumstances require it. For accidents between 00:00 and 07:00, the Renter should, as a rule, contact the police on 117 to clarify how to proceed, insofar as this is safe and appropriate in the circumstances. This contractual requirement must not delay any emergency measure and does not create any obligation to act contrary to police instructions.",
              "c) Insofar as safe and possible, the Renter documents those involved, contact details, licence plates, insurance details, witnesses, how the accident happened and visible damage. Where possible, the Renter draws up an accident report and takes meaningful photos of the vehicles, damage, positions and accident site.",
              "d) After securing the accident site, the Renter contacts the Lessor. If the Lessor cannot be reached or breakdown assistance is needed, the breakdown service notified by the Lessor for the specific vehicle must be contacted. The necessary telephone number and contract reference are given separately in the handover documents or in the vehicle-specific emergency information.",
              "e) The Renter keeps relevant photos, reports, police reference numbers and receipts and makes them available to the Lessor as soon as possible.",
            ],
          },
          { kind: "clause", num: "9.4", text: "Towing services, breakdown services and garages:" },
          { kind: "p", text: "Without the Lessor's prior consent, the Renter may, as a rule, not instruct a towing service, breakdown service or garage in the Lessor's name or at the Lessor's expense. This does not apply to necessary and proportionate immediate measures to avert danger to persons, to secure the vehicle or to prevent significant consequential damage if it is not possible or not reasonable to make contact in time. The Lessor must be informed as soon as possible; receipts and reasons must be documented." },
          { kind: "clause", num: "9.5", text: "Costs of an unapproved instruction:" },
          { kind: "p", text: "The costs of a third party instructed without the required approval may be charged to the Renter only insofar as the instruction constitutes a breach of contract attributable to the Renter, the costs were actually incurred and are necessary, reasonable and proven, and there is a statutory or valid contractual basis. The mere lack of consent does not automatically create an obligation to pay, in particular if a necessary emergency measure was involved. Double charging is excluded." },
          { kind: "clause", num: "9.6", text: "Accident, theft and other reporting of damage:" },
          { kind: "p", text: "In the event of an accident, the Renter secures the accident site, gives first aid where necessary and, if needed, alerts the ambulance service on 144. The police must be notified if required by law or necessary in the circumstances. Accidents, damage, theft, loss and other events relevant to insurance must be reported to the Lessor without delay, if possible within 24 hours of becoming aware of them. If this is not possible or not reasonable because of injuries, official measures or other important reasons, the report must be made without delay once the obstacle has ceased. Without the relevant authority, the Renter may not make any binding acknowledgement of debt or enter into settlements on the Lessor's claims. The Renter must cooperate truthfully and appropriately in investigating the damage." },
          { kind: "clause", num: "9.7", text: "Mitigation of damage and safety:" },
          { kind: "p", text: "The Renter takes reasonable measures to limit damage and costs and keeps available receipts, photos and documents. No provision obliges the Renter to endanger themselves or third parties, to delay necessary first aid or to breach statutory obligations." },
        ],
      },
      {
        num: "10",
        title: "Return, Report and Replacement Vehicle",
        blocks: [
          { kind: "clause", num: "10.1", text: "The vehicle must be returned at the agreed place and time with all keys, documents, cards and accessories. The Renter may not leave the vehicle unattended at any other place unless the Lessor has expressly confirmed this or an emergency leaves no reasonable alternative." },
          { kind: "clause", num: "10.2", text: "On handover and on return, the condition, existing damage, mileage, fuel or charge level and accessories should be documented. Photos may be used in addition. The Renter should receive a copy of the report or be able to access it in an appropriate manner." },
          { kind: "clause", num: "10.3", text: "The Renter should report recognisable defects or damage on takeover, if possible before setting off, and have them documented. A failure to report does not in itself create automatic liability for damage that cannot be proven to have been caused by the Renter. The statutory rules on the burden of proof remain reserved." },
          { kind: "clause", num: "10.4", text: "New damage found on return should be documented as promptly as possible and communicated to the Renter. Where an inspection on return is not possible, the Lessor should communicate its findings without undue delay after discovering them. Responsibility is governed by the law and the contract." },
          { kind: "clause", num: "10.5", text: "A late return must be notified to the Lessor without delay. The extension is binding only once expressly confirmed. For a culpable, unjustified late return, agreed and legally permissible compensation and further proven damage may be claimed. Double compensation is excluded." },
          { kind: "clause", num: "10.6", text: "In the event of a breakdown or technical defect not caused by the Renter, the Lessor endeavours, insofar as available and organisationally reasonable, to offer a replacement vehicle or another appropriate solution. An entitlement to an equivalent replacement vehicle exists only insofar as it has been expressly agreed or is owed by law. Mandatory statutory rights remain reserved." },
          { kind: "clause", num: "10.7", text: "The return is deemed to have taken place as soon as the vehicle and the items provided have actually been handed over to the Lessor or to a person authorised by the Lessor, or the Lessor has otherwise confirmed the return. Merely parking or leaving the vehicle without an agreed return procedure is not necessarily sufficient." },
        ],
      },
      {
        num: "11",
        title: "Contractual Penalties and Flat-Rate Charges",
        blocks: [
          { kind: "clause", num: "11.1", text: "A contractual penalty is owed only if it was clearly, transparently and validly agreed before the contract was concluded, the specifically described circumstances are met and the statutory requirements are fulfilled. The following overview applies only if the respective item is listed in the individual rental agreement or in a fee overview expressly incorporated before the contract was concluded:" },
          {
            kind: "list",
            items: [
              "Unjustified late return: CHF 100 per calendar day or part thereof, provided that this contractual penalty has been validly agreed, is reasonable in the circumstances and is legally enforceable. It is not automatically owed in addition to compensation for the same damage.",
              "Material, culpable false statement of the residential or postal address: CHF 500, provided that the statement is relevant to the conclusion of the contract, the provision of the vehicle or the legitimate enforcement of claims and the penalty is reasonable in the specific case and validly agreed.",
              "Leaving the vehicle to a driver who is not authorised: CHF 500, provided that it is validly agreed and legally enforceable in the specific case.",
              "Smoking or vaping in the vehicle: CHF 250, provided that it is validly agreed and reasonable; proven additional cleaning costs may be claimed only after crediting any item already paid for.",
              "Intentional or culpable tampering with, removal or unauthorised deactivation of a GPS or tracking system: CHF 800, provided that it is validly agreed and reasonable and legally enforceable in the specific case.",
              "Material, culpable breach of the duty to report an accident: CHF 500, provided that it is validly agreed, the breach of duty is significant and the penalty is reasonable in the specific case.",
            ],
          },
          { kind: "p", text: "Tyre and rim damage: Clause 7.6 applies. Any handling fee is governed exclusively by clause 7.6(e) and may cover at most the amount stated there and the handling effort actually incurred, reasonable and legally recoverable. It is not automatically owed. An additional flat-rate contractual penalty of CHF 100.– per tyre is not established by this provision alone." },
          { kind: "clause", num: "11.2", text: "The contractual penalty does not release the Renter from ending a breach of contract, returning the vehicle or complying with statutory duties to cooperate." },
          { kind: "clause", num: "11.3", text: "Excessively high contractual penalties may be reduced by the competent court under Art. 163 para. 3 CO." },
          { kind: "clause", num: "11.4", text: "Further damages may be claimed only insofar as this is permitted by law, additional damage has been proven and no double compensation results. Contractual penalties or compensation already paid must be credited in the calculation insofar as they cover the same damage." },
        ],
      },
      {
        num: "12",
        title: "Deposit, Payment Default and Fees",
        blocks: [
          { kind: "clause", num: "12.1", text: "The amount, method of payment, due date and permitted use of the deposit, and the accepted means of payment, are set before the contract is concluded in the rental agreement or in the booking terms." },
          { kind: "clause", num: "12.2", text: "The deposit serves to secure legitimate claims arising from the rental relationship. The Lessor may set off only claims that are actually owed, due and legally offsettable and must itemise the deductions comprehensibly. Mandatory statutory rights remain reserved." },
          { kind: "clause", num: "12.3", text: "If, on return, a specific claim cannot yet be finally quantified, only an appropriate part of the deposit may be withheld, provided that there is a legal basis for this and the amount is in reasonable proportion to the expected claim. The undisputed balance not needed is repaid without undue delay. The mere abstract possibility of future claims does not justify withholding it indefinitely." },
          { kind: "clause", num: "12.4", text: "The Lessor endeavours to repay the deposit without delay after the vehicle has been properly returned and the necessary checks have been carried out. Insofar as there are no specific, justified outstanding claims, the repayment should be initiated within 10 working days at the latest. When the amount is actually credited may depend on the bank or the payment service provider. Clause 12.3 applies to specific claims that cannot yet be quantified." },
          { kind: "clause", num: "12.5", text: "The following fees may be charged only if they were expressly and transparently agreed before the contract was concluded, are legally permissible and reasonable in the specific case and no mandatory statutory rules preclude them:" },
          {
            kind: "list",
            items: [
              "Processing a traffic fine or an authority's request for information about the vehicle's keeper: CHF 20 per case;",
              "Reminder in the event of payment default: CHF 20 per reminder, insofar as legally permissible;",
              "Internal administrative work in connection with debt enforcement proceedings: CHF 80, insofar as legally permissible and reasonable;",
              "Organising a necessary recovery of the vehicle: at least CHF 400, only insofar as there is a valid basis and the amount is reasonable in the specific case; third-party costs actually incurred may be claimed in addition only insofar as there is no double charging;",
              "Storage of the vehicle: CHF 50 per day, only insofar as there is a valid basis and the fee does not unreasonably exceed the actual, reasonable and attributable costs.",
            ],
          },
          { kind: "clause", num: "12.6", text: "External costs, official fees and internal processing fees must be distinguished from one another. On request, the Lessor discloses the calculation and available receipts to an appropriate extent. External costs may be charged only if they were actually incurred and are necessary, reasonable, legally attributable and recoverable." },
          { kind: "clause", num: "12.7", text: "Charging the same expense or damage more than once under different fee or damages items is excluded. Statutory default interest and debt collection or legal costs actually owed remain reserved, insofar as the statutory requirements are met." },
        ],
      },
      {
        num: "13",
        title: "Reclaiming the Vehicle and Legal Action",
        blocks: [
          { kind: "clause", num: "13.1", text: "After the agreed rental period has expired or the rental agreement has been validly terminated, the Renter must return the vehicle on time." },
          { kind: "clause", num: "13.2", text: "If the vehicle is not returned, the Lessor may demand its return and, where appropriate or legally required, set a deadline. In urgent cases or where the vehicle is in specific danger, lawful urgent measures remain reserved." },
          { kind: "clause", num: "13.3", text: "Reasonable, necessary and proven costs of recovering the vehicle may be charged to the Renter insofar as the Renter culpably caused the recovery and there is a statutory or valid contractual basis." },
          { kind: "clause", num: "13.4", text: "In the event of significant payment default, unauthorised passing on of the vehicle, tampering with security devices or other material breaches of contract, the Lessor may take proportionate measures permitted by law to secure and reclaim the vehicle. In doing so, it may not resort to unlawful self-help or infringe the rights of third parties." },
          { kind: "clause", num: "13.5", text: "If the vehicle is not returned, or in the event of other significant breaches of contract, the Lessor may assert its civil-law claims and, where appropriate, inform the competent authorities. A late return or other breach of contract does not automatically constitute a criminal offence; the assessment under criminal law is a matter for the competent authorities and courts." },
        ],
      },
      {
        num: "14",
        title: "GPS Tracking, Vehicle Location and Remote Immobilisation",
        blocks: [
          { kind: "clause", num: "14.1", text: "The vehicle may be equipped with GPS tracking or a fleet management system. Location and vehicle data may be processed only on a permissible legal basis and for specified, legitimate and proportionate purposes, in particular for theft prevention, securing the vehicle, fleet management, technical diagnosis or the lawful reclaiming of the vehicle." },
          { kind: "clause", num: "14.2", text: "Before or when collecting the data, the Lessor provides an accessible privacy policy containing the information required under the applicable data protection law. This includes in particular the identity and contact details of the controller, the purposes of processing, the categories of data, the recipients or categories of recipients, the retention period or the criteria for determining it, any disclosures abroad and the rights of data subjects." },
          { kind: "clause", num: "14.3", text: "Location data is retained only to the extent required and for as long as necessary. Only authorised persons and service providers have access to it. Appropriate technical and organisational security measures must be taken. It is disclosed only on a permissible legal basis." },
          { kind: "clause", num: "14.4", text: "The Renter may not tamper with, remove, damage or deactivate without authorisation any tracking or security devices. Malfunctions must be reported to the Lessor without delay." },
          { kind: "clause", num: "14.5", text: "A technical remote immobilisation may be used only if it is legally permissible, necessary and proportionate in the specific case. In particular, it may not take place while the vehicle is being driven or in a situation in which it could endanger the driver, occupants or other road users. An immobilisation may not be used as an impermissible means of pressure to collect disputed claims. The vehicle must be reclaimed by lawful means." },
          { kind: "clause", num: "14.6", text: "Liability in connection with tracking, remote immobilisation and reclaiming the vehicle is governed by the applicable law. Mandatory liability provisions remain reserved." },
        ],
      },
      {
        num: "15",
        title: "Identity, Information and Duties to Cooperate",
        blocks: [
          { kind: "clause", num: "15.1", text: "The Renter confirms that their information and the identity documents, driving licences, permits and other documents they have presented are, to the best of their knowledge, complete, correct and valid." },
          { kind: "clause", num: "15.2", text: "This applies in particular to name, identity, date of birth, residential and postal address, contact details, payment details, and the entitlements to drive and permits required for the agreed use of the vehicle." },
          { kind: "clause", num: "15.3", text: "Material changes to contact or postal details, and the loss of a required entitlement to drive, must be notified to the Lessor without delay." },
          { kind: "clause", num: "15.4", text: "Where there is objective cause, the Lessor may request current proof insofar as this is necessary, proportionate and permissible under data protection law for concluding the contract, safely handing over the vehicle, performing the rental relationship or legitimately enforcing claims." },
          { kind: "clause", num: "15.5", text: "Intentionally false or misleading information and forged or invalid documents may constitute a material breach of contract. Whether the facts are relevant under criminal law is assessed by the competent authorities and courts." },
          { kind: "clause", num: "15.6", text: "Under the statutory provisions, the Renter is liable for proven and legally attributable damage that they culpably cause through false information or incorrect documents. Recoverable loss of rental income, costs of returning the vehicle, and necessary debt collection and legal costs may be claimed only insofar as they are recoverable by law, reasonable and proven. Double compensation is excluded." },
        ],
      },
      {
        num: "16",
        title: "Professional Passenger Transport and Use of Platforms",
        blocks: [
          { kind: "clause", num: "16.1", text: "Professional passenger transport, taxi rides or platform rides are permitted only if they have been expressly agreed in the individual rental agreement." },
          { kind: "clause", num: "16.2", text: "Throughout the rental period, the Renter is responsible for complying with the statutory, regulatory and contractual requirements applicable to the agreed use. These include in particular the required entitlements to drive, permits and the applicable regulations for professional passenger transport." },
          { kind: "clause", num: "16.3", text: "The Renter may use the vehicle only for the agreed purpose and must ensure that the vehicle registration, equipment and actual insurance cover permit the use. The Lessor guarantees neither admission by a platform nor any particular turnover, number of jobs or uninterrupted availability of the vehicle." },
          { kind: "clause", num: "16.4", text: "The Renter shall inform the Lessor without delay of the loss, restriction or withdrawal of any authorisation required for the agreed use. If an essential requirement ceases to be met, the Lessor may prohibit further use and demand the return of the vehicle in accordance with the applicable law." },
        ],
      },
      {
        num: "17",
        title: "Data Protection and Notices",
        blocks: [
          { kind: "clause", num: "17.1", text: "The Lessor processes personal data to handle enquiries, to conclude and perform the rental agreement, to process payments, to fulfil statutory obligations, to handle claims, to manage and secure the vehicles and to safeguard legitimate interests, to the extent permitted by law." },
          { kind: "clause", num: "17.2", text: "Details of the processing of personal data, in particular on recipients, retention periods, disclosures abroad, GPS and location data and the rights of data subjects, are set out in the separate privacy policy. It is easily accessible and must be available in an appropriate manner before or when the data is collected. These GTC do not replace the privacy policy." },
          { kind: "clause", num: "17.3", text: "Notices relating to the rental relationship may be sent to the postal and electronic contact addresses given in the rental agreement, insofar as the notice in question is legally permissible in this form. For declarations subject to a legal form requirement, the statutory form requirements remain reserved." },
          { kind: "clause", num: "17.4", text: "The Renter must notify material changes to their contact and postal address without delay. The Lessor may send necessary notices to the address last validly notified, insofar as permitted by law; mandatory rules on the receipt of declarations remain reserved." },
        ],
      },
      {
        num: "18",
        title: "Final Provisions",
        blocks: [
          { kind: "clause", num: "18.1", text: "Entire agreement:" },
          { kind: "p", text: "The individual rental agreement, these GTC and expressly incorporated supplementary agreements constitute the agreement between the parties on the rental relationship concerned. Individually negotiated and expressly deviating provisions take precedence over these GTC." },
          { kind: "clause", num: "18.2", text: "Amendments:" },
          { kind: "p", text: "Amendments and supplements must be made in text form, unless the law requires a stricter form or the parties have validly agreed on a stricter form. Statutory requirements for amendments to the contract and for proving an agreement remain reserved." },
          { kind: "clause", num: "18.3", text: "No waiver:" },
          { kind: "p", text: "The temporary failure to exercise a right, or its delayed enforcement, does not as such constitute a waiver of that right." },
          { kind: "clause", num: "18.4", text: "Force majeure:" },
          { kind: "p", text: "To the extent permitted by law, neither party is liable for failures of performance directly attributable to extraordinary events that are beyond control and could not be avoided despite reasonable care. The affected party informs the other party without delay where possible and takes reasonable measures to limit the effects. Mandatory statutory rights and liability rules remain reserved." },
          { kind: "clause", num: "18.5", text: "Partial invalidity:" },
          { kind: "p", text: "Should any provision of these GTC be or become invalid or unenforceable in whole or in part, the remaining provisions remain in force to the extent permitted by law. The applicable statutory provisions apply in place of the invalid provision. This clause does not provide for automatic replacement by a provision that comes as close as possible economically." },
          { kind: "clause", num: "18.6", text: "Governing law:" },
          { kind: "p", text: "Substantive Swiss law applies, insofar as its application is permitted by law. Mandatory provisions of private international law and mandatory protective provisions, in particular for consumers, remain reserved." },
          { kind: "clause", num: "18.7", text: "Place of jurisdiction Zurich:" },
          { kind: "p", text: "Insofar as an agreement on jurisdiction is permitted by law, Zurich, Switzerland, is agreed as the place of jurisdiction for disputes arising from or in connection with the rental relationship. Mandatory statutory places of jurisdiction and restrictions for consumer contracts remain reserved. Insofar as a prior agreement on jurisdiction is not permitted or not valid, the statutory places of jurisdiction apply." },
        ],
      },
    ],
  },
  fr: {
    title: "Conditions Générales de Location (CGV)",
    updated: "État au 22 octobre 2026",
    intro: [
      "Loueur : Rigitrade AG (le « Loueur »)",
      "Fait foi la version rendue accessible et valablement intégrée au contrat avant la conclusion de celui-ci.",
    ],
    sections: [
      {
        num: "1",
        title: "Champ d'application et éléments du contrat",
        blocks: [
          { kind: "clause", num: "1.1", text: "Les présentes Conditions générales de location (« CGV ») s'appliquent aux contrats de location de véhicules conclus entre Rigitrade AG (le « Loueur ») et la personne physique ou morale désignée dans le contrat de location concerné (le « Locataire »)." },
          { kind: "clause", num: "1.2", text: "Font partie du contrat, dans la mesure où ils ont été valablement convenus : le contrat de location individuel, les présentes CGV, les conditions de réservation et tarifaires rendues accessibles avant la conclusion du contrat, les conditions complémentaires expressément convenues ainsi que les procès-verbaux de remise et de restitution. En cas de contradiction, les dispositions contractuelles négociées individuellement et expressément dérogatoires prévalent. Le droit impératif demeure réservé." },
          { kind: "clause", num: "1.3", text: "Les CGV doivent être rendues accessibles au Locataire avant ou au plus tard lors de la conclusion du contrat. Pour les réservations en ligne, le Locataire doit avoir une possibilité raisonnable de consulter les CGV et de les accepter avant d'émettre sa déclaration de réservation ferme. Le consentement et la version utilisée doivent être documentés de manière vérifiable." },
          { kind: "clause", num: "1.4", text: "Les conditions particulières applicables aux locations privées ou touristiques, aux trajets transfrontaliers et au transport professionnel de personnes ne s'appliquent que si elles ont été communiquées de manière transparente avant la conclusion du contrat et valablement intégrées à celui-ci." },
          { kind: "clause", num: "1.5", text: "Les dispositions légales impératives, notamment les dispositions impératives en matière de protection des consommateurs et des données, prévalent sur les dispositions contractuelles contraires." },
        ],
      },
      {
        num: "2",
        title: "Réservation, conclusion du contrat et durée de location",
        blocks: [
          { kind: "clause", num: "2.1", text: "Le contrat de location individuel fixe notamment le véhicule, le début et la fin de la location, le lieu de remise et de restitution, le prix de location, les conditions de paiement, la caution, le régime kilométrique, l'usage, l'assurance convenue, la franchise ainsi que les prestations supplémentaires expressément convenues." },
          { kind: "clause", num: "2.2", text: "Une demande sans engagement ne fonde pas encore de contrat de location. Le contrat est conclu lorsque le Loueur confirme la réservation ou que les parties le concluent valablement d'une autre manière." },
          { kind: "clause", num: "2.3", text: "La durée de location est régie par les moments convenus dans le contrat de location. Une prolongation n'a d'effet obligatoire que si le Loueur la confirme expressément. Une demande de prolongation ne vaut pas accord. Le Locataire doit demander une prolongation en temps utile et, tant que la prolongation n'est pas confirmée, restituer le véhicule au moment initialement convenu." },
          { kind: "clause", num: "2.4", text: "Les annulations, modifications de réservation, cas de non-présentation (no-show), restitutions anticipées et remboursements sont régis par les conditions de réservation communiquées au Locataire et valablement convenues avant la réservation ferme ainsi que par le droit impératif. Des frais d'annulation ou de traitement non communiqués à l'avance ne sont pas fondés par les seules présentes CGV." },
          { kind: "clause", num: "2.5", text: "Les prix de location, cautions, franchises, limitations de kilométrage, prix des kilomètres supplémentaires, conditions de carburant ou de recharge, frais de livraison et d'enlèvement ainsi que les autres prestations supplémentaires doivent être indiqués de manière transparente avant la conclusion du contrat ou fixés dans le contrat de location. Les prestations supplémentaires non convenues ne sont pas dues." },
          { kind: "clause", num: "2.6", text: "Le Loueur peut refuser la remise si des conditions contractuelles essentielles ne sont pas remplies, si des paiements ou sûretés requis sont en suspens ou s'il existe des doutes concrets et objectivement fondés quant à l'identité, au droit de conduire, au traitement du paiement ou à une utilisation sûre et conforme au contrat. Les prétentions légales demeurent réservées." },
        ],
      },
      {
        num: "3",
        title: "Identité, permis de conduire et conducteurs autorisés",
        blocks: [
          { kind: "clause", num: "3.1", text: "Avant la remise du véhicule, le Locataire doit justifier de son identité au moyen d'un document officiel valable et présenter un permis de conduire valable pour le véhicule. Le Loueur peut recueillir et documenter les informations nécessaires à la conclusion du contrat, au droit de conduire et à l'exercice légitime de ses prétentions, dans la mesure où cela est admissible au regard de la protection des données et proportionné." },
          { kind: "clause", num: "3.2", text: "En cas de permis de conduire étranger, le Locataire doit remplir les exigences de reconnaissance applicables en Suisse. Un permis de conduire international ou une traduction doit en outre être présenté lorsque la loi l'exige ; il ne remplace pas le permis de conduire national." },
          { kind: "clause", num: "3.3", text: "L'âge minimum, la durée minimale de détention du permis de conduire, les éventuels suppléments et les autres conditions d'admission doivent être communiqués avant la conclusion du contrat et, si cela est pertinent, fixés dans le contrat de location." },
          { kind: "clause", num: "3.4", text: "Le véhicule ne peut être conduit que par le Locataire et par les conducteurs supplémentaires expressément autorisés dans le contrat de location ou dans un complément confirmé par le Loueur. Les conducteurs supplémentaires doivent être identifiés et leur droit de conduire vérifié avant le premier trajet." },
          { kind: "clause", num: "3.5", text: "Le Locataire ne peut confier le véhicule à aucune personne non autorisée, n'ayant pas le droit de conduire, inapte à la conduite ou exclue de la conduite selon le droit applicable. Le Locataire doit prendre des mesures raisonnables pour empêcher toute utilisation non autorisée." },
          { kind: "clause", num: "3.6", text: "Le Locataire informe le Loueur sans délai lorsqu'un droit de conduire requis a été retiré, restreint ou invalidé ou a cessé d'exister d'une autre manière." },
          { kind: "clause", num: "3.7", text: "Le Loueur peut refuser la remise ou, si le véhicule a déjà été remis, prendre des mesures de protection licites lorsque des documents requis font défaut ou suscitent des doutes fondés, que les conditions d'admission ne sont pas remplies ou que des circonstances concrètes s'opposent à une utilisation sûre ou conforme au contrat." },
        ],
      },
      {
        num: "4",
        title: "Utilisation autorisée et interdictions d'utilisation",
        blocks: [
          { kind: "clause", num: "4.1", text: "Le véhicule ne peut être utilisé que pour l'usage convenu dans le contrat de location et dans la zone convenue. Les trajets privés de vacances et de loisirs sont autorisés si un usage privé a été convenu." },
          { kind: "clause", num: "4.2", text: "Le transport professionnel de personnes, les courses de taxi et via des plateformes, le transport commercial de marchandises ainsi que les autres usages commerciaux ne sont autorisés que si l'usage concret est expressément convenu dans le contrat de location et admissible au regard de la loi et du contrat d'assurance." },
          { kind: "clause", num: "4.3", text: "Sans l'accord exprès du Loueur, donné par écrit ou documenté sous forme de texte, sont notamment interdits :" },
          {
            kind: "lettered",
            items: [
              "a) la mise à disposition, la remise ou la sous-location du véhicule à des personnes non autorisées ainsi que la cession du contrat de location ;",
              "b) l'utilisation à des fins illicites ;",
              "c) la conduite sous l'influence de l'alcool, de stupéfiants ou de toute autre substance rendant inapte à la conduite ;",
              "d) les courses, les manifestations de sport automobile, les cours de conduite, les compétitions, les trajets d'essai ou le transport rémunéré de personnes ou de marchandises, sauf convention expresse ;",
              "e) la surcharge, le dépassement du nombre de places ou des limites de poids autorisés ou toute utilisation contraire aux prescriptions essentielles du constructeur ;",
              "f) le fait de fumer ou de vapoter dans le véhicule ;",
              "g) la manipulation, le retrait, l'endommagement ou la désactivation non autorisée de dispositifs GPS, de localisation ou de sécurité ;",
              "h) la poursuite du trajet malgré un défaut reconnaissable affectant la sécurité ou un message d'avertissement, lorsque la poursuite du trajet n'est pas sûre ou pas justifiable ;",
              "i) l'utilisation transfrontalière contraire au chiffre 5 ;",
              "j) l'utilisation à des fins de remorquage, de traction, de course ou à d'autres fins particulières pour lesquelles le véhicule n'est pas homologué ou équipé.",
            ],
          },
          { kind: "clause", num: "4.4", text: "Le Locataire doit utiliser le véhicule avec soin, de manière sûre pour la circulation et conformément aux instructions d'utilisation et aux prescriptions du constructeur. Les modifications techniques, réparations ou installations ne peuvent être effectuées qu'avec l'accord du Loueur, à l'exception des mesures immédiates nécessaires selon les chiffres 7.5 et 9." },
          { kind: "clause", num: "4.5", text: "En cas de violation essentielle du contrat, le Loueur peut, conformément au droit applicable, exiger l'exécution du contrat, mettre fin au contrat et exiger la restitution du véhicule. Dans la mesure où cela est approprié et juridiquement requis, un délai doit être imparti pour remédier à la violation. En cas de circonstances graves ou urgentes, les mesures immédiates autorisées par la loi demeurent réservées." },
        ],
      },
      {
        num: "5",
        title: "Trajets à l'étranger et restrictions géographiques",
        blocks: [
          { kind: "clause", num: "5.1", text: "Les trajets à l'étranger ne sont autorisés qu'à destination des pays expressément autorisés pour le véhicule et la location concernés. Les pays autorisés doivent figurer dans le contrat de location, dans la confirmation de réservation ou dans une liste de pays rendue accessible avant la conclusion du contrat et intégrée à celui-ci." },
          { kind: "clause", num: "5.2", text: "Avant le départ, le Locataire doit vérifier si les documents du véhicule, la couverture d'assurance, les conditions d'entrée, les redevances routières et les éventuelles prestations d'assistance en cas de panne sont valables pour les pays prévus. Il doit respecter les prescriptions de circulation et autres prescriptions légales applicables dans chaque cas." },
          { kind: "clause", num: "5.3", text: "Les trajets à destination de pays non autorisés ou les utilisations qui violent ou compromettent la couverture d'assurance sont interdits. Un accord du Loueur n'étend la couverture d'assurance que si celle-ci existe effectivement." },
          { kind: "clause", num: "5.4", text: "Le Locataire prend en charge les péages, vignettes, frais de stationnement, redevances de zones environnementales et autres redevances routières liées à l'utilisation qui lui sont juridiquement imputables, dans la mesure où ils surviennent pendant la durée de la location." },
        ],
      },
      {
        num: "6",
        title: "Prix de location, kilomètres, carburant et recharge",
        blocks: [
          { kind: "clause", num: "6.1", text: "Le prix de location, la limitation du kilométrage, le prix des kilomètres supplémentaires, la règle applicable au niveau de carburant ou de charge et les prestations supplémentaires sont régis par le contrat de location et par les conditions tarifaires valablement convenues avant la conclusion du contrat." },
          { kind: "clause", num: "6.2", text: "Sauf convention contraire, le Locataire prend en charge les frais de carburant et de recharge encourus pendant la durée de la location. Le véhicule doit être restitué avec le niveau de carburant ou de charge convenu." },
          { kind: "clause", num: "6.3", text: "Le carburant ou la charge manquants, les kilomètres supplémentaires et les prestations supplémentaires ne peuvent être facturés qu'aux prix préalablement communiqués de manière transparente et valablement convenus. À défaut de convention de prix valable, seules les prétentions dues selon la loi et prouvées peuvent être invoquées." },
          { kind: "clause", num: "6.4", text: "Le Locataire doit utiliser le carburant prescrit et respecter les instructions d'utilisation et de recharge. Il ne répond des dommages résultant d'un carburant erroné, d'une erreur de manipulation ou d'une utilisation contraire au contrat que dans la mesure où les conditions légales et contractuelles sont remplies." },
          { kind: "clause", num: "6.5", text: "Les frais de stationnement, péages, vignettes, redevances de zones environnementales, taxes de circulation et autres frais liés à l'utilisation sont à la charge du Locataire dans la mesure où ils sont survenus pendant la durée de la location, lui sont imputables et peuvent juridiquement lui être répercutés. Les amendes infligées par les autorités ne sont pas répercutées comme amende propre du Loueur, mais traitées selon les règles légales applicables." },
        ],
      },
      {
        num: "7",
        title: "Entretien, maintenance, dommages, pneus et nettoyage",
        blocks: [
          { kind: "clause", num: "7.1", text: "En principe, le Loueur prend en charge les frais de la maintenance régulière et planifiée, du changement saisonnier habituel des pneus, de l'impôt sur les véhicules à moteur et de l'assurance responsabilité civile pour véhicules à moteur qu'il a contractée, sauf convention contraire valable et admissible dans le contrat de location." },
          { kind: "clause", num: "7.2", text: "Les réparations mécaniques ordinaires et les défauts techniques dont le Locataire ne répond pas sont en principe à la charge du Loueur. Les droits légaux impératifs demeurent réservés." },
          { kind: "clause", num: "7.3", text: "Avant le départ et pendant la durée de la location, le Locataire doit, dans la mesure de ce qui peut raisonnablement être exigé, prêter attention aux défauts manifestes, messages d'avertissement, dommages aux pneus et autres anomalies affectant la sécurité. Il signale sans délai de telles constatations." },
          { kind: "clause", num: "7.4", text: "En cas de messages d'avertissement relatifs à la sécurité ou de défauts importants, le Locataire doit s'arrêter dans un endroit sûr et informer le Loueur sans délai. La poursuite du trajet n'est autorisée que si elle est sûre et justifiable au vu des circonstances ou si elle a été autorisée en conséquence. Les instructions ne doivent pas être suivies si elles mettent des personnes en danger ou sont illicites." },
          { kind: "clause", num: "7.5", text: "En principe, les réparations ne peuvent être commandées qu'avec l'accord préalable du Loueur. Font exception les mesures immédiates nécessaires et proportionnées pour écarter un danger ou éviter des dommages consécutifs importants, lorsqu'une prise de contact en temps utile n'est pas possible ou pas raisonnablement exigible. Les justificatifs doivent être conservés et transmis au Loueur dès que possible." },
          { kind: "clause", num: "7.6", text: "Dommages aux pneus et aux jantes" },
          {
            kind: "lettered",
            items: [
              "a) Devoir de diligence : Le Locataire doit conduire le véhicule avec la diligence requise et éviter les dommages dus à une manipulation inappropriée. Cela vaut en particulier pour le fait d'aborder ou de franchir des bordures, des bords de trottoir et des bords de route ainsi que pour les contacts évitables avec des obstacles.",
              "b) Responsabilité du Locataire : Si le Locataire cause fautivement un dommage à un pneu ou à une jante, notamment des coupures ou déchirures, des dommages au flanc ou des dommages dus à un contact de la jante, il répond, dans la mesure autorisée par la loi, du dommage effectivement survenu, nécessaire et prouvé. Une éventuelle couverture d'assurance et les limitations contractuelles de responsabilité demeurent réservées.",
              "c) Réparation et remplacement : Peuvent être facturés les frais effectifs appropriés d'une réparation dans les règles de l'art ou – si une réparation n'est pas sûre sur le plan technique, pas possible dans les règles de l'art ou pas raisonnablement exigible sur le plan économique – du remplacement nécessaire, y compris les frais de montage nécessaires. En cas de remplacement d'un pneu, l'âge, la profondeur des sculptures, l'état et la valeur d'usage résiduelle du pneu endommagé doivent être pris en compte de manière appropriée. Une pièce neuve ne doit pas conduire sans motif objectif à un enrichissement injustifié.",
              "d) Remplacement des deux pneus d'un essieu : Le remplacement des deux pneus d'un même essieu ne peut être facturé que s'il est objectivement nécessaire en raison de prescriptions applicables, de prescriptions contraignantes du constructeur ou de l'état concret des pneus et du véhicule.",
              "e) Frais de traitement : Pour le traitement nécessaire d'un dommage à un pneu ou à une jante causé fautivement par le Locataire, des frais de traitement de CHF 100.– au maximum par sinistre peuvent en outre être perçus, pour autant qu'ils aient été convenus de manière transparente avant la conclusion du contrat, qu'ils soient juridiquement admissibles et qu'ils couvrent, dans le cas concret, une charge de traitement appropriée et compréhensible. Ces frais ne doivent entraîner ni une double facturation de prestations déjà rémunérées ni une charge disproportionnée pour le Locataire. Les dispositions légales impératives demeurent réservées.",
              "f) Perte de location et autres dommages : Une perte de location prouvée et d'autres dommages directs peuvent en outre être réclamés dans la mesure où les conditions légales sont remplies, où le montant est prouvé et où le même dommage n'est pas déjà indemnisé d'une autre manière.",
              "g) Exclusion de la responsabilité : Le Locataire n'est pas responsable dans la mesure où le dommage ne peut pas lui être juridiquement imputé, notamment en cas de défaut de matériel qu'il n'a pas causé ou d'influence extérieure inévitable.",
            ],
          },
          { kind: "clause", num: "7.7", text: "L'usure normale conforme au contrat ne constitue pas un dommage. L'état lors de la prise en charge et de la restitution doit être documenté par des procès-verbaux et, si cela est utile, par des photos datées." },
          { kind: "clause", num: "7.8", text: "En cas de salissure excessive ou contraire au contrat nécessitant un nettoyage spécial allant au-delà du nettoyage habituel, le Loueur peut facturer les frais de nettoyage effectivement encourus, appropriés et prouvés. Il s'agit par exemple d'une forte imprégnation de fumée ou d'odeurs, de nombreux poils d'animaux, de liquides renversés ou de fortes salissures. Un forfait minimum de CHF 150 ne peut être exigé que s'il a été expressément convenu avant la conclusion du contrat et qu'il est approprié et juridiquement admissible dans le cas concret ; à défaut, les frais effectifs prouvés s'appliquent." },
          { kind: "clause", num: "7.9", text: "La perte, le vol ou l'endommagement des clés, du permis de circulation, des plaques de contrôle, des cartes de recharge ou des accessoires mis à disposition doivent être signalés sans délai. Le Locataire répond des frais de remplacement ou de remise en état nécessaires, appropriés et prouvés dans la mesure où il répond juridiquement de la perte ou du dommage." },
        ],
      },
      {
        num: "8",
        title: "Assurance, franchise et responsabilité",
        blocks: [
          { kind: "clause", num: "8.1", text: "Sont déterminantes la couverture d'assurance désignée dans le contrat de location et les conditions d'assurance applicables. Avant la conclusion du contrat, le Locataire est informé de la couverture convenue, d'une éventuelle franchise et des exclusions essentielles. Le Loueur ne peut promettre aucune couverture que le contrat d'assurance ne prévoit pas." },
          { kind: "clause", num: "8.2", text: "Une couverture d'assurance pour le transport professionnel de personnes, les courses de taxi ou via des plateformes, les trajets à l'étranger ou d'autres utilisations particulières n'existe que si l'utilisation concrète a été expressément convenue et est effectivement assurée." },
          { kind: "clause", num: "8.3", text: "Conformément à la loi et au contrat valable, le Locataire répond notamment :" },
          {
            kind: "lettered",
            items: [
              "a) des dommages au véhicule loué, dans la mesure où il les a causés par sa faute ou en répond en vertu de la loi ;",
              "b) d'une franchise expressément convenue, dans la mesure où il existe un sinistre couvert ou soumis à la franchise selon les conditions contractuelles et que le Locataire doit en répondre ;",
              "c) des dommages et frais non couverts, dans la mesure où ils lui sont juridiquement imputables ;",
              "d) des taxes de circulation et d'utilisation qui lui incombent juridiquement ainsi que des conséquences de ses infractions à la circulation routière ;",
              "e) des prétentions légitimes de tiers, dans la mesure où il en répond en vertu de la loi.",
            ],
          },
          { kind: "clause", num: "8.4", text: "Un dommage total, une moins-value, une perte d'usage, une perte de location et d'autres dommages consécutifs ne peuvent être réclamés que s'il existe une base légale ou contractuelle valable, qu'un dommage indemnisable et son montant sont prouvés, que le dommage est imputable au Locataire et qu'il n'en résulte aucune double indemnisation. Une éventuelle valeur résiduelle, les dépenses épargnées et une prise en compte appropriée de l'état du véhicule doivent être considérées dans la mesure où cela est juridiquement requis." },
          { kind: "clause", num: "8.5", text: "La responsabilité du Loueur est régie par le droit applicable. Une exclusion ou une limitation de la responsabilité ne s'applique que dans la mesure autorisée par la loi. Les dispositions impératives en matière de responsabilité, notamment les règles légales sur la responsabilité pour dol et faute grave, demeurent réservées." },
          { kind: "clause", num: "8.6", text: "Dans la mesure de ce qui peut raisonnablement être exigé, les deux parties doivent contribuer à prévenir et à limiter les dommages. Le Locataire doit informer le Loueur sans délai, prendre des mesures de protection raisonnables, ne pas compromettre fautivement la couverture d'assurance et collaborer de manière appropriée au règlement du sinistre." },
        ],
      },
      {
        num: "9",
        title: "Accident, panne, joignabilité et gestion des sinistres",
        blocks: [
          { kind: "clause", num: "9.1", text: "Joignabilité :" },
          { kind: "p", text: "Le Locataire s'assure que le numéro de téléphone indiqué lors de la réservation est en principe joignable pendant la durée de la location et que son téléphone mobile est suffisamment chargé. En cas d'accident, de panne ou de problème lié au véhicule, il doit répondre aux tentatives de rappel du Loueur dès que cela est raisonnablement possible. Dans la mesure où cela est sûr et raisonnablement exigible, il doit régler temporairement les fonctions silencieuses ou « Ne pas déranger » de manière à percevoir les rappels urgents. Une réponse dans les 10 minutes après avoir pris connaissance d'une tentative de rappel est attendue, dans la mesure où cela est possible et raisonnablement exigible dans les circonstances concrètes ; la sécurité, les mesures d'urgence, le sommeil, l'absence de réseau et d'autres empêchements légitimes priment. Entre 00:00 et 07:00 également, cette attente ne s'applique que dans les limites de ces restrictions." },
          { kind: "clause", num: "9.2", text: "Pannes et défauts techniques :" },
          { kind: "p", text: "En cas de panne, de message d'avertissement ou de défaut technique, le Locataire doit, si nécessaire, arrêter le véhicule dans un endroit sûr, prendre des mesures de signalisation et de protection et informer le Loueur par téléphone. Il doit suivre les instructions raisonnables et sûres. Si le Loueur n'est pas joignable, il doit en outre envoyer un message avec une brève description du problème et l'emplacement et attendre un rappel, dans la mesure où cela est sûr et raisonnablement exigible. Un temps d'attente de 15 minutes ne s'applique pas lorsqu'une action immédiate est nécessaire pour écarter un danger, sécuriser le lieu de l'accident ou éviter des dommages consécutifs importants." },
          { kind: "clause", num: "9.3", text: "Accidents entre 00:00 et 07:00 :" },
          {
            kind: "lettered",
            items: [
              "a) Le Locataire sécurise le lieu de l'accident, prodigue les premiers secours nécessaires et alerte sans délai les services d'urgence compétents en présence de blessés ou de danger immédiat. Il respecte les obligations légales de déclaration et les instructions des autorités.",
              "b) La police doit être avisée lorsque la loi l'exige ou que les circonstances le requièrent. En cas d'accident entre 00:00 et 07:00, le Locataire doit en principe contacter la police au 117 pour clarifier la marche à suivre, dans la mesure où cela est sûr et approprié au vu des circonstances. Cette exigence contractuelle ne doit retarder aucune mesure d'urgence et ne fonde aucune obligation d'agir contrairement aux instructions de la police.",
              "c) Dans la mesure où cela est sûr et possible, le Locataire documente les personnes impliquées, les coordonnées, les plaques de contrôle, les informations d'assurance, les témoins, le déroulement de l'accident et les dommages visibles. Dans la mesure du possible, il établit un constat d'accident et prend des photos probantes des véhicules, des dommages, des positions et du lieu de l'accident.",
              "d) Après avoir sécurisé le lieu de l'accident, le Locataire contacte le Loueur. Si celui-ci n'est pas joignable ou si une assistance dépannage est nécessaire, il convient de contacter le service de dépannage communiqué par le Loueur pour le véhicule concerné. Le numéro de téléphone et la référence de contrat nécessaires sont communiqués séparément dans les documents de remise ou dans les informations d'urgence propres au véhicule.",
              "e) Le Locataire conserve les photos, constats, numéros de référence de la police et justificatifs pertinents et les met à la disposition du Loueur dès que possible.",
            ],
          },
          { kind: "clause", num: "9.4", text: "Services de remorquage, services de dépannage et garages :" },
          { kind: "p", text: "Sans l'accord préalable du Loueur, le Locataire ne peut en principe mandater aucun service de remorquage, service de dépannage ni garage au nom ou aux frais du Loueur. Font exception les mesures immédiates nécessaires et proportionnées pour écarter un danger pour des personnes, sécuriser le véhicule ou éviter des dommages consécutifs importants, lorsqu'une prise de contact en temps utile n'est pas possible ou pas raisonnablement exigible. Le Loueur doit être informé dès que possible ; les justificatifs et les motifs doivent être documentés." },
          { kind: "clause", num: "9.5", text: "Frais d'un mandat non autorisé :" },
          { kind: "p", text: "Les frais d'un tiers mandaté sans l'autorisation requise ne peuvent être mis à la charge du Locataire que dans la mesure où le mandat constitue une violation du contrat qui lui est imputable, où les frais ont été effectivement encourus et sont nécessaires, appropriés et prouvés et où il existe une base légale ou contractuelle valable. Le simple défaut d'accord ne fonde pas automatiquement une obligation de paiement, notamment lorsqu'une mesure d'urgence nécessaire était en cause. Toute double facturation est exclue." },
          { kind: "clause", num: "9.6", text: "Accident, vol et autres déclarations de sinistre :" },
          { kind: "p", text: "En cas d'accident, le Locataire sécurise le lieu de l'accident, prodigue les premiers secours si nécessaire et alerte au besoin les services de sauvetage au 144. La police doit être avisée lorsque la loi l'exige ou que les circonstances le rendent nécessaire. Les accidents, dommages, vols, pertes et autres événements pertinents pour l'assurance doivent être déclarés au Loueur sans délai, si possible dans les 24 heures après en avoir eu connaissance. Si cela n'est pas possible ou pas raisonnablement exigible en raison de blessures, de mesures prises par les autorités ou d'autres motifs importants, la déclaration doit être faite sans délai dès que l'empêchement a cessé. Sans y être habilité, le Locataire ne peut faire aucune reconnaissance de dette contraignante ni conclure de transaction sur les prétentions du Loueur. Il doit collaborer de manière conforme à la vérité et appropriée à l'instruction du sinistre." },
          { kind: "clause", num: "9.7", text: "Limitation du dommage et sécurité :" },
          { kind: "p", text: "Le Locataire prend des mesures raisonnables pour limiter les dommages et les frais et conserve les justificatifs, photos et documents disponibles. Aucune disposition ne l'oblige à se mettre en danger ou à mettre des tiers en danger, à retarder les premiers secours nécessaires ou à violer des obligations légales." },
        ],
      },
      {
        num: "10",
        title: "Restitution, procès-verbal et véhicule de remplacement",
        blocks: [
          { kind: "clause", num: "10.1", text: "Le véhicule doit être restitué au lieu et au moment convenus avec l'ensemble des clés, documents, cartes et accessoires. Le Locataire ne peut pas laisser le véhicule sans surveillance à un autre endroit, sauf si le Loueur l'a expressément confirmé ou si une situation d'urgence ne laisse aucune alternative raisonnable." },
          { kind: "clause", num: "10.2", text: "Lors de la remise et de la restitution, l'état, les dommages existants, le kilométrage, le niveau de carburant ou de charge et les accessoires doivent être documentés. Des photos peuvent être utilisées en complément. Le Locataire doit recevoir une copie du procès-verbal ou pouvoir y accéder de manière appropriée." },
          { kind: "clause", num: "10.3", text: "Le Locataire doit signaler les défauts ou dommages reconnaissables lors de la prise en charge, si possible avant le départ, et les faire documenter. L'absence de signalement ne fonde pas à elle seule une responsabilité automatique pour un dommage dont il ne peut être prouvé qu'il a été causé par le Locataire. Les règles légales sur le fardeau de la preuve demeurent réservées." },
          { kind: "clause", num: "10.4", text: "Les nouveaux dommages constatés lors de la restitution doivent être documentés le plus rapidement possible et communiqués au Locataire. Si un contrôle n'est pas possible lors de la restitution, le Loueur doit communiquer ses constatations sans retard injustifié après leur découverte. La responsabilité est régie par la loi et le contrat." },
          { kind: "clause", num: "10.5", text: "Toute restitution tardive doit être communiquée au Loueur sans délai. La prolongation n'a d'effet obligatoire qu'après confirmation expresse. En cas de restitution tardive fautive et injustifiée, des indemnités convenues et juridiquement admissibles ainsi que d'autres dommages prouvés peuvent être réclamés. Une double indemnisation est exclue." },
          { kind: "clause", num: "10.6", text: "En cas de panne ou de défaut technique non imputable au Locataire, le Loueur s'efforce, selon les disponibilités et dans la mesure de ce qui est raisonnablement exigible sur le plan organisationnel, de proposer un véhicule de remplacement ou une autre solution appropriée. Un droit à un véhicule de remplacement équivalent n'existe que s'il a été expressément convenu ou est dû selon la loi. Les droits légaux impératifs demeurent réservés." },
          { kind: "clause", num: "10.7", text: "La restitution est réputée effectuée dès que le véhicule et les objets mis à disposition ont été effectivement remis au Loueur ou à une personne autorisée par lui, ou que le Loueur a confirmé la restitution d'une autre manière. Le simple fait de garer ou de laisser le véhicule sans procédure de restitution convenue ne suffit pas nécessairement." },
        ],
      },
      {
        num: "11",
        title: "Peines conventionnelles et forfaits",
        blocks: [
          { kind: "clause", num: "11.1", text: "Une peine conventionnelle n'est due que si elle a été convenue de manière claire, transparente et valable avant la conclusion du contrat, que l'état de fait concrètement désigné est réalisé et que les conditions légales sont remplies. L'aperçu ci-après ne s'applique que si le poste concerné figure dans le contrat de location individuel ou dans un aperçu des frais expressément intégré avant la conclusion du contrat :" },
          {
            kind: "list",
            items: [
              "Restitution tardive injustifiée : CHF 100 par jour civil entamé, pour autant que cette peine conventionnelle ait été valablement convenue, soit appropriée au vu des circonstances et juridiquement exécutoire. Elle n'est pas due automatiquement en plus d'une indemnité pour le même dommage.",
              "Indication fausse, essentielle et fautive de l'adresse de domicile ou de l'adresse postale : CHF 500, pour autant que l'indication soit déterminante pour la conclusion du contrat, la mise à disposition du véhicule ou l'exercice légitime de prétentions et que la peine soit appropriée dans le cas concret et valablement convenue.",
              "Mise à disposition du véhicule à un conducteur non autorisé : CHF 500, pour autant que la peine ait été valablement convenue et soit juridiquement exécutoire dans le cas concret.",
              "Fumer ou vapoter dans le véhicule : CHF 250, pour autant que la peine ait été valablement convenue et soit appropriée ; des frais de nettoyage supplémentaires prouvés ne peuvent être réclamés que sous imputation d'un éventuel poste déjà rémunéré.",
              "Manipulation, retrait ou désactivation non autorisée, intentionnels ou fautifs, d'un système GPS ou de localisation : CHF 800, pour autant que la peine ait été valablement convenue et soit appropriée et juridiquement exécutoire dans le cas concret.",
              "Violation essentielle et fautive de l'obligation de déclarer un accident : CHF 500, pour autant que la peine ait été valablement convenue, que la violation soit importante et que la peine soit appropriée dans le cas concret.",
            ],
          },
          { kind: "p", text: "Dommages aux pneus et aux jantes : Le chiffre 7.6 s'applique. D'éventuels frais de traitement sont régis exclusivement par le chiffre 7.6(e) et ne peuvent couvrir au plus que le montant qui y est indiqué ainsi que la charge de traitement effectivement encourue, appropriée et juridiquement indemnisable. Ils ne sont pas dus automatiquement. Une peine conventionnelle forfaitaire supplémentaire de CHF 100.– par pneu n'est pas fondée par la seule présente disposition." },
          { kind: "clause", num: "11.2", text: "La peine conventionnelle ne libère pas le Locataire de l'obligation de mettre fin à une violation du contrat, de restituer le véhicule ou de respecter les obligations légales de collaboration." },
          { kind: "clause", num: "11.3", text: "Les peines conventionnelles excessives peuvent être réduites par le tribunal compétent conformément à l'art. 163 al. 3 CO." },
          { kind: "clause", num: "11.4", text: "Des dommages-intérêts supplémentaires ne peuvent être réclamés que dans la mesure où la loi le permet, qu'un dommage supplémentaire a été prouvé et qu'il n'en résulte aucune double indemnisation. Les peines conventionnelles ou indemnités déjà payées doivent être imputées dans le calcul dans la mesure où elles couvrent le même dommage." },
        ],
      },
      {
        num: "12",
        title: "Caution, retard de paiement et frais",
        blocks: [
          { kind: "clause", num: "12.1", text: "Le montant, le mode de paiement, l'échéance et l'utilisation admissible de la caution ainsi que les moyens de paiement acceptés sont fixés avant la conclusion du contrat dans le contrat de location ou dans les conditions de réservation." },
          { kind: "clause", num: "12.2", text: "La caution sert à garantir les créances légitimes découlant de la relation de location. Le Loueur ne peut imputer que des créances effectivement dues, exigibles et juridiquement compensables et doit détailler les déductions de manière compréhensible. Les droits légaux impératifs demeurent réservés." },
          { kind: "clause", num: "12.3", text: "Si, lors de la restitution, une prétention concrète ne peut pas encore être chiffrée définitivement, seule une partie appropriée de la caution peut être retenue, pour autant qu'il existe une base juridique à cet effet et que le montant soit dans un rapport raisonnable avec la créance attendue. Le solde non contesté et non nécessaire est remboursé sans retard injustifié. La simple possibilité abstraite de créances futures ne justifie pas une rétention illimitée." },
          { kind: "clause", num: "12.4", text: "Le Loueur s'efforce de rembourser la caution sans délai après la restitution en bonne et due forme du véhicule et les contrôles nécessaires. En l'absence de créances ouvertes concrètes et fondées, le remboursement doit être initié au plus tard dans les 10 jours ouvrables. Le moment effectif du crédit peut dépendre de la banque ou du prestataire de services de paiement. Le chiffre 12.3 s'applique aux créances concrètes qui ne peuvent pas encore être chiffrées." },
          { kind: "clause", num: "12.5", text: "Les frais suivants ne peuvent être perçus que s'ils ont été convenus de manière expresse et transparente avant la conclusion du contrat, qu'ils sont juridiquement admissibles et appropriés dans le cas concret et qu'aucune règle légale impérative ne s'y oppose :" },
          {
            kind: "list",
            items: [
              "Traitement d'une amende de circulation ou d'une demande d'une autorité concernant le détenteur : CHF 20 par cas ;",
              "Rappel en cas de retard de paiement : CHF 20 par rappel, dans la mesure où cela est juridiquement admissible ;",
              "Charge administrative interne liée à une poursuite : CHF 80, dans la mesure où cela est juridiquement admissible et approprié ;",
              "Organisation d'une récupération nécessaire du véhicule : au moins CHF 400, uniquement dans la mesure où il existe une base valable et que le montant est approprié dans le cas concret ; les frais de tiers effectivement encourus ne peuvent être réclamés en sus que dans la mesure où il n'y a pas de double facturation ;",
              "Gardiennage du véhicule : CHF 50 par jour, uniquement dans la mesure où il existe une base valable et que les frais ne dépassent pas de manière inappropriée les coûts effectifs, appropriés et imputables.",
            ],
          },
          { kind: "clause", num: "12.6", text: "Les frais externes, les émoluments officiels et les frais de traitement internes doivent être distingués les uns des autres. Sur demande, le Loueur communique le calcul et les justificatifs disponibles dans une mesure appropriée. Les frais externes ne peuvent être facturés que s'ils ont été effectivement encourus et sont nécessaires, appropriés, juridiquement imputables et indemnisables." },
          { kind: "clause", num: "12.7", text: "Toute facturation multiple de la même dépense ou du même dommage sous différents postes de frais ou de dommages-intérêts est exclue. Les intérêts moratoires légaux et les frais d'encaissement ou de procédure effectivement dus demeurent réservés, dans la mesure où les conditions légales sont remplies." },
        ],
      },
      {
        num: "13",
        title: "Réclamation du véhicule et démarches juridiques",
        blocks: [
          { kind: "clause", num: "13.1", text: "À l'expiration de la durée de location convenue ou après qu'il a été valablement mis fin au contrat de location, le Locataire doit restituer le véhicule dans les délais." },
          { kind: "clause", num: "13.2", text: "Si la restitution n'a pas lieu, le Loueur peut exiger la restitution et, dans la mesure où cela est approprié ou légalement requis, impartir un délai. En cas d'urgence ou de mise en danger concrète du véhicule, les mesures urgentes licites demeurent réservées." },
          { kind: "clause", num: "13.3", text: "Les frais appropriés, nécessaires et prouvés d'une récupération du véhicule peuvent être mis à la charge du Locataire dans la mesure où celui-ci a causé la récupération par sa faute et qu'il existe une base légale ou contractuelle valable." },
          { kind: "clause", num: "13.4", text: "En cas de retard de paiement important, de remise non autorisée à des tiers, de manipulation de dispositifs de sécurité ou d'autres violations essentielles du contrat, le Loueur peut prendre des mesures proportionnées et autorisées par la loi pour sécuriser et réclamer le véhicule. Il ne peut ce faisant recourir à aucune justice propre illicite ni porter atteinte aux droits de tiers." },
          { kind: "clause", num: "13.5", text: "En cas de non-restitution ou d'autres violations importantes du contrat, le Loueur peut faire valoir ses prétentions de droit civil et, le cas échéant, informer les autorités compétentes. Une restitution tardive ou une autre violation du contrat ne constitue pas automatiquement une infraction pénale ; l'appréciation pénale incombe aux autorités et tribunaux compétents." },
        ],
      },
      {
        num: "14",
        title: "Suivi GPS, localisation du véhicule et immobilisation à distance",
        blocks: [
          { kind: "clause", num: "14.1", text: "Le véhicule peut être équipé d'une localisation GPS ou d'un système de gestion de flotte. Les données de localisation et du véhicule ne peuvent être traitées que sur une base juridique admissible et à des fins déterminées, légitimes et proportionnées, notamment pour la prévention du vol, la sécurisation du véhicule, la gestion de flotte, le diagnostic technique ou la réclamation licite du véhicule." },
          { kind: "clause", num: "14.2", text: "Avant ou lors de la collecte des données, le Loueur met à disposition une déclaration de protection des données accessible, contenant les informations requises par le droit de la protection des données en vigueur. En font notamment partie l'identité et les coordonnées du responsable du traitement, les finalités du traitement, les catégories de données, les destinataires ou catégories de destinataires, la durée de conservation ou les critères permettant de la déterminer, les éventuelles communications à l'étranger et les droits des personnes concernées." },
          { kind: "clause", num: "14.3", text: "Les données de localisation ne sont conservées que dans la mesure nécessaire et aussi longtemps que nécessaire. Seules les personnes et prestataires autorisés y ont accès. Des mesures de sécurité techniques et organisationnelles appropriées doivent être prises. Elles ne sont communiquées que sur une base juridique admissible." },
          { kind: "clause", num: "14.4", text: "Le Locataire ne peut ni manipuler, ni retirer, ni endommager, ni désactiver sans autorisation les dispositifs de localisation et de sécurité. Les dysfonctionnements doivent être signalés sans délai au Loueur." },
          { kind: "clause", num: "14.5", text: "Une immobilisation technique à distance ne peut être utilisée que si elle est juridiquement admissible, nécessaire et proportionnée dans le cas concret. Elle ne peut notamment pas intervenir pendant la conduite ni dans une situation où elle pourrait mettre en danger le conducteur, les passagers ou d'autres usagers de la route. Une immobilisation ne peut pas servir de moyen de pression inadmissible pour recouvrer des créances contestées. La réclamation du véhicule doit se faire par des voies légales." },
          { kind: "clause", num: "14.6", text: "La responsabilité en lien avec la localisation, l'immobilisation à distance et la réclamation du véhicule est régie par le droit applicable. Les dispositions impératives en matière de responsabilité demeurent réservées." },
        ],
      },
      {
        num: "15",
        title: "Identité, informations et obligations de collaborer",
        blocks: [
          { kind: "clause", num: "15.1", text: "Le Locataire confirme que ses informations ainsi que les documents d'identité, permis de conduire, autorisations et autres documents qu'il a présentés sont, au mieux de ses connaissances, complets, exacts et valables." },
          { kind: "clause", num: "15.2", text: "Cela concerne notamment le nom, l'identité, la date de naissance, l'adresse de domicile et l'adresse postale, les coordonnées, les données de paiement ainsi que les droits de conduire et autorisations nécessaires à l'utilisation convenue du véhicule." },
          { kind: "clause", num: "15.3", text: "Les modifications importantes des coordonnées ou de l'adresse postale ainsi que la perte d'un droit de conduire requis doivent être communiquées sans délai au Loueur." },
          { kind: "clause", num: "15.4", text: "En cas de motif objectif, le Loueur peut exiger des justificatifs actuels dans la mesure où cela est nécessaire, proportionné et admissible au regard de la protection des données pour la conclusion du contrat, la remise sûre du véhicule, l'exécution de la relation de location ou l'exercice légitime de prétentions." },
          { kind: "clause", num: "15.5", text: "Des indications intentionnellement fausses ou trompeuses ainsi que des documents falsifiés ou non valables peuvent constituer une violation essentielle du contrat. Les autorités et tribunaux compétents apprécient si les faits sont pertinents sur le plan pénal." },
          { kind: "clause", num: "15.6", text: "Le Locataire répond, conformément aux dispositions légales, des dommages prouvés et juridiquement imputables qu'il cause par sa faute au moyen d'indications fausses ou de documents inexacts. Les pertes de location indemnisables, les frais de rapatriement du véhicule ainsi que les frais d'encaissement et de procédure nécessaires ne peuvent être réclamés que dans la mesure où ils sont indemnisables selon la loi, appropriés et prouvés. Une double indemnisation est exclue." },
        ],
      },
      {
        num: "16",
        title: "Transport professionnel de personnes et utilisation de plateformes",
        blocks: [
          { kind: "clause", num: "16.1", text: "Le transport professionnel de personnes, les courses de taxi ou via des plateformes ne sont autorisés que s'ils ont été expressément convenus dans le contrat de location individuel." },
          { kind: "clause", num: "16.2", text: "Pendant toute la durée de la location, le Locataire est responsable du respect des conditions légales, administratives et contractuelles applicables à l'usage convenu. En font notamment partie les droits de conduire requis, les autorisations et les prescriptions applicables au transport professionnel de personnes." },
          { kind: "clause", num: "16.3", text: "Le Locataire ne peut utiliser le véhicule que pour l'usage convenu et doit s'assurer que l'immatriculation, l'équipement et la couverture d'assurance effective du véhicule permettent cet usage. Le Loueur ne garantit ni l'admission par une plateforme, ni un chiffre d'affaires déterminé, ni un nombre déterminé de courses, ni une disponibilité ininterrompue du véhicule." },
          { kind: "clause", num: "16.4", text: "Le Locataire informe sans délai le Loueur de la perte, de la restriction ou du retrait d'une autorisation nécessaire à l'usage convenu. Si une condition essentielle n'est plus remplie, le Loueur peut interdire la poursuite de l'utilisation et exiger la restitution conformément au droit applicable." },
        ],
      },
      {
        num: "17",
        title: "Protection des données et communications",
        blocks: [
          { kind: "clause", num: "17.1", text: "Le Loueur traite des données personnelles pour traiter les demandes, conclure et exécuter le contrat de location, traiter les paiements, remplir ses obligations légales, gérer les sinistres, gérer et sécuriser les véhicules et préserver des intérêts légitimes, dans la mesure autorisée par la loi." },
          { kind: "clause", num: "17.2", text: "Les détails relatifs au traitement des données personnelles, notamment sur les destinataires, les durées de conservation, les communications à l'étranger, les données GPS et de localisation ainsi que les droits des personnes concernées, figurent dans la déclaration de protection des données distincte. Celle-ci est facilement accessible et doit être disponible de manière appropriée avant ou lors de la collecte des données. Les présentes CGV ne remplacent pas la déclaration de protection des données." },
          { kind: "clause", num: "17.3", text: "Les communications relatives à la relation de location peuvent être envoyées aux adresses de contact postales et électroniques indiquées dans le contrat de location, dans la mesure où la communication concernée est juridiquement admissible sous cette forme. Pour les déclarations soumises à une forme légale, les prescriptions légales de forme demeurent réservées." },
          { kind: "clause", num: "17.4", text: "Le Locataire doit communiquer sans délai les modifications importantes de ses coordonnées et de son adresse postale. Le Loueur peut envoyer les communications nécessaires à la dernière adresse valablement communiquée, dans la mesure où la loi le permet ; les règles impératives relatives à la réception des déclarations demeurent réservées." },
        ],
      },
      {
        num: "18",
        title: "Dispositions finales",
        blocks: [
          { kind: "clause", num: "18.1", text: "Intégralité de l'accord :" },
          { kind: "p", text: "Le contrat de location individuel, les présentes CGV et les conventions complémentaires expressément intégrées constituent l'accord des parties relatif à la relation de location concernée. Les dispositions négociées individuellement et expressément dérogatoires prévalent sur les présentes CGV." },
          { kind: "clause", num: "18.2", text: "Modifications :" },
          { kind: "p", text: "Les modifications et compléments requièrent la forme textuelle, à moins que la loi n'exige une forme plus stricte ou que les parties n'aient valablement convenu d'une forme plus stricte. Les exigences légales relatives aux modifications du contrat et à la preuve d'un accord demeurent réservées." },
          { kind: "clause", num: "18.3", text: "Absence de renonciation :" },
          { kind: "p", text: "Le non-exercice temporaire ou l'exercice tardif d'un droit ne vaut pas en soi renonciation à ce droit." },
          { kind: "clause", num: "18.4", text: "Force majeure :" },
          { kind: "p", text: "Dans la mesure autorisée par la loi, aucune partie ne répond des perturbations dans l'exécution des prestations directement imputables à des événements extraordinaires, échappant à tout contrôle et inévitables malgré la diligence raisonnablement exigible. La partie concernée en informe l'autre partie sans délai dans la mesure du possible et prend des mesures raisonnables pour en limiter les effets. Les droits légaux et les règles de responsabilité impératifs demeurent réservés." },
          { kind: "clause", num: "18.5", text: "Nullité partielle :" },
          { kind: "p", text: "Si une disposition des présentes CGV est ou devient invalide ou inexécutable en tout ou en partie, les autres dispositions demeurent en vigueur dans la mesure autorisée par la loi. Les dispositions légales applicables remplacent la disposition invalide. La présente clause ne prévoit aucun remplacement automatique par une disposition aussi proche que possible sur le plan économique." },
          { kind: "clause", num: "18.6", text: "Droit applicable :" },
          { kind: "p", text: "Le droit matériel suisse est applicable, dans la mesure où son application est autorisée par la loi. Les dispositions impératives du droit international privé et les dispositions protectrices impératives, notamment en faveur des consommateurs, demeurent réservées." },
          { kind: "clause", num: "18.7", text: "For à Zurich :" },
          { kind: "p", text: "Dans la mesure où une élection de for est autorisée par la loi, Zurich, Suisse, est convenu comme for pour les litiges découlant de la relation de location ou en lien avec celle-ci. Les fors légaux impératifs et les restrictions applicables aux contrats conclus avec des consommateurs demeurent réservés. Dans la mesure où une élection de for préalable n'est pas autorisée ou pas valable, les fors légaux s'appliquent." },
        ],
      },
    ],
  },
};

export default gtc;
