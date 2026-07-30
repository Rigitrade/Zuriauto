// lib/i18n.ts - Simplified version without LanguageDetector
import en from "@/locales/en";
import de from "@/locales/de";
import i18n from "i18next";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// Translation resources
const resources = {
  de: de,
  en: en,
};

// Always start with German to ensure server/client consistency
const getInitialLanguage = (): string => {
  return "de"; // Always start with German for both server and client
};

i18n
  // Load translation using http backend
  .use(Backend)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: "de",
    lng: getInitialLanguage(), // Use our custom function

    // Supported languages
    supportedLngs: ["de", "en"],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Namespace configuration
    defaultNS: "common",
    ns: ["common", "navigation", "theme", "language", "features", "badges"],

    // Development settings
    debug: process.env.NODE_ENV === "development",

    // React options to prevent hydration mismatches
    react: {
      useSuspense: false,
    },
  });

export default i18n;
