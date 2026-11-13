/**
 * Letter texts as the OCR hands them over.
 *
 * `KAPO_ZH_OCR` is what Tesseract read from Ahmed's sample on 2026-10-03 —
 * misreadings included ("Ziffern", "Datum / ze", "Und" for "Uhr"), because
 * those are what the rules have to survive. The others are written in the
 * shape of real letters from the pile, one per language and issuer kind.
 */

export const KAPO_ZH_OCR = `Kantonspolizei
Zürich
Ordnungsbussen
Postfach, 8010 Zürich
P.P. CH-8010 Zürich Post CH AG
Rigitrade AG
Tannenstrasse 16
8424 Embrach
Busse online bezahlen
Zürich, 4. September 2026 / D012CH.docx / 158
Mahnung OB-Nr. 830557506 017 4
Bis jetzt Ist bei uns keine Zahlung eingegangen. Falls sich Ihre Zahlung mit dieser Mahnung gekreuzt hat, betrachten Sie
dieses Schreiben als gegenstandslos.
Die Kantonspolizei Zürich hat folgende Übertretung/en gemäss Anhang zur Ordnungsbussenverordnung (OBV) festgestellt:
Ziffern 303.1.a Überschreiten allgemeiner, fahrzeugbedingter oder signalisierter Höchstgeschwindigkeit 40.00
innerorts
Total Bussenbetrag CHF 40.00
Kontrollschild ZH 949636 Fahrzeugart Personenwagen
Übertretungsort Lufingen, Zürcherstrasse Datum / ze [02.07.2026 10.00 Und
Fahrtrichtung Kloten
Gemessene Geschwindigkeit 55 km/h Massgebende Geschwindigkeit 52 km/h
Sicherheitsabzug -3 km/h Abzug der Geschwindigkeitsbegrenzung 50 km/h
Massgebende Geschwindigkeit 52 km/h Geschwindigkeitsüberschreitung 2 km/h
Für weitere Informationen zur Übertretung, die Bezahlung der Ordnungsbusse oder die Eingabe begründeter Einwendungen
steht Ihnen auch unser Online-Bussenportal zur Verfügung.
Empfangsschein Zahlteil
Konto / Zahlbar an CH24 3000 0001 8000 0080 3 Kantonspolizei Zürich Ordnungsbussen 8010 Zürich
Referenz 00 19809 19800 08305 57506 01742
Zusätzliche Informationen Ordnungsbusse: 830557506 017 4
Währung Betrag CHF 40.00`;

export const POLICE_VD_RAPPEL = `Police cantonale vaudoise
Amendes d'ordre
Rigitrade AG
Tannenstrasse 16
8424 Embrach
Lausanne, le 12 mai 2026
Rappel
N° OB 4471 2093 55
Nous n'avons pas encore reçu votre paiement. Veuillez régler le montant ci-dessous dans les 30 jours.
Infraction selon l'annexe de l'ordonnance sur les amendes d'ordre (OAO):
chiffre 303.1.a Dépassement de la vitesse maximale générale à l'intérieur des localités 40.00
Plaque de contrôle ZH 513925 Genre de véhicule voiture de tourisme
Lieu de l'infraction Lausanne, Avenue de Rhodanie Date / heure 14.03.2026, 08:15
Vitesse mesurée 56 km/h Vitesse autorisée 50 km/h
Montant total CHF 40.00`;

export const POLICE_TI_MULTA = `Polizia cantonale
Multe disciplinari
Rigitrade AG
Tannenstrasse 16
8424 Embrach
Bellinzona, 20 agosto 2026
Multa disciplinare N. MD 5521 8834 10
Secondo l'allegato dell'ordinanza sulle multe disciplinari (OMD) è stata constatata la seguente infrazione:
cifra 303.1.a Superamento della velocità massima generale all'interno delle località 40.00
Targa ZH 401859 Genere di veicolo automobile
Luogo dell'infrazione Lugano, Via Nassa Data / ora 01.08.2026 ore 17:40
Velocità misurata 57 km/h Velocità massima 50 km/h
Importo totale CHF 40.00
Pagabile entro il 19.09.2026`;

export const PARKPRO_PRIVATE = `ParkPro AG
Bahnhofstrasse 10, 8001 Zürich
Rigitrade AG
Tannenstrasse 16
8424 Embrach
Zürich, 20. Juni 2026
Umtriebsentschädigung wegen Besitzesstörung
Referenz-Nr. PP-2026-118734
Ihr Fahrzeug mit dem Kontrollschild ZH 513925 wurde am 12.06.2026 um 14:32 auf dem Privatparkplatz
Bahnhofstrasse 10, 8001 Zürich ohne Berechtigung abgestellt.
Umtriebsentschädigung CHF 50.00
Zahlbar bis 20.07.2026`;

export const FUEL_INVOICE = `beppo AG
Rigitrade AG
Tannenstrasse 16
8424 Embrach
RECHNUNG - Nachzahlung Ihrer Tankrechnung
Rechnungsdatum 02.09.2026
Tankstelle Zürich-Altstetten 18.08.2026 16:02
Betrag CHF 23.40`;

/**
 * A Stadtpolizei Zürich Übertretungsanzeige as Tesseract read the scan the
 * office uploaded on 2026-11-13, misreadings included. Its QR-bill was printed
 * too faintly to decode, so this text is all there is: the number stands under
 * "Verzeigungs-Nr." in the heading (without its leading zero) and again as
 * "V-Nr." under the slip's "Zusätzliche Informationen", and the account only
 * as the slip prints it.
 */
export const STADTPOLIZEI_ZH_FAINT_SLIP = `Stadt Zürich Stadt Zürich
IS Stadtpolizei Stadtpolizei
PONZE Verkehrskontrollabteilung
Fachbereich Zentralstelle für
Verkehrs- und Ordnungsbussen
Verzeigungs-Nr.: 29435921 005 3 Bahnhofquai 5
, Postfach
Zürich, 22.10.2026 / D011CH.docx 51 8021 Zürich
Tel +41 44 411 76 76
Besuchen Sie den
Online-Bussenschalter:
Rigitrade AG EC www.stadt-zuerich.ch/bussen
Tannenstrasse 16 ee ea
1 : © ri Fils
8424 Embrach ie En
BSH LIEM
On
Übertretungsanzeige
Durch die Stadtpolizei Zürich wurde(n) folgende Übertretung(en) festgestellt:
Ziffer(n) 200.a Überschreiten der zulässigen Parkzeit
203.2 Ändern der eingestellten Ankunftszeit, ohne wegzufahren
Bussenbetrag: Fr. 80.00
Kontrollschild-Nr. : ZH 919906 Kategorie: Personenwagen
Übertretungsort : Zürich 11, Oberwiesenstrasse 16
Datum : 22.09.2026, 11:00 - 11:34 Uhr
Falls Sie von oben genanntem Vorhalt bisher keine Kenntnis erlangt oder einen Einzahlungsschein gewünscht haben, gilt
dieses Schreiben als Übertretungsanzeige. Für weitere Informationen zur Übertretung, die Bezahlung der Ordnungsbusse
oder die Eingabe begründeter Einwendungen steht Ihnen auch unser Online-Bussenschalter zur Verfügung.
Bitte Rückseite beachten
WWW Vor der Einzahlung abzutrennen / A detacher avant le versement / Da staccare prima del versamento VYWV
Empfangsschein Zahlteil Konto / Zahlbar an
CH79 3000 0001 8000 2231 7
Konto / Zahlbar an ns
CH79 3000 0001 8000 2231 7 Se = en a DA
Stadt Zürich Ps - adtpolizei Verkehrskontrollabteilun
Stadtpolizei Verkehrskontrollabteilung Da in FE 8001 Zürich 7
8001 Zürich EL „LEE SERIEN
= EMS 3
Referenz L FE dat EL ‚ET Referenz
00 31899 31890 00294 35921 00533 A na ol PP M E 0031899 31890 00294 35921 00533
Zahlbar durch x HL Be a
Rigitra da A 6 be FL EM 7 Zusätzliche Informationen
Tannenstrasse 16 = E- Mn = EACH Ay V-Nr. 029435921 005 3, Kennzeichen ZH 919906
8424 Embrach | a if
Mi En Km —Zahlbar durch
Tl dn Th val-Ls —Rigitrade AG
. w ; Tannenstrasse 16
8424 Embrach
Währung Betrag Währung Betrag
Chr 180.00 CHF 80.00
Annahmesielle`;
