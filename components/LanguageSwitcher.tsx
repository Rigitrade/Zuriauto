"use client";

import { useI18n } from "@/lib/hooks/use-i18n";
import ReusableButton from "./ReusableButton";

export function LanguageSwitcher() {
  const { i18n, changeLanguage } = useI18n();

  const toggleLanguage = () => {
    changeLanguage(i18n.language === "en" ? "de" : "en");
  };

  return (
    <>
      <ReusableButton
        onClick={toggleLanguage}
        size="small"
        className="cursor-pointer    "
        border="border border-input"
        text={i18n.language === "en" ? "DE" : "EN"}
      />
    </>
  );
}
