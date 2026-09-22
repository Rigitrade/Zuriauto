/**
 * German and English strings for the fleet dashboard.
 *
 * Outside the i18n catalogue, for the reason lib/rental/labels.ts already
 * gives: the dashboard is a self-contained tool, and routing it through `t()`
 * would mean adding keys to locales/de.ts, locales/en.ts and types/i18n.ts for
 * strings nothing else uses.
 *
 * German is the default, matching the rest of the site.
 */

export type AdminLanguage = "de" | "en";

/** Per-browser, not per-account: not worth a column and a migration. */
export const ADMIN_LANGUAGE_KEY = "zuriauto_admin_lang";

export function asAdminLanguage(value: string | null | undefined): AdminLanguage {
  return value === "en" ? "en" : "de";
}

// Deliberately not `as const`: the literal types that would produce make
// `en: typeof de` unsatisfiable, since every English string differs.
const de = {
  signIn: {
    heading: "Flottenverwaltung",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    failed: "Anmeldung fehlgeschlagen.",
    rateLimited: "Zu viele Versuche. Bitte später erneut versuchen.",
  },
  nav: {
    signOut: "Abmelden",
    overview: "Übersicht",
    fleet: "Flotte",
    rentals: "Mieten",
    accounts: "Konten",
    history: "Verlauf",
    myPassword: "Mein Passwort",
    /** Screen-reader name for the section navigation itself. */
    sections: "Bereiche",
  },
  docs: {
    heading: "Dokumente",
    open: "Öffnen",
    preview: "Ansehen",
    newTab: "In neuem Tab öffnen",
    closePreview: "Vorschau schliessen",
    contract: "Vertrag",
    returnProtocol: "Rückgabeprotokoll",
    pdf: "PDF",
    none: "Keine Dokumente.",
    deletedOn: "Gelöscht am",
    retentionNote:
      "Bilder werden fünf Jahre nach Mietende gelöscht; Verträge zehn Jahre.",
    /** Kept in one place so a screenshot and a log line agree. */
    kinds: {
      PORTRAIT: "Foto",
      ID_FRONT: "Ausweis Vorderseite",
      ID_BACK: "Ausweis Rückseite",
      LICENCE_FRONT: "Führerausweis Vorderseite",
      LICENCE_BACK: "Führerausweis Rückseite",
      CONDITION_PHOTO: "Zustandsfoto",
      SIGNATURE: "Unterschrift",
      DAMAGE_PHOTO: "Schadenfoto",
    },
    audited: "Jeder Zugriff wird protokolliert.",
  },
  ret: {
    heading: "Rückgabe prüfen",
    submitted: "Eingereicht",
    distance: "Gefahren",
    mileage: "Kilometerstand",
    fuel: "Tankfüllung",
    condition: "Zustand",
    cleanliness: "Sauberkeit",
    clean: "Sauber",
    needsWash: "Waschen nötig",
    papers: "Papiere im Fahrzeug",
    key: "Schlüssel zurück",
    damages: "Schäden",
    noDamages: "Keine gemeldet",
    tickets: "Bussen",
    settlement: "Abrechnung",
    fullyPaid: "Vollständig bezahlt",
    paid: "Bezahlt",
    paidOn: "am",
    methods: "Zahlungsart",
    due: "Offener Betrag",
    dueOn: "fällig",
    deposit: "Kaution zurück",
    yes: "Ja",
    no: "Nein",
    unknown: "—",
    notRecorded: "Vor dieser Version eingereicht — nicht erfasst.",
    approve: "Rückgabe bestätigen und Fahrzeug freigeben",
    willCharge: "Bestätigen erstellt eine Forderung über",
    document: "Rückgabeprotokoll",
  },
  overview: {
    /** The band. Reads as a heading, so it names work rather than a status. */
    needsYou: "Zu erledigen",
    nothingWaiting: "Nichts offen.",
    nothingWaitingHint: "Alle Rückgaben bestätigt, keine Miete endet heute.",
    confirmReturn: "Rückgabe bestätigen",
    carStaysBlocked: "Fahrzeug bleibt gesperrt",
    endsToday: "Miete endet",
    overdue: "überfällig",
    mailNotDelivered: "Vertrag nicht zugestellt",
    sendAgain: "Erneut senden",
    sent: "Gesendet",
    open: "Öffnen",
    today: "Heute",
    noReturnsToday: "Heute keine Rückgaben.",
    returnsOn: "Rückgabe",
  },
  counts: {
    available: "Verfügbar",
    rented: "Vermietet",
    retired: "Ausser Betrieb",
    activeRentals: "Aktive Mieten",
    returnsAwaiting: "Rückgabe offen",
    contracts: "Verträge",
    mailFailed: "Mail offen",
  },
  fleet: {
    heading: "Fahrzeuge",
    model: "Marke und Modell",
    plate: "Kontrollschild",
    platePlaceholder: "ZH 123 456",
    vin: "Fahrgestell-Nr.",
    vinOptional: "Fahrgestell-Nr. (optional)",
    status: "Status",
    mfk: "MFK",
    mfkFull: "Nächste MFK",
    mfkOptional: "Nächste MFK (optional)",
    mfkNone: "—",
    mfkDue: "MFK fällig",
    mfkExpired: "MFK überfällig",
    mfkHint:
      "Zwei Tage vorher meldet sich das System. Steht das Fahrzeug frei, wird es auf «Werkstatt / MFK» gesetzt.",
    add: "Hinzufügen",
    addHeading: "Fahrzeug hinzufügen",
    close: "Schliessen",
    save: "Speichern",
    edit: "Bearbeiten",
    actions: "Aktionen",
    cancel: "Abbrechen",
    retire: "Ausser Betrieb",
    reactivate: "Wieder aktivieren",
    delete: "Löschen",
    deleteConfirm: "Wirklich löschen?",
    hasHistory: "Dieses Fahrzeug hat Mietverträge und kann nicht gelöscht werden. Bitte ausser Betrieb setzen.",
    empty: "Noch keine Fahrzeuge erfasst.",
    latestContract: "Letzter Vertrag",
    statuses: {
      available: "Verfügbar",
      rented: "Vermietet",
      maintenance: "Werkstatt / MFK",
      retired: "Ausser Betrieb",
    },
    toGarage: "In die Werkstatt",
    backOnRoad: "Wieder verfügbar",

    // --- Fahrzeug als vermietet erfassen (ohne Vertrag) ---
    markOut: "Als vermietet erfassen",
    markOutHeading: "Fahrzeug als vermietet erfassen",
    markOutHint:
      "Für ein Fahrzeug, das bereits unterwegs ist, ohne dass ein Vertrag erfasst wurde. Ohne diesen Eintrag erscheint es im Rückgabeformular nicht — und eine Rückgabe könnte nicht gespeichert werden.",
    markOutRenter: "Mieter (optional)",
    markOutRenterHint:
      "Nur ein Name auf der Miete. Ohne Geburtsdatum, Adresse oder Unterschrift — leer lassen, wenn nicht bekannt.",
    markOutFrom: "Unterwegs seit",
    markOutUntil: "Voraussichtliche Rückgabe",

    // --- Unterhalt: Kilometerstand, Service, Reparaturen, Foto ---
    maintenance: "Unterhalt",
    maintenanceFor: "Unterhalt –",
    mileage: "Kilometerstand",
    mileageShort: "km-Stand",
    mileageRead: "Abgelesen",
    mileageNever: "Noch nie abgelesen",
    service: "Service",
    serviceDone: "Service erledigt bei",
    serviceDoneOn: "Service-Datum",
    serviceDue: "Nächster Service bei",
    serviceDueShort: "Service fällig",
    serviceIn: "noch",
    serviceOverdueBy: "überfällig um",
    serviceOverdue: "Service überfällig",
    serviceHint:
      "Zahlen vom Armaturenbrett und vom Service-Kleber. Ohne beide Werte warnt das System nicht.",
    repairs: "Reparaturen",
    repairsPlanned: "Geplant",
    repairsDone: "Erledigt",
    repairsNone: "Keine Reparaturen erfasst.",
    repairAdd: "Reparatur erfassen",
    repairDetails: "Was ist zu tun?",
    repairDetailsPlaceholder: "z. B. Windschutzscheibe ersetzen",
    repairPlannedFor: "Geplant auf (optional)",
    repairDoneOn: "Erledigt am (optional)",
    repairMileage: "km-Stand (optional)",
    repairCost: "Kosten CHF (optional)",
    repairMarkDone: "Als erledigt markieren",
    repairReopen: "Wieder als geplant",
    repairDelete: "Eintrag löschen",
    repairBy: "erfasst von",
    photoHeading: "Fahrzeugfoto",
    photoHint:
      "Wird bei der Fahrzeugauswahl angezeigt. Wird vor dem Hochladen automatisch verkleinert.",
    photoChoose: "Foto wählen",
    photoReplace: "Foto ersetzen",
    photoRemove: "Foto entfernen",
    photoTooLarge: "Das Bild ist zu gross.",
    photoWrongType: "Nur JPEG, PNG oder WebP.",
    photoFailed: "Das Foto konnte nicht gespeichert werden.",
    photoUploading: "Wird hochgeladen …",
    photoSavesNow: "Das Foto wird sofort gespeichert – unabhängig von «Speichern».",

    // --- Farbe ---
    //
    // Eine Auswahlliste, keine Freitextfeld: die Farbe wird bei der
    // Fahrzeugauswahl als Farbpunkt angezeigt, und «Perlmuttweiss» lässt sich
    // nicht zeichnen. Siehe lib/carColour.ts.
    colour: "Farbe",
    colourOptional: "Farbe (optional)",
    colourChoose: "Bitte wählen",
    colourNone: "Keine Farbe erfasst",

    // --- Letzte MFK ---
    mfkLast: "Letzte MFK",
    mfkLastOptional: "Letzte MFK (optional)",
    mfkLastHint:
      "Das Datum der bereits erfolgten Prüfung. Wird nicht berechnet — steht auf dem Prüfbericht.",
    mfkLastAfterNext:
      "Die letzte MFK liegt nach der nächsten. Bitte die beiden Daten prüfen.",

    // --- Fahrzeugausweis ---
    //
    // Nicht öffentlich, im Unterschied zum Fahrzeugfoto: der Ausweis nennt
    // Halter, Erstinverkehrsetzung und Gewichte.
    licenceHeading: "Fahrzeugausweis",
    licenceHint:
      "Foto oder Scan (PDF) des Fahrzeugausweises. Nur für angemeldete Konten sichtbar.",
    licenceChoose: "Ausweis hinterlegen",
    licenceReplace: "Ausweis ersetzen",
    licenceRemove: "Ausweis entfernen",
    licenceOpen: "Ausweis öffnen",
    licenceNone: "Kein Fahrzeugausweis hinterlegt.",
    licenceUploading: "Wird hochgeladen …",
    licenceFailed: "Der Fahrzeugausweis konnte nicht gespeichert werden.",
    licenceTooLarge: "Die Datei ist zu gross (max. 5 MB).",
    licenceWrongType: "Nur JPEG, PNG, WebP oder PDF.",
    licenceUpdated: "Hinterlegt am",
    licencePdf: "PDF-Dokument",
    licenceSavesNow:
      "Der Ausweis wird sofort gespeichert – unabhängig von «Speichern».",

    // --- Dokumente ---
    // Die Überschrift über Foto und Ausweis im Bearbeiten-Dialog, und der
    // eine Satz, der für beide gilt. Einmal gesagt statt zweimal: zweimal
    // liest sich wie zwei verschiedene Warnungen.
    documentsHeading: "Dokumente",
    documentsSaveNow:
      "Foto und Ausweis werden sofort gespeichert – unabhängig von «Speichern».",

    // --- Fahrzeugprofil ---
    profile: "Fahrzeugprofil",
    profileOpen: "Profil öffnen",
    profileBack: "Zurück zur Flotte",
    profileNotFound: "Dieses Fahrzeug gibt es nicht.",
    profileIdentity: "Fahrzeug",
    profileInspection: "MFK",
    profileRentals: "Mietverlauf",
    profileRentalsNone: "Noch keine Mieten erfasst.",
    profileRentalsMore: "Vollständigen Verlauf öffnen",
    profileNothing: "—",

    // --- Datumseingabe ---
    //
    // Ein Textfeld statt <input type="date">: das native Feld zeigt das
    // Format des Browsers, und auf einem englisch eingestellten Rechner ist
    // das MM/TT/JJJJ. Bei einem Prüfdatum ist das kein Schönheitsfehler.
    datePlaceholder: "TT.MM.JJJJ",
    dateInvalid: "Bitte als TT.MM.JJJJ eingeben.",

    // --- Foto beim Hinzufügen ---
    photoAfterAdd:
      "Das Foto wird zusammen mit dem Fahrzeug gespeichert.",
    waitlistCount: "Personen warten auf ein freies Fahrzeug",
  },
  rentals: {
    heading: "Laufende Mieten",
    returned: "Zurückgegeben – bestätigen",
    returnedOn: "Rückgabe",
    close: "Abschliessen",
    closeConfirm: "Wirklich abschliessen",
    cancel: "Abbrechen",
    none: "Keine laufenden Mieten.",
    closeHint: "«Abschliessen» gibt das Fahrzeug frei und ersetzt nicht das Rückgabeprotokoll.",
  },
  history: {
    heading: "Fahrzeugverlauf",
    lead: "Wer hatte dieses Fahrzeug? Kontrollschild oder Modell suchen, bei Bedarf mit Datum der Übertretung.",
    search: "Fahrzeug suchen",
    searchPlaceholder: "ZH 589 864 oder Vito",
    noCars: "Kein Fahrzeug gefunden.",
    matches: "Fahrzeuge",
    change: "Anderes Fahrzeug",
    from: "Von",
    to: "Bis",
    dateHint: "Leer lassen für die ganze Historie. Nur «Von» ausfüllen für einen einzelnen Tag.",
    apply: "Suchen",
    clear: "Ganze Historie",
    windowLabel: "Zeitraum",
    wholeHistory: "Ganze Historie",
    heldBy: "In diesem Zeitraum war das Fahrzeug bei",
    noneInWindow:
      "In diesem Zeitraum ist keine Miete erfasst — das Fahrzeug stand beim Betrieb.",
    noneEver: "Für dieses Fahrzeug sind keine Mieten erfasst.",
    period: "Zeitraum",
    renter: "Mieter",
    contact: "Kontakt",
    contract: "Vertrag",
    noContract: "Kein Vertrag erfasst",
    documents: "Dokumente",
    cancelledHint: "Storniert — das Fahrzeug wurde nie übergeben.",
    audited: "Jede Suche wird protokolliert.",
    failed: "Der Verlauf konnte nicht geladen werden.",

    // --- Zeitraum nachtragen (nur für die aus PDF übernommenen Mieten) ---
    editPeriod: "Zeitraum nachtragen",
    editPeriodHeading: "Zeitraum nachtragen",
    editPeriodHint:
      "Diese Miete wurde aus einem unterschriebenen PDF übernommen. Das Dokument nennt keinen Zeitraum, deshalb stehen Beginn und Rückgabe auf demselben Moment. Was hier eingetragen wird, steht auf keinem Dokument — es wird protokolliert.",
    periodStart: "Beginn",
    periodEnd: "Rückgabe",
    periodSame: "Beginn und Rückgabe sind identisch — die Rückgabe ist nicht erfasst.",
    periodSaved: "Zeitraum gespeichert.",
    statuses: {
      ACTIVE: "Laufend",
      EXTENSION_REQUESTED: "Verlängerung angefragt",
      RETURN_SUBMITTED: "Rückgabe gemeldet",
      COMPLETED: "Abgeschlossen",
      CANCELLED: "Storniert",
    },
  },
  accounts: {
    heading: "Konten",
    displayName: "Name",
    username: "Benutzername",
    role: "Rolle",
    lastSignIn: "Letzte Anmeldung",
    never: "nie",
    newPassword: "Neues Passwort",
    setPassword: "Passwort setzen",
    disable: "Deaktivieren",
    enable: "Aktivieren",
    disabled: "Deaktiviert",
    create: "Konto erstellen",
    addHeading: "Person hinzufügen",
    close: "Schliessen",
    you: "Sie",
    lastOwnerHint: "Einziger Inhaber – kann nicht geändert oder deaktiviert werden.",
    roles: { owner: "Inhaber", staff: "Mitarbeiter" },
    usernameTaken: "Dieser Benutzername ist bereits vergeben.",
    lastOwner: "Das ist der letzte Inhaber. Bitte zuerst einen weiteren Inhaber bestimmen.",
    passwordTooShort: "Mindestens 10 Zeichen.",
    usernameInvalid: "Nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich; 3–32 Zeichen.",
    myPassword: "Mein Passwort",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort verbergen",
    passwordChangedSignOut: "Passwort geändert. Bitte erneut anmelden.",
  },
  errors: {
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    signedOut: "Sitzung abgelaufen. Bitte erneut anmelden.",
    duplicatePlate: "Dieses Kontrollschild ist bereits vergeben.",
    statusChangeRefused: "Dieser Statuswechsel ist gerade nicht möglich.",
    alreadyClosed: "Diese Miete ist bereits abgeschlossen.",
    alreadySent: "Dieser Vertrag wurde bereits versendet.",
    noDocument: "Das PDF zu diesem Vertrag ist nicht auffindbar.",
    mailFailed: "Der Versand ist fehlgeschlagen. Bitte später erneut versuchen.",
    mailNotConfigured: "E-Mail-Versand ist derzeit nicht eingerichtet.",
    notFound: "Nicht gefunden.",
    forbidden: "Keine Berechtigung.",
    notConfigured: "Server ist nicht eingerichtet.",
    invalid: "Ungültige Eingabe.",
    windowReversed: "Das Enddatum liegt vor dem Startdatum.",
    endBeforeStart: "Die Rückgabe liegt vor dem Beginn.",
    endInPast: "Die voraussichtliche Rückgabe darf nicht in der Vergangenheit liegen — sonst wird der Mieter morgen früh gemahnt.",
    notAvailable: "Dieses Fahrzeug ist nicht als verfügbar erfasst.",
    alreadyOut: "Für dieses Fahrzeug läuft bereits eine Miete.",
    signedPeriod:
      "Der Zeitraum steht auf einem unterschriebenen Vertrag und kann hier nicht geändert werden.",
  },
};

const en: typeof de = {
  signIn: {
    heading: "Fleet management",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    failed: "Sign-in failed.",
    rateLimited: "Too many attempts. Please try again later.",
  },
  nav: {
    signOut: "Sign out",
    overview: "Overview",
    fleet: "Fleet",
    rentals: "Rentals",
    accounts: "Accounts",
    history: "History",
    myPassword: "My password",
    /** Screen-reader name for the section navigation itself. */
    sections: "Sections",
  },
  docs: {
    heading: "Documents",
    open: "Open",
    preview: "View",
    newTab: "Open in a new tab",
    closePreview: "Close preview",
    contract: "Contract",
    returnProtocol: "Return protocol",
    pdf: "PDF",
    none: "No documents.",
    deletedOn: "Deleted on",
    retentionNote:
      "Images are deleted five years after the rental ends; contracts after ten.",
    /** Kept in one place so a screenshot and a log line agree. */
    kinds: {
      PORTRAIT: "Photo",
      ID_FRONT: "ID front",
      ID_BACK: "ID back",
      LICENCE_FRONT: "Licence front",
      LICENCE_BACK: "Licence back",
      CONDITION_PHOTO: "Condition photo",
      SIGNATURE: "Signature",
      DAMAGE_PHOTO: "Damage photo",
    },
    audited: "Every view is logged.",
  },
  ret: {
    heading: "Review the return",
    submitted: "Submitted",
    distance: "Distance driven",
    mileage: "Odometer",
    fuel: "Fuel",
    condition: "Condition",
    cleanliness: "Cleanliness",
    clean: "Clean",
    needsWash: "Needs a wash",
    papers: "Papers in the car",
    key: "Key returned",
    damages: "Damage",
    noDamages: "None reported",
    tickets: "Fines",
    settlement: "Settlement",
    fullyPaid: "Paid in full",
    paid: "Paid",
    paidOn: "on",
    methods: "Method",
    due: "Still owed",
    dueOn: "due",
    deposit: "Deposit returned",
    yes: "Yes",
    no: "No",
    unknown: "—",
    notRecorded: "Submitted before this version — not recorded.",
    approve: "Confirm the return and free the car",
    willCharge: "Confirming raises a charge for",
    document: "Return protocol",
  },
  overview: {
    /** The band. Reads as a heading, so it names work rather than a status. */
    needsYou: "Needs you",
    nothingWaiting: "Nothing waiting.",
    nothingWaitingHint: "Every return confirmed, no rental ending today.",
    confirmReturn: "Confirm return",
    carStaysBlocked: "Car stays blocked",
    endsToday: "Rental ends",
    overdue: "overdue",
    mailNotDelivered: "Contract was not delivered",
    sendAgain: "Send again",
    sent: "Sent",
    open: "Open",
    today: "Today",
    noReturnsToday: "No returns today.",
    returnsOn: "Returns",
  },
  counts: {
    available: "Available",
    rented: "Rented out",
    retired: "Off the road",
    activeRentals: "Active rentals",
    returnsAwaiting: "Returns to confirm",
    contracts: "Contracts",
    mailFailed: "Mail unsent",
  },
  fleet: {
    heading: "Vehicles",
    model: "Make and model",
    plate: "Plate",
    platePlaceholder: "ZH 123 456",
    vin: "Chassis no.",
    vinOptional: "Chassis no. (optional)",
    status: "Status",
    mfk: "MFK",
    // "MFK", not "inspection", even in the English column. It is the name
    // printed on the certificate and the word the garage uses on the phone,
    // and translating it invented a second thing for the office to wonder
    // about — somebody reading "next inspection" beside a service book quite
    // reasonably asked which of the two it meant.
    mfkFull: "Next MFK",
    mfkOptional: "Next MFK (optional)",
    mfkNone: "—",
    mfkDue: "MFK due",
    mfkExpired: "MFK overdue",
    mfkHint:
      "The system speaks up two days before. If the car is free, it is moved to “Garage / MFK”.",
    add: "Add",
    addHeading: "Add a vehicle",
    close: "Close",
    save: "Save",
    edit: "Edit",
    actions: "Actions",
    cancel: "Cancel",
    retire: "Take off the road",
    reactivate: "Put back on the road",
    delete: "Delete",
    deleteConfirm: "Delete this car?",
    hasHistory: "This car has rental history and cannot be deleted. Take it off the road instead.",
    empty: "No vehicles added yet.",
    latestContract: "Latest contract",
    statuses: {
      available: "Available",
      rented: "Rented out",
      maintenance: "Garage / MFK",
      retired: "Off the road",
    },
    toGarage: "To the garage",
    backOnRoad: "Back on the road",

    // --- Recording a car as out, with no contract behind it ---
    markOut: "Mark as rented out",
    markOutHeading: "Mark this car as rented out",
    markOutHint:
      "For a car that is already out with no contract recorded. Without this it does not appear on the return form — and a return could not be saved against it.",
    markOutRenter: "Renter (optional)",
    markOutRenterHint:
      "Just a name on the rental. No birth date, address or signature behind it — leave it empty if you do not know.",
    markOutFrom: "Out since",
    markOutUntil: "Expected back",

    // --- Maintenance: mileage, service, repairs, photo ---
    maintenance: "Maintenance",
    maintenanceFor: "Maintenance –",
    mileage: "Mileage",
    mileageShort: "Mileage",
    mileageRead: "Read",
    mileageNever: "Never read",
    service: "Service",
    serviceDone: "Last service at",
    serviceDoneOn: "Service date",
    serviceDue: "Next service at",
    serviceDueShort: "Service due",
    serviceIn: "in",
    serviceOverdueBy: "overdue by",
    serviceOverdue: "Service overdue",
    serviceHint:
      "Figures from the dashboard and the service sticker. Without both, the system stays quiet.",
    repairs: "Repairs",
    repairsPlanned: "Planned",
    repairsDone: "Done",
    repairsNone: "No repairs recorded.",
    repairAdd: "Record a repair",
    repairDetails: "What needs doing?",
    repairDetailsPlaceholder: "e.g. replace the windscreen",
    repairPlannedFor: "Planned for (optional)",
    repairDoneOn: "Done on (optional)",
    repairMileage: "Mileage (optional)",
    repairCost: "Cost CHF (optional)",
    repairMarkDone: "Mark as done",
    repairReopen: "Back to planned",
    repairDelete: "Delete entry",
    repairBy: "recorded by",
    photoHeading: "Vehicle photo",
    photoHint:
      "Shown when a car is picked. Resized automatically before it is uploaded.",
    photoChoose: "Choose a photo",
    photoReplace: "Replace the photo",
    photoRemove: "Remove the photo",
    photoTooLarge: "That image is too large.",
    photoWrongType: "JPEG, PNG or WebP only.",
    photoFailed: "The photo could not be saved.",
    photoUploading: "Uploading …",
    photoSavesNow: "The photo is saved straight away — it does not wait for Save.",

    // --- Colour ---
    //
    // A list, not a free-text field: the colour is shown as a swatch when a
    // car is picked, and "Perlmuttweiss" cannot be painted. See
    // lib/carColour.ts.
    colour: "Colour",
    colourOptional: "Colour (optional)",
    colourChoose: "Please select",
    colourNone: "No colour recorded",

    // --- Last MFK ---
    mfkLast: "Last MFK",
    mfkLastOptional: "Last MFK (optional)",
    mfkLastHint:
      "The date of the inspection that already happened. Never calculated — it is on the report.",
    mfkLastAfterNext:
      "The last MFK falls after the next one. Please check both dates.",

    // --- Vehicle registration ---
    //
    // Not public, unlike the vehicle photo: the registration names the
    // holder, the first registration and the weights.
    licenceHeading: "Vehicle registration",
    licenceHint:
      "A photo or scan (PDF) of the registration document. Visible only to signed-in accounts.",
    licenceChoose: "Add the registration",
    licenceReplace: "Replace the registration",
    licenceRemove: "Remove the registration",
    licenceOpen: "Open the registration",
    licenceNone: "No registration document on file.",
    licenceUploading: "Uploading …",
    licenceFailed: "The registration document could not be saved.",
    licenceTooLarge: "That file is too large (5 MB max).",
    licenceWrongType: "JPEG, PNG, WebP or PDF only.",
    licenceUpdated: "On file since",
    licencePdf: "PDF document",
    licenceSavesNow:
      "The registration is saved straight away — it does not wait for Save.",

    // --- Documents ---
    // The heading over the photo and the registration in the edit dialog, and
    // the one sentence that covers both. See the German.
    documentsHeading: "Documents",
    documentsSaveNow:
      "The photo and the registration are saved as soon as you choose a file — they do not wait for Save.",

    // --- Car profile ---
    profile: "Car profile",
    profileOpen: "Open the profile",
    profileBack: "Back to the fleet",
    profileNotFound: "There is no such car.",
    profileIdentity: "Vehicle",
    profileInspection: "MFK",
    profileRentals: "Rental history",
    profileRentalsNone: "No rentals recorded yet.",
    profileRentalsMore: "Open the full history",
    profileNothing: "—",

    // --- Typing a date ---
    //
    // A text field rather than <input type="date">: the native one shows the
    // browser's format, and on a machine set to English that is MM/DD/YYYY.
    // On an inspection date that is not a cosmetic problem.
    datePlaceholder: "DD.MM.YYYY",
    dateInvalid: "Please enter it as DD.MM.YYYY.",

    // --- The photo, while adding a car ---
    photoAfterAdd: "The photo is saved together with the vehicle.",
    waitlistCount: "people waiting for a car",
  },
  rentals: {
    heading: "Open rentals",
    returned: "Returned – confirm",
    returnedOn: "Returned",
    close: "Close",
    closeConfirm: "Yes, close it",
    cancel: "Cancel",
    none: "No open rentals.",
    closeHint: "“Close” frees the car and does not replace the return protocol.",
  },
  history: {
    heading: "Vehicle history",
    lead: "Who had this car? Search a plate or a model, and add the date of the offence if you have one.",
    search: "Find a vehicle",
    searchPlaceholder: "ZH 589 864 or Vito",
    noCars: "No vehicle matches that.",
    matches: "vehicles",
    change: "Another vehicle",
    from: "From",
    to: "To",
    dateHint: "Leave empty for the whole history. Fill in only “From” for a single day.",
    apply: "Search",
    clear: "Whole history",
    windowLabel: "Period",
    wholeHistory: "Whole history",
    heldBy: "Over this period the car was with",
    noneInWindow: "No rental covers this period — the car was with the office.",
    noneEver: "No rentals recorded for this vehicle.",
    period: "Period",
    renter: "Renter",
    contact: "Contact",
    contract: "Contract",
    noContract: "No contract recorded",
    documents: "Documents",
    cancelledHint: "Cancelled — the car was never handed over.",
    audited: "Every search is logged.",
    failed: "The history could not be loaded.",

    // --- Filling in a period (only for the rentals taken from the PDFs) ---
    editPeriod: "Add the period",
    editPeriodHeading: "Add the period",
    editPeriodHint:
      "This rental was taken from a signed PDF. The document states no period, which is why the start and the return sit on the same moment. Anything entered here appears on no document, and is recorded against your name.",
    periodStart: "Start",
    periodEnd: "Return",
    periodSame: "Start and return are the same — the return is not recorded.",
    periodSaved: "Period saved.",
    statuses: {
      ACTIVE: "Running",
      EXTENSION_REQUESTED: "Extension requested",
      RETURN_SUBMITTED: "Return submitted",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
  accounts: {
    heading: "Accounts",
    displayName: "Name",
    username: "Username",
    role: "Role",
    lastSignIn: "Last sign-in",
    never: "never",
    newPassword: "New password",
    setPassword: "Set password",
    disable: "Disable",
    enable: "Enable",
    disabled: "Disabled",
    create: "Create account",
    addHeading: "Add a person",
    close: "Close",
    you: "You",
    lastOwnerHint: "Only owner — cannot be changed or disabled.",
    roles: { owner: "Owner", staff: "Staff" },
    usernameTaken: "That username is already taken.",
    lastOwner: "This is the last owner. Make somebody else an owner first.",
    passwordTooShort: "At least 10 characters.",
    usernameInvalid: "Lowercase letters, digits, dot, hyphen and underscore only; 3–32 characters.",
    myPassword: "My password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordChangedSignOut: "Password changed. Please sign in again.",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    signedOut: "Session expired. Please sign in again.",
    duplicatePlate: "That plate is already registered.",
    statusChangeRefused: "That status change isn't possible right now.",
    alreadyClosed: "This rental is already closed.",
    alreadySent: "That contract has already been sent.",
    noDocument: "The PDF for that contract cannot be found.",
    mailFailed: "Sending failed. Please try again later.",
    mailNotConfigured: "Email delivery is not set up right now.",
    notFound: "Not found.",
    forbidden: "Not permitted.",
    notConfigured: "Server is not configured.",
    invalid: "Invalid input.",
    windowReversed: "The end date falls before the start date.",
    endBeforeStart: "The return falls before the start.",
    endInPast: "The expected return cannot be in the past — the renter would be chased tomorrow morning.",
    notAvailable: "This car is not recorded as available.",
    alreadyOut: "A rental is already running for this car.",
    signedPeriod:
      "This period is stated on a signed contract and cannot be changed here.",
  },
};

export function labelsFor(language: AdminLanguage): typeof de {
  return language === "en" ? en : de;
}

export type AdminLabels = ReturnType<typeof labelsFor>;

/**
 * Turns an API failure `code` into a message a caller can act on.
 *
 * Shared rather than duplicated per screen: the fleet writes here and the
 * accounts screen a later task adds both call the same admin routes' error
 * shape (`{ code }`), so one map keeps "unauthorised" or "not-found" reading
 * the same everywhere they can occur, not just where they were first wired
 * up. An unrecognised code still surfaces — appended to the generic message,
 * the way the very first version of this dashboard did before per-code
 * messages existed — so a report of "something went wrong (whatever-code)"
 * is still enough to grep the server logs.
 */
export function messageForCode(L: AdminLabels, code: string | undefined): string {
  const known: Record<string, string> = {
    "duplicate-plate": L.errors.duplicatePlate,
    "status-change-refused": L.errors.statusChangeRefused,
    "has-history": L.fleet.hasHistory,
    "already-closed": L.errors.alreadyClosed,
    "already-sent": L.errors.alreadySent,
    "no-document": L.errors.noDocument,
    incomplete: L.errors.noDocument,
    "mail-failed": L.errors.mailFailed,
    "mail-not-configured": L.errors.mailNotConfigured,
    "username-taken": L.accounts.usernameTaken,
    "last-owner": L.accounts.lastOwner,
    "not-found": L.errors.notFound,
    forbidden: L.errors.forbidden,
    "not-configured": L.errors.notConfigured,
    invalid: L.errors.invalid,
    "window-reversed": L.errors.windowReversed,
    // Correcting a period is refused for anything carrying a signed contract.
    // Not a permission problem, so it must not read like one — the office
    // would go looking for an owner who cannot help either.
    "signed-period": L.errors.signedPeriod,
    "not-available": L.errors.notAvailable,
    "already-out": L.errors.alreadyOut,
    endInPast: L.errors.endInPast,
    notADay: L.errors.invalid,
    endBeforeStart: L.errors.endBeforeStart,
    notADateTime: L.errors.invalid,
    "bad-request": L.errors.invalid,
    unauthorised: L.errors.signedOut,
    // A photo upload the endpoint refused. Named separately because "too big"
    // and "we do not take that format" call for different things from
    // whoever is holding the phone, and one generic failure would leave them
    // retrying the same file.
    "too-large": L.fleet.photoTooLarge,
    "unsupported-type": L.fleet.photoWrongType,
    empty: L.fleet.photoFailed,
  };
  if (code && known[code]) return known[code];
  return code ? `${L.errors.generic} (${code})` : L.errors.generic;
}
