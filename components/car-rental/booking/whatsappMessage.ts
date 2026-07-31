import type { FormData, Package } from "./types";

/**
 * Builds the booking message sent to the office over WhatsApp.
 *
 * Pure: text in, text out. No DOM and no side effects, so it can be exercised
 * directly rather than only by driving the form.
 *
 * Labels live here rather than in the i18n catalogue. The message is a
 * self-contained document, and routing it through `t()` would mean adding keys
 * to locales/de.ts, locales/en.ts and types/i18n.ts for strings nothing else
 * uses - the same reasoning that keeps locales/gtc.ts separate.
 */

export type MessageLanguage = "de" | "en";

const LABELS = {
  de: {
    heading: "NEUE BUCHUNG – ZURIAUTO",
    package: "Paket",
    pickupLocation: "Abholort",
    pickup: "Abholung",
    dropoffLocation: "Rückgabeort",
    dropoff: "Rückgabe",
    duration: "Mietdauer",
    total: "Gesamt",
    customer: "Kunde",
    company: "Firma",
    person: "Privatperson",
    companyType: "Firmenkunde",
    email: "E-Mail",
    phone: "Telefon",
    birthDate: "Geburtsdatum",
    address: "Adresse",
    license: "Führerschein",
    licenseSince: "seit",
    issuedIn: "Ausgestellt in",
    days: "Tag(e)",
    office: "Unser Büro",
    delivery: "Lieferung an Wunschort",
    at: "um",
    notProvided: "–",
  },
  en: {
    heading: "NEW BOOKING – ZURIAUTO",
    package: "Package",
    pickupLocation: "Pickup location",
    pickup: "Pickup",
    dropoffLocation: "Return location",
    dropoff: "Return",
    duration: "Duration",
    total: "Total",
    customer: "Customer",
    company: "Company",
    person: "Private customer",
    companyType: "Business customer",
    email: "Email",
    phone: "Phone",
    birthDate: "Date of birth",
    address: "Address",
    license: "Driving licence",
    licenseSince: "since",
    issuedIn: "Issued in",
    days: "day(s)",
    office: "Our office",
    delivery: "Delivery to chosen address",
    at: "at",
    notProvided: "–",
  },
} as const;

/** The form stores dates as YYYY-MM-DD; people read DD.MM.YYYY. */
function formatDate(value: string, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  // Anything unexpected is passed through rather than silently dropped.
  return value;
}

/** Location fields hold a key, not a readable name. */
function formatLocation(
  value: string,
  labels: (typeof LABELS)[MessageLanguage]
): string {
  if (value === "office") return labels.office;
  if (value === "delivery") return labels.delivery;
  return value || labels.notProvided;
}

function line(label: string, value: string): string {
  return `*${label}:* ${value}`;
}

export function buildBookingMessage(
  formData: FormData,
  selectedPackage: Package | undefined,
  days: number | undefined,
  totalPrice: string | undefined,
  lang: MessageLanguage = "de"
): string {
  const L = LABELS[lang];
  const dash = L.notProvided;

  const packageText = selectedPackage
    ? `${selectedPackage.name} – ${selectedPackage.price}`
    : dash;

  const isCompany = formData.bookingType === "company";
  const customerType = isCompany ? L.companyType : L.person;
  const fullName = `${formData.firstName} ${formData.lastName}`.trim() || dash;

  const addressParts = [
    formData.street,
    formData.postalCode,
    formData.country,
  ].filter((part) => typeof part === "string" && part.trim().length > 0);

  const licenceText = formData.licenseNumber
    ? `${formData.licenseNumber}${
        formData.licenseSince
          ? `, ${L.licenseSince} ${formatDate(formData.licenseSince, dash)}`
          : ""
      }`
    : dash;

  const issuedIn =
    [formData.issuingCity, formData.issuingCountry]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(", ") || dash;

  const booking = [
    line(L.package, packageText),
    line(L.pickupLocation, formatLocation(formData.pickupLocation, L)),
    line(
      L.pickup,
      `${formatDate(formData.pickupDate, dash)} ${L.at} ${
        formData.pickupTime || dash
      }`
    ),
    line(L.dropoffLocation, formatLocation(formData.dropoffLocation, L)),
    line(
      L.dropoff,
      `${formatDate(formData.dropoffDate, dash)} ${L.at} ${
        formData.dropoffTime || dash
      }`
    ),
    line(L.duration, `${days ?? 0} ${L.days}`),
    line(L.total, totalPrice || dash),
  ];

  const customer = [
    line(L.customer, `${fullName} (${customerType})`),
    ...(isCompany ? [line(L.company, formData.companyName || dash)] : []),
    line(L.email, formData.email || dash),
    line(L.phone, formData.phone ? `+${formData.phone}` : dash),
    line(L.birthDate, formatDate(formData.dateOfBirth, dash)),
    line(L.address, addressParts.join(", ") || dash),
    line(L.license, licenceText),
    line(L.issuedIn, issuedIn),
  ];

  return [`*${L.heading}*`, "", ...booking, "", ...customer].join("\n");
}
