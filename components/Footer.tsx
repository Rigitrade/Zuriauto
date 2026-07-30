"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import Link from "next/link";

export default function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-100 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-slate-800">
                <span className="text-xs font-bold text-white tracking-wider">
                  Q
                </span>
              </div>
              <h2 className="text-lg font-light tracking-widest uppercase">
                ZURIAUTO
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed luxury-line-height">
              Experience the future of automotive luxury with ZURIAUTO. Our
              revolutionary e-Sportlimousine redefines what&apos;s possible in
              electric vehicle technology.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-medium mb-4">
              {t("models:title")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("models:sportlimousine")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("models:q2concept")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("models:cityEV")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("models:suv")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-medium mb-4">
              {t("company:title")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("company:aboutUs")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("company:sustainability")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("company:careers")}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-xs text-slate-500 hover:text-slate-800 tracking-wider"
                >
                  {t("company:press")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-medium mb-4">
              {t("contact:title")}
            </h3>
            <ul className="space-y-2">
              <li className="text-xs text-slate-500 tracking-wider">
                {t("contact:address1")}
              </li>
              <li className="text-xs text-slate-500 tracking-wider">
                {t("contact:address2")}
              </li>
              <li className="text-xs text-slate-500 tracking-wider">
                {t("contact:email")}
              </li>
              <li className="text-xs text-slate-500 tracking-wider">
                {t("contact:phone")}
              </li>
            </ul>
            <Button
              variant="outline"
              className="mt-4 rounded-none text-xs tracking-widest uppercase font-light px-6 py-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
            >
              {t("contact:bookTestDrive")}
            </Button>
          </div>
        </div>

        <div className="divider-luxury my-8"></div>

        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-slate-400 tracking-wider">
            {t("footer:copyright", { year: currentYear })}
          </p>
          <div className="flex flex-wrap space-x-6 mt-4 md:mt-0">
            <Link
              href="#"
              className="text-xs text-slate-400 hover:text-slate-800 tracking-wider"
            >
              {t("footer:privacyPolicy")}
            </Link>
            <Link
              href="#"
              className="text-xs text-slate-400 hover:text-slate-800 tracking-wider"
            >
              {t("footer:termsOfService")}
            </Link>
            <Link
              href="#"
              className="text-xs text-slate-400 hover:text-slate-800 tracking-wider"
            >
              {t("footer:cookiePolicy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
