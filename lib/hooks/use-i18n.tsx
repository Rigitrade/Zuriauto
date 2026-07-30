// hooks/use-i18n.ts
import type { TranslationKeys } from "@/types/i18n";
import { useTranslation } from "react-i18next";

// Create a type for flattened translation keys using colon notation (namespace:key:subkey)
type FlattenKeys<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends object
    ? FlattenKeys<T[K], `${Prefix}${K & string}:`> | `${Prefix}${K & string}`
    : `${Prefix}${K & string}`;
}[keyof T];

// Create the flattened key type from your translations
type TranslationKey = FlattenKeys<TranslationKeys>;

// SOLUTION 1: Extract types from useTranslation return (Cleanest!)
type OriginalT = ReturnType<typeof useTranslation>["t"];
type TypedTFunction = (
  key: TranslationKey,
  ...args: Parameters<OriginalT> extends [unknown, ...infer Rest] ? Rest : []
) => ReturnType<OriginalT>;

export function useI18n() {
  const { t: originalT, i18n } = useTranslation();

  // Cast the t function to our typed version
  const t = originalT as TypedTFunction;

  const changeLanguage = async (language: string) => {
    // Validate language
    if (!["de", "en"].includes(language)) {
      console.warn(`Unsupported language: ${language}`);
      return;
    }

    try {
      await i18n.changeLanguage(language);

      // Update document direction and language
      const isRTL = language === "ar"; // Keep this for future RTL support
      document.documentElement.dir = isRTL ? "rtl" : "ltr";
      document.documentElement.lang = language;

      // Store preference - this is the key fix
      localStorage.setItem("preferred-language", language);

      console.log(`Language changed to: ${language}`);
    } catch (error) {
      console.error("Failed to change language:", error);
    }
  };

  const isRTL = i18n.language === "ar";
  const currentLanguage = i18n.language;

  return {
    t, // Clean autocomplete with all react-i18next features!
    i18n,
    changeLanguage,
    isRTL,
    currentLanguage,
    languages: [
      { code: "de", name: "German", nativeName: "Deutsch" },
      { code: "en", name: "English", nativeName: "English" },
    ],
  };
}

// Utility function for conditional RTL classes
export function RTL(
  rtlClass: string,
  ltrClass: string = "",
  currentLang?: string
) {
  const { i18n } = useTranslation();
  const lang = currentLang || i18n.language;
  return lang === "ar" ? rtlClass : ltrClass;
}

// Higher-order component for RTL awareness
export function withRTL<T extends object>(Component: React.ComponentType<T>) {
  return function RTLAwareComponent(props: T) {
    const { isRTL } = useI18n();
    return <Component {...props} isRTL={isRTL} />;
  };
}
