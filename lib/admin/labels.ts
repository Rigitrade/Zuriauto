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
    fleet: "Flotte",
    rentals: "Mieten",
    accounts: "Konten",
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
    vin: "Fahrgestell-Nr.",
    status: "Status",
    add: "Hinzufügen",
    save: "Speichern",
    retire: "Ausser Betrieb",
    reactivate: "Wieder aktivieren",
    delete: "Löschen",
    deleteConfirm: "Wirklich löschen?",
    hasHistory: "Dieses Fahrzeug hat Mietverträge und kann nicht gelöscht werden. Bitte ausser Betrieb setzen.",
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
  },
  errors: {
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    signedOut: "Sitzung abgelaufen. Bitte erneut anmelden.",
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
    fleet: "Fleet",
    rentals: "Rentals",
    accounts: "Accounts",
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
    vin: "Chassis no.",
    status: "Status",
    add: "Add",
    save: "Save",
    retire: "Take off the road",
    reactivate: "Put back on the road",
    delete: "Delete",
    deleteConfirm: "Delete this car?",
    hasHistory: "This car has rental history and cannot be deleted. Take it off the road instead.",
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
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    signedOut: "Session expired. Please sign in again.",
  },
};

export function labelsFor(language: AdminLanguage): typeof de {
  return language === "en" ? en : de;
}
