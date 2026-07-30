"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // This effect only runs on the client after hydration
    const initializeClientLanguage = async () => {
      // Get stored language from localStorage
      const storedLang = localStorage.getItem("preferred-language");

      if (
        storedLang &&
        ["de", "en"].includes(storedLang) &&
        storedLang !== i18n.language
      ) {
        // Change language if stored language is different
        await i18n.changeLanguage(storedLang);
      }

      // Update document attributes
      document.documentElement.dir = "ltr";
      document.documentElement.lang = i18n.language;

      setMounted(true);
    };

    const updateDirection = () => {
      if (typeof document !== "undefined") {
        document.documentElement.dir = "ltr";
        document.documentElement.lang = i18n.language;
      }
    };

    // Initialize client-side language
    initializeClientLanguage();

    // Listen for language changes
    i18n.on("languageChanged", updateDirection);

    return () => {
      i18n.off("languageChanged", updateDirection);
    };
  }, []);

  // Always render the provider immediately to avoid hydration issues
  // The language change happens after hydration in useEffect
  if (!mounted) return null;
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
