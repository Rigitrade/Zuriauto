// AUTO-GENERATED from the signed GTC PDFs supplied 2026-07-29. Do not hand-edit.
//
//   AGB_GTC_Zuriauto_07.2026_DE.pdf
//   GTC_Zuriauto_30.07.2026_EN.pdf
//   GTC_Zuriauto_30.07.2026_FR.pdf
//
// Every paragraph, list item and table cell below was verified to occur in the
// source documents. To change the terms, replace the PDFs and regenerate rather
// than editing this file, so the site cannot drift from the signed documents.

export type GtcBlock =
  | { kind: "p"; text: string }
  | { kind: "sub"; title: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: [string, string] | null; rows: [string, string][] };

export type GtcSection = {
  num: string;
  title: string;
  blocks: GtcBlock[];
};

export type GtcDocument = {
  title: string;
  updated: string;
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
export const GTC_DATE = "30.07.2026";

const gtc: Record<GtcLanguage, GtcDocument> = {
  "de": {
    "title": "AGB Allgemeine Geschäftsbedingungen",
    "updated": "Updated 30.07.2026 / AK",
    "sections": [
      {
        "num": "1",
        "title": "Geltungsbereich & Vertragsbestandteil",
        "blocks": [
          {
            "kind": "p",
            "text": "Diese GTC gelten für sämtliche Fahrzeugmietverträge der Rigitrade AG („Vermieterin“). Mit Unterzeichnung erkennt der Mieter diese GTC vollumfänglich an."
          }
        ]
      },
      {
        "num": "2",
        "title": "Nutzungsverbote & Konsequenzen",
        "blocks": [
          {
            "kind": "sub",
            "title": "2.1 Absolute Verbote"
          },
          {
            "kind": "p",
            "text": "Ausschliesslich privater oder berufsmässiger Personentransport (Uber/Bolt). Streng verboten: a) Weitergabe an Dritte, Untervermietung, Verkauf; b) Nutzung zur Begehung strafbarer Handlungen; c) Fahren unter Alkohol-/Drogeneinfluss; d) Unerlaubte Grenzüberschreitung; e) Rauchen (inkl. E-Zigaretten); f) GPS-Manipulation/-Deaktivierung."
          },
          {
            "kind": "sub",
            "title": "2.2 Konsequenzen"
          },
          {
            "kind": "p",
            "text": "Die Vermieterin ist berechtigt, den Mietvertrag fristlos zu kündigen. Schadenersatzansprüche sowie die Einleitung zivil- und strafrechtlicher Schritte bleiben vorbehalten."
          }
        ]
      },
      {
        "num": "3",
        "title": "Kosten, Betrieb, Personentransport-Voraussetzungen & Fahrzeugunterhalt",
        "blocks": [
          {
            "kind": "sub",
            "title": "3.1 Mieterkosten"
          },
          {
            "kind": "p",
            "text": "Treibstoff (Bleifrei 95/98), Reinigung, Parkgebühren, Vignette/Maut, Verwaltungsgebühren, Abschlepp- und Standkosten."
          },
          {
            "kind": "sub",
            "title": "3.2 Vermieterkosten"
          },
          {
            "kind": "p",
            "text": "Reguläre Servicearbeiten, Saisonreifen, mechanische Reparaturen (ohne Fehlbedienung), Motorfahrzeugsteuer, Motorfahrzeughaftpflichtversicherung."
          },
          {
            "kind": "sub",
            "title": "3.3 Sorgfalts- und Prüfpflichten"
          },
          {
            "kind": "p",
            "text": "Vor Fahrtantritt sind Ölstand, Kühlmittel, Reifendruck, Beleuchtung und Armaturenbrett-Warnleuchten zu prüfen. Bei Warnleuchten Fahrt sofort unterbrechen und Vermieterin informieren."
          },
          {
            "kind": "sub",
            "title": "3.4 Sauberkeit"
          },
          {
            "kind": "p",
            "text": "Das Fahrzeug ist in sauberem Zustand zurückzugeben. Bei übermässiger Verschmutzung (die eine professionelle Spezialreinigung erfordert) werden die effektiven Reinigungskosten, mindestens jedoch CHF 150.00, dem Mieter belastet."
          },
          {
            "kind": "sub",
            "title": "3.5 Schlüssel, Dokumente, Ladekarten & Kontrollschilder"
          },
          {
            "kind": "p",
            "text": "Der Verlust von Fahrzeugschlüsseln, dem Fahrzeugausweis, Kontrollschildern oder bereitgestellten Ladekarten ist der Vermieterin sofort zu melden. Der Mieter haftet für die Kosten der Ersatzbeschaffung sowie für sämtliche damit verbundenen administrativen Kosten und Aufwände."
          },
          {
            "kind": "sub",
            "title": "3.6 Voraussetzungen für den Personentransport"
          },
          {
            "kind": "p",
            "text": "Der Mieter ist verpflichtet, sämtliche gesetzlichen und behördlichen Voraussetzungen für den berufsmässigen Personentransport während der gesamten Mietdauer einzuhalten. Er trägt die Verantwortung dafür, dass alle hierfür erforderlichen Bewilligungen und Berechtigungen (einschliesslich der Einhaltung der Anforderungen der jeweils genutzten Vermittlungsplattformen wie z.B. Uber oder Bolt sowie BPT- Berechtigungen) gültig sind."
          }
        ]
      },
      {
        "num": "4",
        "title": "Versicherung & Haftung",
        "blocks": [
          {
            "kind": "sub",
            "title": "4.1 Versicherung"
          },
          {
            "kind": "p",
            "text": "Soweit im Mietvertrag angegeben, verfügt das Fahrzeug über eine Versicherung für berufsmässigen Personentransport (BPT)."
          },
          {
            "kind": "sub",
            "title": "4.2 Haftung Mieter"
          },
          {
            "kind": "p",
            "text": "Der Mieter haftet im gesetzlich zulässigen Umfang für Selbstbehalte, Verkehrsverstösse/Bussen, berechtigte Ansprüche Dritter (soweit diese vom Mieter verursacht wurden), Schäden ausserhalb der Versicherung / grobe Fahrlässigkeit / Vorsatz sowie für den vereinbarten Selbstbehalt bzw. die Mehrkosten bei Totalschaden, sofern diese nicht durch die Versicherung gedeckt sind."
          }
        ]
      },
      {
        "num": "5",
        "title": "Konventionalstrafen (Art. 160 ff. OR)",
        "blocks": [
          {
            "kind": "p",
            "text": "Die Geltendmachung eines darüber hinausgehenden Schadens bleibt vorbehalten."
          },
          {
            "kind": "p",
            "text": "Bereits geleistete Konventionalstrafen werden auf einen nachgewiesenen Schaden angerechnet, soweit gesetzlich erforderlich. Bei Vertragsverletzungen werden folgende pauschale Konventionalstrafen fällig:"
          },
          {
            "kind": "table",
            "head": [
              "Vertragsverletzung",
              "Konventionalstrafe"
            ],
            "rows": [
              [
                "Verspätete Rückgabe (pro angefangenem Tag)",
                "CHF 100.00"
              ],
              [
                "Falsche Adresse",
                "CHF 500.00"
              ],
              [
                "Unautorisierter Fahrer",
                "CHF 500.00"
              ],
              [
                "Rauchen im Fahrzeug",
                "CHF 250.00"
              ],
              [
                "GPS-Manipulation oder -Deaktivierung",
                "CHF 800.00"
              ],
              [
                "Unterlassene Unfallmeldung",
                "CHF 500.00"
              ]
            ]
          }
        ]
      },
      {
        "num": "6",
        "title": "GPS-Tracking & Fernstilllegung (Immobilisierung)",
        "blocks": [
          {
            "kind": "p",
            "text": "Das Fahrzeug ist mit einem GPS-System ausgestattet, welches zu Zwecken der Diebstahlsicherung, des Flottenmanagements, der Einhaltung von Geofences sowie zur Durchsetzung von Sicherheitsmassnahmen eingesetzt wird. Der Mieter nimmt zur Kenntnis und stimmt ausdrücklich zu, dass die Vermieterin im Falle eines Zahlungsverzugs (insbesondere bei ausbleibendem Mietzins gemäss Vertrag) oder bei einer wesentlichen Vertragsverletzung (unter anderem unautorisierte Weitergabe, GPS-Manipulation oder Missbrauch) berechtigt ist, eine Fernstilllegung (Immobilisierung) des Fahrzeugs vorzunehmen und zur Sicherung ihres Eigentums einzuziehen, sofern dies technisch möglich und gesetzlich zulässig ist. Soweit gesetzlich zulässig, bestehen bei einer rechtmässigen Fernstilllegung (Immobilisierung) keine vertraglichen Schadenersatzansprüche des Mieters."
          }
        ]
      },
      {
        "num": "7",
        "title": "Rückgabe des Fahrzeugs & Ersatzfahrzeug",
        "blocks": [
          {
            "kind": "sub",
            "title": "7.1 Rückgabe"
          },
          {
            "kind": "p",
            "text": "Das Fahrzeug ist mit sämtlichen Schlüsseln, Dokumenten und Zubehör im gleichen Zustand wie übernommen zurückzugeben, unter Berücksichtigung der gewöhnlichen Abnutzung."
          },
          {
            "kind": "sub",
            "title": "7.2 Ersatzfahrzeug bei Panne"
          },
          {
            "kind": "p",
            "text": "Bei einem unverschuldeten technischen Defekt oder Ausfall des Mietfahrzeugs ist die Vermieterin bemüht, nach Verfügbarkeit ein gleichwertiges Ersatzfahrzeug zur Verfügung zu stellen. Ein genereller Anspruch auf ein Ersatzfahrzeug besteht jedoch vorbehaltlich ausdrücklicher schriftlicher Zusicherung nicht; soweit gesetzlich zulässig, sind weitergehende Schadenersatzansprüche des Mieters ausgeschlossen."
          }
        ]
      },
      {
        "num": "8",
        "title": "Unfall-, Pannen- & Schadenprozedur",
        "blocks": [
          {
            "kind": "p",
            "text": "Unfallprozedur: Unfallstelle sichern, Verletzte versorgen, Notruf 144, Polizei rufen (bei Personenschaden, unklarer Schuld oder wenn dies gesetzlich vorgeschrieben ist), kein Schuldeingeständnis, Fotos machen, Unfallrapport ausfüllen, Vermieterin innert 24h informieren (Konventionalstrafe CHF 500.- bei Missachtung)."
          },
          {
            "kind": "p",
            "text": "Pannenprozedur: Bei technischen Defekten darf der Mieter Reparaturen nur nach vorheriger Zustimmung der Vermieterin veranlassen, ausser es handelt sich um Sofortmassnahmen zur Gefahrenabwehr."
          }
        ]
      },
      {
        "num": "9",
        "title": "Rechtliche Hinweise & Vorbehalte",
        "blocks": [
          {
            "kind": "p",
            "text": "Wird das Fahrzeug nach Vertragsende oder nach einer fristlosen Kündigung trotz Aufforderung nicht fristgerecht zurückgegeben, behält sich die Vermieterin vor, den Sachverhalt rechtlich prüfen zu lassen und gegebenenfalls die zuständigen Strafverfolgungsbehörden einzuschalten. Je nach den konkreten Umständen können strafrechtliche Tatbestände erfüllt sein."
          }
        ]
      },
      {
        "num": "10",
        "title": "Verwaltungsgebühren",
        "blocks": [
          {
            "kind": "p",
            "text": "Für den entstandenen administrativen Aufwand können folgende Gebühren erhoben werden:"
          },
          {
            "kind": "table",
            "head": [
              "Verwaltungsgebühr",
              "Betrag"
            ],
            "rows": [
              [
                "Bearbeitungsgebühr für Verkehrsbusse",
                "CHF 20.-"
              ],
              [
                "Bearbeitungsgebühr Mahnung",
                "CHF 20.-"
              ],
              [
                "Bearbeitungsgebühr Betreibungseinleitung",
                "CHF 80.-"
              ],
              [
                "Fahrzeugrückholung",
                "mindestens CHF 400.00 zuzüglich der effektiv entstandenen Kosten."
              ],
              [
                "Verwahrungskosten (pro Tag)",
                "CHF 50.00"
              ]
            ]
          }
        ]
      },
      {
        "num": "11",
        "title": "Allgemeine Bestimmungen",
        "blocks": [
          {
            "kind": "p",
            "text": "(No Waiver, Höhere Gewalt, Salvatorische Klausel, Entire Agreement) No Waiver Clause: Unterlässt die Vermieterin die Durchsetzung einzelner Rechte, gilt dies nicht als Verzicht auf diese Rechte."
          },
          {
            "kind": "p",
            "text": "Höhere Gewalt: Die Vermieterin haftet nicht für Leistungshindernisse infolge höherer Gewalt."
          },
          {
            "kind": "p",
            "text": "Gesamte Vereinbarung (Entire Agreement): Dieser Vertrag und die GTC bilden die vollständige Vereinbarung zwischen den Parteien. Frühere mündliche oder schriftliche Abreden werden ersetzt."
          },
          {
            "kind": "p",
            "text": "Salvatorische Klausel: Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, bleibt die Gültigkeit der übrigen Bestimmungen hiervon unberührt."
          },
          {
            "kind": "p",
            "text": "Schlussbestimmungen: Schriftform für Änderungen. Es gilt ausschliesslich schweizerisches Recht. Gerichtsstand ist Embrach, soweit gesetzlich zulässig."
          }
        ]
      }
    ]
  },
  "en": {
    "title": "General Terms & Conditions (GTC)",
    "updated": "Updated: 30 July 2026 / AK",
    "sections": [
      {
        "num": "1",
        "title": "Scope of Application & Contractual Incorporation",
        "blocks": [
          {
            "kind": "p",
            "text": "These General Terms & Conditions (\"GTC\") apply to all vehicle rental agreements concluded with Rigitrade AG (the \"Lessor\"). By signing the rental agreement, the Renter acknowledges and accepts these GTC in their entirety as an integral part of the rental agreement."
          }
        ]
      },
      {
        "num": "2",
        "title": "Prohibited Use & Consequences",
        "blocks": [
          {
            "kind": "sub",
            "title": "2.1 Strictly Prohibited Uses"
          },
          {
            "kind": "p",
            "text": "The rented vehicle may only be used for private use or professional passenger transportation services (e.g. Uber/Bolt)."
          },
          {
            "kind": "p",
            "text": "The following are strictly prohibited:"
          },
          {
            "kind": "list",
            "items": [
              "a) Transferring the vehicle to third parties, subletting, or selling the vehicle;",
              "b) Using the vehicle to commit or facilitate criminal offences;",
              "c) Driving under the influence of alcohol or drugs;",
              "d) Unauthorized cross-border use;",
              "e) Smoking inside the vehicle, including electronic cigarettes (e-cigarettes);",
              "f) Tampering with, disabling, or interfering with the vehicle's GPS tracking system."
            ]
          },
          {
            "kind": "sub",
            "title": "2.2 Consequences"
          },
          {
            "kind": "p",
            "text": "The Lessor shall be entitled to terminate the rental agreement with immediate effect without prior notice. The Lessor further reserves the right to claim damages and to initiate civil and/or criminal proceedings where appropriate."
          }
        ]
      },
      {
        "num": "3",
        "title": "Costs, Vehicle Operation, Passenger Transport Requirements & Vehicle",
        "blocks": [
          {
            "kind": "p",
            "text": "Maintenance"
          },
          {
            "kind": "sub",
            "title": "3.1 Costs Payable by the Renter"
          },
          {
            "kind": "p",
            "text": "The Renter shall bear the following costs:"
          },
          {
            "kind": "list",
            "items": [
              "Fuel (Unleaded 95 or 98)",
              "Vehicle cleaning",
              "Parking fees",
              "Road tolls, motorway vignette and similar charges",
              "Administrative fees",
              "Towing and vehicle storage charges"
            ]
          },
          {
            "kind": "sub",
            "title": "3.2 Costs Payable by the Lessor"
          },
          {
            "kind": "p",
            "text": "The Lessor shall bear the costs of:"
          },
          {
            "kind": "list",
            "items": [
              "Regular scheduled servicing",
              "Seasonal tire replacement",
              "Mechanical repairs not caused by misuse or improper operation",
              "Motor vehicle tax",
              "Mandatory motor vehicle liability insurance"
            ]
          },
          {
            "kind": "sub",
            "title": "3.3 Duty of Care & Vehicle Inspection"
          },
          {
            "kind": "p",
            "text": "Before each journey, the Renter shall check:"
          },
          {
            "kind": "list",
            "items": [
              "Engine oil level",
              "Coolant level",
              "Tire pressure",
              "Vehicle lights",
              "Dashboard warning indicators"
            ]
          },
          {
            "kind": "p",
            "text": "If any warning light appears during operation, the Renter must stop driving immediately and notify the Lessor without delay."
          },
          {
            "kind": "sub",
            "title": "3.4 Vehicle Cleanliness"
          },
          {
            "kind": "p",
            "text": "The vehicle must be returned in a clean condition."
          },
          {
            "kind": "p",
            "text": "Where excessive soiling requires professional specialist cleaning, the Renter shall be charged the actual cleaning costs, subject to a minimum charge of CHF 150.00."
          },
          {
            "kind": "sub",
            "title": "3.5 Keys, Documents, Charging Cards & License Plates"
          },
          {
            "kind": "p",
            "text": "Loss of vehicle keys, the vehicle registration certificate, license plates, or any charging cards provided with the vehicle must be reported to the Lessor immediately."
          },
          {
            "kind": "p",
            "text": "The Renter shall be liable for all replacement costs together with all associated administrative costs and expenses."
          },
          {
            "kind": "sub",
            "title": "3.6 Passenger Transport Requirements"
          },
          {
            "kind": "p",
            "text": "Throughout the rental period, the Renter is responsible for complying with all legal and regulatory requirements applicable to professional passenger transportation."
          },
          {
            "kind": "p",
            "text": "The Renter shall ensure that all required licenses, permits, and authorizations remain valid at all times, including compliance with the requirements of any ride- hailing platform used (such as Uber or Bolt) and any required Professional Passenger Transport (BPT) authorizations."
          }
        ]
      },
      {
        "num": "4",
        "title": "Insurance & Liability",
        "blocks": [
          {
            "kind": "sub",
            "title": "4.1 Insurance"
          },
          {
            "kind": "p",
            "text": "Where specified in the rental agreement, the vehicle is insured for professional passenger transportation (BPT)."
          },
          {
            "kind": "sub",
            "title": "4.2 Renter's Liability"
          },
          {
            "kind": "p",
            "text": "To the extent permitted by applicable law, the Renter shall be liable for:"
          },
          {
            "kind": "list",
            "items": [
              "Insurance deductibles (excess)",
              "Traffic offences and fines",
              "Legitimate third-party claims caused by the Renter",
              "Damage not covered by insurance",
              "Damage resulting from gross negligence or intentional misconduct",
              "The agreed insurance deductible and/or any additional costs arising from a total loss where such costs are not covered by insurance"
            ]
          }
        ]
      },
      {
        "num": "5",
        "title": "Contractual Penalties",
        "blocks": [
          {
            "kind": "p",
            "text": "(Articles 160 et seq. Swiss Code of Obligations) The Lessor reserves the right to claim damages exceeding the contractual penalties set out below. Any contractual penalty already paid shall be credited against proven damages where required by law."
          },
          {
            "kind": "p",
            "text": "The following fixed contractual penalties shall apply:"
          },
          {
            "kind": "table",
            "head": [
              "Contract Breach",
              "Contractual Penalty"
            ],
            "rows": [
              [
                "Late return (per commenced day)",
                "CHF 100.00"
              ],
              [
                "False residential address",
                "CHF 500.00"
              ],
              [
                "Unauthorized driver",
                "CHF 500.00"
              ],
              [
                "Smoking inside the vehicle",
                "CHF 250.00"
              ],
              [
                "GPS tampering or deactivation",
                "CHF 800.00"
              ],
              [
                "Failure to report an accident",
                "CHF 500.00"
              ]
            ]
          }
        ]
      },
      {
        "num": "6",
        "title": "GPS Tracking & Remote Vehicle Immobilization",
        "blocks": [
          {
            "kind": "p",
            "text": "The vehicle is equipped with a GPS tracking system used for theft prevention, fleet management, geofencing, and vehicle security purposes."
          },
          {
            "kind": "p",
            "text": "The Renter acknowledges and expressly agrees that, in the event of payment default (including unpaid rental charges) or a material breach of the rental agreement (including unauthorized transfer of the vehicle, GPS tampering, or misuse), the Lessor may remotely immobilize the vehicle and recover it to protect its property, provided this is technically feasible and permitted by applicable law."
          },
          {
            "kind": "p",
            "text": "To the extent permitted by law, the Renter shall have no contractual claim for damages arising from a lawful remote immobilization of the vehicle."
          }
        ]
      },
      {
        "num": "7",
        "title": "Vehicle Return & Replacement Vehicle",
        "blocks": [
          {
            "kind": "sub",
            "title": "7.1 Vehicle Return"
          },
          {
            "kind": "p",
            "text": "The vehicle must be returned together with all keys, documents, and accessories in substantially the same condition as received, allowing for ordinary wear and tear."
          },
          {
            "kind": "sub",
            "title": "7.2 Replacement Vehicle"
          },
          {
            "kind": "p",
            "text": "In the event of a technical defect or breakdown not caused by the Renter, the Lessor will use reasonable efforts to provide an equivalent replacement vehicle, subject to availability."
          },
          {
            "kind": "p",
            "text": "Unless expressly agreed in writing, the Renter has no automatic entitlement to a replacement vehicle. To the extent permitted by law, any further claims for damages arising from the unavailability of a replacement vehicle are excluded."
          }
        ]
      },
      {
        "num": "8",
        "title": "Accident, Breakdown & Damage Procedures",
        "blocks": [
          {
            "kind": "sub",
            "title": "Accident Procedure"
          },
          {
            "kind": "p",
            "text": "In the event of an accident, the Renter shall:"
          },
          {
            "kind": "list",
            "items": [
              "Secure the accident scene;",
              "Provide assistance to injured persons;",
              "Call the emergency services (144);",
              "Notify the police where personal injury has occurred, liability is unclear, or where required by law;",
              "Make no admission of liability;",
              "Take photographs;",
              "Complete the accident report;",
              "Notify the Lessor within 24 hours."
            ]
          },
          {
            "kind": "p",
            "text": "Failure to report an accident within this period shall result in a contractual penalty of CHF 500.00."
          },
          {
            "kind": "sub",
            "title": "Breakdown Procedure"
          },
          {
            "kind": "p",
            "text": "In the event of a technical defect, the Renter may not authorize repairs without the Lessor's prior approval, except where immediate emergency measures are necessary to prevent danger or further damage."
          }
        ]
      },
      {
        "num": "9",
        "title": "Legal Notice & Reservation of Rights",
        "blocks": [
          {
            "kind": "p",
            "text": "If the vehicle is not returned on time following the expiry of the rental agreement or after immediate termination despite a request for its return, the Lessor reserves the right to obtain legal advice and, where appropriate, notify the competent criminal prosecution authorities."
          },
          {
            "kind": "p",
            "text": "Depending on the specific circumstances, such conduct may constitute a criminal offence under applicable law."
          }
        ]
      },
      {
        "num": "10",
        "title": "Administrative Fees",
        "blocks": [
          {
            "kind": "p",
            "text": "The following administrative fees may be charged where applicable:"
          },
          {
            "kind": "table",
            "head": [
              "Administrative Service",
              "Fee"
            ],
            "rows": [
              [
                "Processing fee for traffic fines",
                "CHF 20.00"
              ],
              [
                "Reminder processing fee",
                "CHF 20.00"
              ],
              [
                "Debt collection initiation fee",
                "CHF 80.00"
              ],
              [
                "Vehicle recovery",
                "Minimum CHF 400.00 plus actual costs incurred"
              ],
              [
                "Vehicle storage",
                "CHF 50.00 per day"
              ]
            ]
          }
        ]
      },
      {
        "num": "11",
        "title": "General Provisions",
        "blocks": [
          {
            "kind": "sub",
            "title": "No Waiver"
          },
          {
            "kind": "p",
            "text": "Failure by the Lessor to enforce any right or provision under the rental agreement shall not constitute a waiver of that right."
          },
          {
            "kind": "sub",
            "title": "Force Majeure"
          },
          {
            "kind": "p",
            "text": "The Lessor shall not be liable for any failure or delay in performance caused by events beyond its reasonable control (force majeure)."
          },
          {
            "kind": "sub",
            "title": "Entire Agreement"
          },
          {
            "kind": "p",
            "text": "The rental agreement together with these GTC constitutes the entire agreement between the parties and supersedes all prior oral or written agreements relating to its subject matter."
          },
          {
            "kind": "sub",
            "title": "Severability"
          },
          {
            "kind": "p",
            "text": "Should any provision of these GTC or the rental agreement be held invalid or unenforceable, the remaining provisions shall remain in full force and effect."
          },
          {
            "kind": "sub",
            "title": "Final Provisions"
          },
          {
            "kind": "p",
            "text": "Any amendments or supplements to the rental agreement or these GTC must be made in writing."
          },
          {
            "kind": "p",
            "text": "The rental agreement and these GTC shall be governed exclusively by Swiss law."
          },
          {
            "kind": "p",
            "text": "The exclusive place of jurisdiction shall be Embrach, Switzerland, to the extent permitted by applicable law."
          }
        ]
      }
    ]
  },
  "fr": {
    "title": "Conditions Générales de Location (CGV)",
    "updated": "Mise à jour : 30.07.2026 / AK",
    "sections": [
      {
        "num": "1",
        "title": "Champ d'application et intégration contractuelle",
        "blocks": [
          {
            "kind": "p",
            "text": "Les présentes Conditions Générales de Location (« CGV ») s'appliquent à tous les contrats de location de véhicules conclus avec Rigitrade AG (le « Loueur »)."
          },
          {
            "kind": "p",
            "text": "En signant le contrat de location, le Locataire reconnaît avoir pris connaissance des présentes CGV, les accepte dans leur intégralité et reconnaît qu'elles font partie intégrante du contrat de location."
          }
        ]
      },
      {
        "num": "2",
        "title": "Utilisations interdites et conséquences",
        "blocks": [
          {
            "kind": "sub",
            "title": "2.1 Utilisations strictement interdites"
          },
          {
            "kind": "p",
            "text": "Le véhicule loué ne peut être utilisé que pour un usage privé ou pour le transport professionnel de personnes (par exemple Uber ou Bolt)."
          },
          {
            "kind": "p",
            "text": "Sont strictement interdits :"
          },
          {
            "kind": "list",
            "items": [
              "a) le prêt, la mise à disposition à des tiers, la sous-location ou la vente du véhicule ;",
              "b) l'utilisation du véhicule pour commettre ou faciliter une infraction pénale ;",
              "c) la conduite sous l'influence de l'alcool ou de stupéfiants ;",
              "d) tout franchissement non autorisé des frontières ;",
              "e) le fait de fumer dans le véhicule, y compris les cigarettes électroniques ;",
              "f) toute manipulation, désactivation ou altération du système de géolocalisation (GPS)."
            ]
          },
          {
            "kind": "sub",
            "title": "2.2 Conséquences"
          },
          {
            "kind": "p",
            "text": "Le Loueur est en droit de résilier immédiatement le contrat de location, sans préavis."
          },
          {
            "kind": "p",
            "text": "Le Loueur se réserve également le droit de réclamer des dommages-intérêts et d'engager toute procédure civile ou pénale appropriée."
          }
        ]
      },
      {
        "num": "3",
        "title": "Frais, exploitation du véhicule, conditions relatives au transport",
        "blocks": [
          {
            "kind": "p",
            "text": "professionnel de personnes et entretien"
          },
          {
            "kind": "sub",
            "title": "3.1 Frais à la charge du Locataire"
          },
          {
            "kind": "p",
            "text": "Le Locataire supporte notamment les frais suivants :"
          },
          {
            "kind": "list",
            "items": [
              "Carburant (essence sans plomb 95 ou 98)",
              "Nettoyage du véhicule",
              "Frais de stationnement",
              "Péages, vignette autoroutière et autres redevances routières",
              "Frais administratifs",
              "Frais de remorquage et de gardiennage"
            ]
          },
          {
            "kind": "sub",
            "title": "3.2 Frais à la charge du Loueur"
          },
          {
            "kind": "p",
            "text": "Le Loueur prend en charge :"
          },
          {
            "kind": "list",
            "items": [
              "Les entretiens périodiques",
              "Les pneus été/hiver",
              "Les réparations mécaniques résultant d'une usure normale (hors mauvaise utilisation)",
              "L'impôt sur les véhicules",
              "L'assurance responsabilité civile obligatoire"
            ]
          },
          {
            "kind": "sub",
            "title": "3.3 Devoir de diligence et contrôles"
          },
          {
            "kind": "p",
            "text": "Avant chaque trajet, le Locataire doit vérifier :"
          },
          {
            "kind": "list",
            "items": [
              "le niveau d'huile moteur ;",
              "le niveau du liquide de refroidissement ;",
              "la pression des pneus ;",
              "le bon fonctionnement de l'éclairage ;",
              "les voyants du tableau de bord."
            ]
          },
          {
            "kind": "p",
            "text": "En cas d'apparition d'un voyant d'alerte, le Locataire doit immédiatement interrompre son trajet et informer le Loueur sans délai."
          },
          {
            "kind": "sub",
            "title": "3.4 Propreté du véhicule"
          },
          {
            "kind": "p",
            "text": "Le véhicule doit être restitué dans un état de propreté satisfaisant."
          },
          {
            "kind": "p",
            "text": "En cas de salissures excessives nécessitant un nettoyage professionnel spécialisé, les frais réels de nettoyage seront facturés au Locataire, avec un minimum de CHF 150.00."
          },
          {
            "kind": "sub",
            "title": "3.5 Clés, documents, cartes de recharge et plaques d'immatriculation"
          },
          {
            "kind": "p",
            "text": "Toute perte des clés du véhicule, du certificat d'immatriculation, des plaques d'immatriculation ou des cartes de recharge mises à disposition doit être signalée immédiatement au Loueur."
          },
          {
            "kind": "p",
            "text": "Le Locataire est responsable de tous les frais de remplacement ainsi que de l'ensemble des frais et coûts administratifs qui en découlent."
          },
          {
            "kind": "sub",
            "title": "3.6 Conditions relatives au transport professionnel de personnes"
          },
          {
            "kind": "p",
            "text": "Pendant toute la durée de la location, le Locataire est tenu de respecter toutes les exigences légales et réglementaires applicables au transport professionnel de personnes."
          },
          {
            "kind": "p",
            "text": "Il lui incombe de veiller à ce que tous les permis, autorisations et agréments requis demeurent valables pendant toute la durée de la location, y compris le respect des exigences imposées par les plateformes de mise en relation utilisées (telles qu'Uber ou Bolt) ainsi que les autorisations BPT (transport professionnel de personnes)."
          }
        ]
      },
      {
        "num": "4",
        "title": "Assurance et responsabilité",
        "blocks": [
          {
            "kind": "sub",
            "title": "4.1 Assurance"
          },
          {
            "kind": "p",
            "text": "Lorsque cela est indiqué dans le contrat de location, le véhicule bénéficie d'une assurance couvrant le transport professionnel de personnes (BPT)."
          },
          {
            "kind": "sub",
            "title": "4.2 Responsabilité du Locataire"
          },
          {
            "kind": "p",
            "text": "Dans les limites autorisées par la loi, le Locataire est responsable :"
          },
          {
            "kind": "list",
            "items": [
              "des franchises d'assurance ;",
              "des infractions routières et amendes ;",
              "des réclamations légitimes de tiers résultant de faits imputables au"
            ]
          },
          {
            "kind": "p",
            "text": "Locataire ;"
          },
          {
            "kind": "list",
            "items": [
              "des dommages non couverts par l'assurance ;",
              "des dommages résultant d'une faute grave ou intentionnelle ;",
              "de la franchise convenue et/ou des frais supplémentaires en cas de perte totale du véhicule lorsque ceux-ci ne sont pas couverts par l'assurance."
            ]
          }
        ]
      },
      {
        "num": "5",
        "title": "Clauses pénales",
        "blocks": [
          {
            "kind": "p",
            "text": "(Articles 160 et suivants du Code suisse des obligations) Le Loueur se réserve le droit de réclamer un dommage supérieur aux montants des pénalités contractuelles ci-dessous."
          },
          {
            "kind": "p",
            "text": "Toute pénalité contractuelle déjà payée sera imputée sur le dommage effectivement prouvé lorsque la loi l'exige."
          },
          {
            "kind": "p",
            "text": "Les pénalités forfaitaires suivantes sont applicables :"
          },
          {
            "kind": "table",
            "head": [
              "Manquement contractuel",
              "Pénalité contractuelle"
            ],
            "rows": [
              [
                "Restitution tardive (par jour commencé)",
                "CHF 100.00"
              ],
              [
                "Fausse adresse",
                "CHF 500.00"
              ],
              [
                "Conducteur non autorisé",
                "CHF 500.00"
              ],
              [
                "Fumer dans le véhicule",
                "CHF 250.00"
              ],
              [
                "Manipulation ou désactivation du GPS",
                "CHF 800.00"
              ],
              [
                "Défaut de déclaration d'un accident",
                "CHF 500.00"
              ]
            ]
          }
        ]
      },
      {
        "num": "6",
        "title": "Géolocalisation GPS et immobilisation à distance",
        "blocks": [
          {
            "kind": "p",
            "text": "Le véhicule est équipé d'un système GPS utilisé à des fins de prévention du vol, de gestion de flotte, de respect des zones géographiques autorisées (géorepérage) et de sécurité."
          },
          {
            "kind": "p",
            "text": "Le Locataire reconnaît en avoir été informé et consent expressément à ce que le Loueur puisse, en cas de défaut de paiement (notamment en cas de loyer impayé) ou de violation grave du contrat (notamment transfert non autorisé du véhicule, manipulation du GPS ou utilisation abusive), procéder à l'immobilisation à distance du véhicule et le récupérer afin de protéger son droit de propriété, dans la mesure où cela est techniquement possible et autorisé par la loi."
          },
          {
            "kind": "p",
            "text": "Dans les limites autorisées par la loi, le Locataire ne pourra prétendre à aucun dommage-intérêt résultant d'une immobilisation à distance effectuée légalement."
          }
        ]
      },
      {
        "num": "7",
        "title": "Restitution du véhicule et véhicule de remplacement",
        "blocks": [
          {
            "kind": "sub",
            "title": "7.1 Restitution"
          },
          {
            "kind": "p",
            "text": "Le véhicule doit être restitué avec l'ensemble des clés, documents et accessoires dans un état équivalent à celui de sa remise, compte tenu de l'usure normale."
          },
          {
            "kind": "sub",
            "title": "7.2 Véhicule de remplacement"
          },
          {
            "kind": "p",
            "text": "En cas de panne ou de défaillance technique non imputable au Locataire, le Loueur s'efforcera, sous réserve de disponibilité, de fournir un véhicule de remplacement équivalent."
          },
          {
            "kind": "p",
            "text": "Sauf engagement écrit exprès du Loueur, le Locataire ne dispose d'aucun droit automatique à un véhicule de remplacement."
          },
          {
            "kind": "p",
            "text": "Dans les limites autorisées par la loi, toute autre demande d'indemnisation est exclue."
          }
        ]
      },
      {
        "num": "8",
        "title": "Procédure en cas d'accident, de panne ou de dommage",
        "blocks": [
          {
            "kind": "sub",
            "title": "Procédure en cas d'accident"
          },
          {
            "kind": "p",
            "text": "En cas d'accident, le Locataire doit :"
          },
          {
            "kind": "list",
            "items": [
              "sécuriser le lieu de l'accident ;",
              "porter assistance aux personnes blessées ;",
              "appeler les services d'urgence (144) ;",
              "prévenir la police en cas de blessure, de responsabilité incertaine ou lorsque la loi l'exige ;",
              "ne reconnaître aucune responsabilité ;",
              "prendre des photographies ;",
              "remplir un constat d'accident ;",
              "informer le Loueur dans un délai de 24 heures."
            ]
          },
          {
            "kind": "p",
            "text": "Le non-respect de cette obligation entraîne une pénalité contractuelle de CHF 500,- Procédure en cas de panne En cas de panne technique, le Locataire ne peut faire effectuer de réparations sans l'accord préalable du Loueur, sauf s'il s'agit de mesures d'urgence destinées à prévenir un danger immédiat ou des dommages supplémentaires."
          }
        ]
      },
      {
        "num": "9",
        "title": "Informations juridiques et réserves",
        "blocks": [
          {
            "kind": "p",
            "text": "Si le véhicule n'est pas restitué dans le délai imparti après l'expiration du contrat ou après une résiliation immédiate malgré une demande de restitution, le Loueur se réserve le droit de faire examiner juridiquement la situation et, le cas échéant, de saisir les autorités pénales compétentes."
          },
          {
            "kind": "p",
            "text": "Selon les circonstances concrètes, un tel comportement peut constituer une infraction pénale."
          }
        ]
      },
      {
        "num": "10",
        "title": "Frais administratifs",
        "blocks": [
          {
            "kind": "p",
            "text": "Les frais administratifs suivants peuvent être facturés :"
          },
          {
            "kind": "table",
            "head": [
              "Prestation administrative",
              "Montant"
            ],
            "rows": [
              [
                "Frais de traitement d'une amende routière",
                "CHF 20.00"
              ],
              [
                "Frais de rappel",
                "CHF 20.00"
              ],
              [
                "Frais d'ouverture d'une procédure de poursuite",
                "CHF 80.00"
              ],
              [
                "Récupération du véhicule",
                "Minimum CHF 400.00, plus les frais effectivement engagés"
              ],
              [
                "Frais de gardiennage",
                "CHF 50.00 par jour"
              ]
            ]
          }
        ]
      },
      {
        "num": "11",
        "title": "Dispositions générales",
        "blocks": [
          {
            "kind": "sub",
            "title": "Absence de renonciation (No Waiver)"
          },
          {
            "kind": "p",
            "text": "Le fait pour le Loueur de ne pas exercer un droit ne saurait être interprété comme une renonciation à ce droit."
          },
          {
            "kind": "sub",
            "title": "Force majeure"
          },
          {
            "kind": "p",
            "text": "Le Loueur ne pourra être tenu responsable de tout retard ou empêchement d'exécution résultant d'un cas de force majeure."
          },
          {
            "kind": "sub",
            "title": "Intégralité de l'accord (Entire Agreement)"
          },
          {
            "kind": "p",
            "text": "Le contrat de location et les présentes CGV constituent l'intégralité de l'accord conclu entre les parties et remplacent tout accord ou arrangement antérieur, oral ou écrit."
          },
          {
            "kind": "sub",
            "title": "Clause de divisibilité (Severability)"
          },
          {
            "kind": "p",
            "text": "Si l'une des dispositions des présentes CGV ou du contrat de location est déclarée nulle ou inapplicable, les autres dispositions demeureront pleinement valables et applicables."
          },
          {
            "kind": "sub",
            "title": "Dispositions finales"
          },
          {
            "kind": "p",
            "text": "Toute modification ou tout complément au contrat de location ou aux présentes CGV doit être effectué par écrit."
          },
          {
            "kind": "p",
            "text": "Le contrat de location et les présentes CGV sont exclusivement régis par le droit suisse."
          },
          {
            "kind": "p",
            "text": "Le for juridique exclusif est fixé à Embrach (Suisse), dans la mesure où la loi l'autorise."
          }
        ]
      }
    ]
  }
};

export default gtc;
