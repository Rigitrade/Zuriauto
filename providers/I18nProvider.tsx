"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Runs on the client after hydration. Children render immediately either
    // way, so the prerendered HTML contains real content for crawlers.
    const initializeClientLanguage = async () => {
      const storedLang = localStorage.getItem("preferred-language");

      if (
        storedLang &&
        ["de", "en"].includes(storedLang) &&
        storedLang !== i18n.language
      ) {
        await i18n.changeLanguage(storedLang);
      }

      document.documentElement.dir = "ltr";
      document.documentElement.lang = i18n.language;
    };

    const updateDirection = () => {
      if (typeof document !== "undefined") {
        document.documentElement.dir = "ltr";
        document.documentElement.lang = i18n.language;
      }
    };

    initializeClientLanguage();

    // Keep the document language in sync with later switches.
    i18n.on("languageChanged", updateDirection);

    return () => {
      i18n.off("languageChanged", updateDirection);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
