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
    myPassword: "Mein Passwort",
    /** Screen-reader name for the section navigation itself. */
    sections: "Bereiche",
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
    add: "Hinzufügen",
    save: "Speichern",
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
      maintenance: "Werkstatt",
      retired: "Ausser Betrieb",
    },
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
    roles: { owner: "Inhaber", staff: "Mitarbeiter" },
    usernameTaken: "Dieser Benutzername ist bereits vergeben.",
    lastOwner: "Das ist der letzte Inhaber. Bitte zuerst einen weiteren Inhaber bestimmen.",
    passwordTooShort: "Mindestens 10 Zeichen.",
    usernameInvalid: "Nur Kleinbuchstaben, Zahlen, Punkt, Bindestrich und Unterstrich; 3–32 Zeichen.",
    myPassword: "Mein Passwort",
    passwordChangedSignOut: "Passwort geändert. Bitte erneut anmelden.",
  },
  errors: {
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    signedOut: "Sitzung abgelaufen. Bitte erneut anmelden.",
    duplicatePlate: "Dieses Kontrollschild ist bereits vergeben.",
    statusChangeRefused: "Dieser Statuswechsel ist gerade nicht möglich.",
    alreadyClosed: "Diese Miete ist bereits abgeschlossen.",
    notFound: "Nicht gefunden.",
    forbidden: "Keine Berechtigung.",
    notConfigured: "Server ist nicht eingerichtet.",
    invalid: "Ungültige Eingabe.",
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
    myPassword: "My password",
    /** Screen-reader name for the section navigation itself. */
    sections: "Sections",
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
    add: "Add",
    save: "Save",
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
      maintenance: "In the garage",
      retired: "Off the road",
    },
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
    roles: { owner: "Owner", staff: "Staff" },
    usernameTaken: "That username is already taken.",
    lastOwner: "This is the last owner. Make somebody else an owner first.",
    passwordTooShort: "At least 10 characters.",
    usernameInvalid: "Lowercase letters, digits, dot, hyphen and underscore only; 3–32 characters.",
    myPassword: "My password",
    passwordChangedSignOut: "Password changed. Please sign in again.",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    signedOut: "Session expired. Please sign in again.",
    duplicatePlate: "That plate is already registered.",
    statusChangeRefused: "That status change isn't possible right now.",
    alreadyClosed: "This rental is already closed.",
    notFound: "Not found.",
    forbidden: "Not permitted.",
    notConfigured: "Server is not configured.",
    invalid: "Invalid input.",
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
    "username-taken": L.accounts.usernameTaken,
    "last-owner": L.accounts.lastOwner,
    "not-found": L.errors.notFound,
    forbidden: L.errors.forbidden,
    "not-configured": L.errors.notConfigured,
    invalid: L.errors.invalid,
    "bad-request": L.errors.invalid,
    unauthorised: L.errors.signedOut,
  };
  if (code && known[code]) return known[code];
  return code ? `${L.errors.generic} (${code})` : L.errors.generic;
}
