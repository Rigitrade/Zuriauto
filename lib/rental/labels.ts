/**
 * German and English strings for the pickup contract flow.
 *
 * These live here rather than in the i18n catalogue for the same reason
 * `locales/gtc.ts` and `whatsappMessage.ts` do: the contract is a
 * self-contained document, and routing it through `t()` would mean adding
 * keys to `locales/de.ts`, `locales/en.ts` and `types/i18n.ts` for strings
 * nothing else uses.
 *
 * The PDF labels are deliberately in the same table as the form labels, so a
 * field cannot be renamed on screen without the document following.
 */

export type RentalLanguage = "de" | "en";

/** The site UI is German/English only; anything else falls back to German. */
export function asRentalLanguage(lang: string | undefined): RentalLanguage {
  return lang === "en" ? "en" : "de";
}

// Deliberately not `as const`: the literal types that would produce make
// `en: typeof de` unsatisfiable, since every English string differs.
const de = {
  pageTitle: "Mietvertrag – Fahrzeugübernahme",
  pageIntro:
    "Bitte füllen Sie das Formular aus, fotografieren Sie Ihre Ausweise und unterschreiben Sie direkt auf dem Bildschirm. Sie erhalten den Vertrag anschliessend per E-Mail.",

  steps: {
    vehicle: "Fahrzeug",
    details: "Ihre Daten",
    documents: "Dokumente",
    sign: "Unterschrift",
  },

  vehicle: {
    heading: "Fahrzeug und Zustand",
    select: "Fahrzeug",
    selectPlaceholder: "Bitte wählen",
    plate: "Kontrollschild-Nr.",
    vin: "Fahrgestell-Nr.",
    mileage: "Kilometerstand (km)",
    mileageHint: "Ablesen am Armaturenbrett",
    fuel: "Tankfüllung",
    fuelEmpty: "Leer",
    fuelFull: "Voll",
    damage: "Vorhandene Schäden",
    damageHint:
      "Beschreiben Sie sichtbare Schäden. Ohne Eintrag gilt das Fahrzeug als mängelfrei übernommen.",
    damageNone: "Keine sichtbaren Schäden",
    conditionPhotos: "Zustandsfotos (optional)",
    conditionPhotosHint: "Bis zu 4 Fotos des Fahrzeugs",
  },

  details: {
    heading: "Ihre Daten",
    lastName: "Name",
    firstName: "Vorname",
    birthDate: "Geburtsdatum",
    // German convention: Tag, Monat, Jahr.
    birthDatePlaceholder: "TT.MM.JJJJ",
    birthDateHint: "Eintippen oder über das Kalendersymbol auswählen",
    birthDatePick: "Datum im Kalender auswählen",
    street: "Strasse, Haus-Nr.",
    postalCode: "PLZ",
    city: "Ort",
    country: "Land",
    mobile: "Mobil-Nr.",
    email: "E-Mail",
    emailHint: "An diese Adresse senden wir Ihren Vertrag.",
  },

  documents: {
    heading: "Ausweisdokumente",
    intro:
      "Fotografieren Sie Vorder- und Rückseite beider Dokumente gut lesbar und vollständig im Bild.",
    portrait: "Personenfoto",
    portraitHint:
      "Ein Foto von Ihnen, damit wir es mit Ihrem Ausweis abgleichen können.",
    idFront: "Identitätskarte oder Pass – Vorderseite",
    idBack: "Identitätskarte oder Pass – Rückseite",
    licenceFront: "Führerausweis – Vorderseite",
    licenceBack: "Führerausweis – Rückseite",
    take: "Foto aufnehmen",
    retake: "Neues Foto",
    remove: "Entfernen",
    openCamera: "Kamera öffnen",
    chooseFile: "Datei wählen",
    shutter: "Aufnehmen",
    switchCamera: "Kamera wechseln",
    cancel: "Abbrechen",
    cameraStarting: "Kamera wird gestartet …",
    cameraDenied:
      "Kein Zugriff auf die Kamera. Bitte im Browser erlauben oder eine Datei wählen.",
    cameraUnavailable:
      "Keine Kamera gefunden. Bitte stattdessen eine Datei wählen.",
    cameraInsecure:
      "Die Kamera funktioniert nur über eine sichere Verbindung (https). Bitte eine Datei wählen.",
  },

  gtc: {
    heading: "Allgemeine Geschäftsbedingungen",
    intro: "Bitte lesen Sie die AGB und bestätigen Sie diese.",
    languageLabel: "Sprache der AGB",
    accept: "Ich habe die AGB gelesen und akzeptiere sie.",
    locked: "Bitte akzeptieren Sie zuerst die AGB.",
    version: "Fassung",
  },

  signature: {
    heading: "Unterschrift",
    hint: "Unterschreiben Sie mit dem Finger im Feld.",
    clear: "Löschen",
    place: "Ort, Datum, Uhrzeit",
    placeOnly: "Ort",
    dateTime: "Datum, Uhrzeit",
    dateOnly: "Datum",
    timeOnly: "Uhrzeit",
    stampedNote: "Datum und Uhrzeit werden beim Absenden festgehalten.",
  },

  submit: {
    button: "Vertrag abschliessen",
    working: "Vertrag wird erstellt …",
    sending: "Vertrag wird gesendet …",
  },

  result: {
    successTitle: "Vertrag abgeschlossen",
    successBody:
      "Der unterschriebene Vertrag wurde an Sie und an ZURIAUTO gesendet.",
    partialTitle: "Vertrag an ZURIAUTO gesendet",
    partialBody:
      "Ihre Kopie konnte nicht zugestellt werden. Bitte laden Sie den Vertrag hier herunter.",
    offlineTitle: "Vertrag erstellt",
    offlineBody:
      "Der Versand per E-Mail ist derzeit nicht möglich. Bitte laden Sie den Vertrag herunter und senden Sie ihn an ZURIAUTO.",
    download: "PDF herunterladen",
    share: "Teilen",
    contractNumber: "Vertrags-Nr.",
  },

  errors: {
    required: "Pflichtfeld",
    email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    mileage: "Bitte geben Sie den Kilometerstand als Zahl ein.",
    birthDate: "Bitte geben Sie ein gültiges Geburtsdatum ein.",
    minor: "Der Mieter muss mindestens 18 Jahre alt sein.",
    vehicle: "Bitte wählen Sie ein Fahrzeug.",
    country: "Bitte wählen Sie ein Land.",
    portraitPhoto: "Bitte nehmen Sie ein Personenfoto auf.",
    idFrontPhoto: "Bitte fotografieren Sie die Vorderseite Ihres Ausweises.",
    idBackPhoto: "Bitte fotografieren Sie die Rückseite Ihres Ausweises.",
    licenceFrontPhoto:
      "Bitte fotografieren Sie die Vorderseite Ihres Führerausweises.",
    licenceBackPhoto:
      "Bitte fotografieren Sie die Rückseite Ihres Führerausweises.",
    signature: "Bitte unterschreiben Sie.",
    gtc: "Bitte akzeptieren Sie die AGB.",
    imageRead: "Das Bild konnte nicht gelesen werden. Bitte erneut aufnehmen.",
    tooLarge:
      "Die Fotos sind zu gross. Bitte nehmen Sie sie mit weniger Detail erneut auf.",
    sendFailed:
      "Der Vertrag konnte nicht gesendet werden. Bitte laden Sie ihn herunter.",
  },

  pdf: {
    title: "MIETVERTRAG – FAHRZEUGÜBERNAHME",
    lessor: "Vermieter",
    contractNumber: "Vertrags-Nr.",
    issued: "Erstellt am",
    vehicleSection: "Fahrzeug",
    model: "Modell",
    plate: "Kontrollschild-Nr.",
    vin: "Fahrgestell-Nr.",
    mileage: "Kilometerstand bei Übernahme",
    fuel: "Tankfüllung",
    customerSection: "Mieter",
    lastName: "Name",
    firstName: "Vorname",
    birthDate: "Geburtsdatum",
    address: "Adresse",
    mobile: "Mobil-Nr.",
    email: "E-Mail",
    conditionSection: "Fahrzeugzustand bei Übernahme",
    damage: "Vorhandene Schäden",
    damageNone: "Keine sichtbaren Schäden gemeldet",
    conditionPhoto: "Zustandsfoto",
    documentsSection: "Ausweisdokumente",
    portraitPhoto: "Personenfoto",
    idFrontPhoto: "Identitätskarte / Pass – Vorderseite",
    idBackPhoto: "Identitätskarte / Pass – Rückseite",
    licenceFrontPhoto: "Führerausweis – Vorderseite",
    licenceBackPhoto: "Führerausweis – Rückseite",
    gtcSection: "Annahme der AGB",
    gtcAccepted:
      "Der Mieter hat die Allgemeinen Geschäftsbedingungen gelesen und akzeptiert.",
    gtcVersion: "Fassung",
    gtcLanguage: "Sprache",
    acceptedAt: "Akzeptiert am",
    signatureSection: "Unterschrift des Mieters",
    signedBy: "Name in Druckschrift",
    placeAndDate: "Ort, Datum, Uhrzeit",
    appendixTitle: "Anhang: Allgemeine Geschäftsbedingungen",
    page: "Seite",
    of: "von",
    km: "km",
  },

  email: {
    officeSubject: "Neuer Mietvertrag",
    customerSubject: "Ihr Mietvertrag – ZURIAUTO",
    // Split so the payment link lands before the sign-off rather than trailing
    // after it, which reads as an afterthought.
    customerGreeting:
      "Guten Tag\n\nIm Anhang finden Sie Ihren unterschriebenen Mietvertrag.",
    customerPayment: "Zahlung per Karte:",
    customerSignature: "Freundliche Grüsse\nZURIAUTO",
  },
};

const en: typeof de = {
  pageTitle: "Rental contract – vehicle handover",
  pageIntro:
    "Please complete the form, photograph your documents and sign on screen. You will receive the contract by email afterwards.",

  steps: {
    vehicle: "Vehicle",
    details: "Your details",
    documents: "Documents",
    sign: "Signature",
  },

  vehicle: {
    heading: "Vehicle and condition",
    select: "Vehicle",
    selectPlaceholder: "Please select",
    plate: "Licence plate no.",
    vin: "Chassis no.",
    mileage: "Mileage (km)",
    mileageHint: "Read from the dashboard",
    fuel: "Fuel level",
    fuelEmpty: "Empty",
    fuelFull: "Full",
    damage: "Pre-existing damage",
    damageHint:
      "Describe any visible damage. If left empty, the vehicle is taken as free of defects.",
    damageNone: "No visible damage",
    conditionPhotos: "Condition photos (optional)",
    conditionPhotosHint: "Up to 4 photos of the vehicle",
  },

  details: {
    heading: "Your details",
    lastName: "Family name",
    firstName: "First name",
    birthDate: "Date of birth",
    birthDatePlaceholder: "DD.MM.YYYY",
    birthDateHint: "Type it, or tap the calendar icon to pick",
    birthDatePick: "Pick the date from a calendar",
    street: "Street, house no.",
    postalCode: "Postal code",
    city: "City",
    country: "Country",
    mobile: "Mobile no.",
    email: "Email",
    emailHint: "We will send your contract to this address.",
  },

  documents: {
    heading: "Identity documents",
    intro:
      "Photograph the front and back of both documents fully in frame and clearly legible.",
    portrait: "Personal photo",
    portraitHint: "A photo of you, so we can match it against your ID.",
    idFront: "ID card or passport – front",
    idBack: "ID card or passport – back",
    licenceFront: "Driving licence – front",
    licenceBack: "Driving licence – back",
    take: "Take photo",
    retake: "Retake",
    remove: "Remove",
    openCamera: "Open camera",
    chooseFile: "Choose file",
    shutter: "Capture",
    switchCamera: "Switch camera",
    cancel: "Cancel",
    cameraStarting: "Starting the camera …",
    cameraDenied:
      "No access to the camera. Allow it in your browser, or choose a file instead.",
    cameraUnavailable: "No camera found. Please choose a file instead.",
    cameraInsecure:
      "The camera only works over a secure connection (https). Please choose a file instead.",
  },

  gtc: {
    heading: "General Terms and Conditions",
    intro: "Please read the GTC and confirm your acceptance.",
    languageLabel: "Language of the terms",
    accept: "I have read and accept the GTC.",
    locked: "Please accept the GTC first.",
    version: "Version",
  },

  signature: {
    heading: "Signature",
    hint: "Sign with your finger in the field.",
    clear: "Clear",
    place: "Place, date, time",
    placeOnly: "Place",
    dateTime: "Date, time",
    dateOnly: "Date",
    timeOnly: "Time",
    stampedNote: "The date and time are recorded when you submit.",
  },

  submit: {
    button: "Complete contract",
    working: "Creating contract …",
    sending: "Sending contract …",
  },

  result: {
    successTitle: "Contract completed",
    successBody: "The signed contract has been sent to you and to ZURIAUTO.",
    partialTitle: "Contract sent to ZURIAUTO",
    partialBody:
      "Your copy could not be delivered. Please download the contract here.",
    offlineTitle: "Contract created",
    offlineBody:
      "Email delivery is currently unavailable. Please download the contract and send it to ZURIAUTO.",
    download: "Download PDF",
    share: "Share",
    contractNumber: "Contract no.",
  },

  errors: {
    required: "Required",
    email: "Please enter a valid email address.",
    mileage: "Please enter the mileage as a number.",
    birthDate: "Please enter a valid date of birth.",
    minor: "The renter must be at least 18 years old.",
    vehicle: "Please select a vehicle.",
    country: "Please select a country.",
    portraitPhoto: "Please take a personal photo.",
    idFrontPhoto: "Please photograph the front of your ID.",
    idBackPhoto: "Please photograph the back of your ID.",
    licenceFrontPhoto: "Please photograph the front of your driving licence.",
    licenceBackPhoto: "Please photograph the back of your driving licence.",
    signature: "Please sign.",
    gtc: "Please accept the GTC.",
    imageRead: "The image could not be read. Please take it again.",
    tooLarge:
      "The photos are too large. Please retake them with less detail.",
    sendFailed: "The contract could not be sent. Please download it.",
  },

  pdf: {
    title: "RENTAL CONTRACT – VEHICLE HANDOVER",
    lessor: "Lessor",
    contractNumber: "Contract no.",
    issued: "Issued",
    vehicleSection: "Vehicle",
    model: "Model",
    plate: "Licence plate no.",
    vin: "Chassis no.",
    mileage: "Mileage at handover",
    fuel: "Fuel level",
    customerSection: "Renter",
    lastName: "Family name",
    firstName: "First name",
    birthDate: "Date of birth",
    address: "Address",
    mobile: "Mobile no.",
    email: "Email",
    conditionSection: "Vehicle condition at handover",
    damage: "Pre-existing damage",
    damageNone: "No visible damage reported",
    conditionPhoto: "Condition photo",
    documentsSection: "Identity documents",
    portraitPhoto: "Personal photo",
    idFrontPhoto: "ID card / passport – front",
    idBackPhoto: "ID card / passport – back",
    licenceFrontPhoto: "Driving licence – front",
    licenceBackPhoto: "Driving licence – back",
    gtcSection: "Acceptance of the GTC",
    gtcAccepted:
      "The renter has read and accepted the General Terms and Conditions.",
    gtcVersion: "Version",
    gtcLanguage: "Language",
    acceptedAt: "Accepted at",
    signatureSection: "Renter's signature",
    signedBy: "Name in block capitals",
    placeAndDate: "Place, date, time",
    appendixTitle: "Appendix: General Terms and Conditions",
    page: "Page",
    of: "of",
    km: "km",
  },

  email: {
    officeSubject: "New rental contract",
    customerSubject: "Your rental contract – ZURIAUTO",
    customerGreeting:
      "Hello\n\nPlease find your signed rental contract attached.",
    customerPayment: "Pay by card:",
    customerSignature: "Kind regards\nZURIAUTO",
  },
};

export const RENTAL_LABELS = { de, en } as const;

export type RentalLabels = typeof de;

export function labelsFor(lang: RentalLanguage): RentalLabels {
  return RENTAL_LABELS[lang];
}
