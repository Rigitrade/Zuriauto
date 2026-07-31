"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/hooks/use-i18n";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useI18n();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex h-16 sm:h-18 md:h-20 items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex-shrink-0 border border-black hover:border-slate-800 hover:shadow-lg shadow-sm transition-all duration-200 ease-in-out"
            >
              <Image
                src="/logo.jpg"
                alt="Zuriauto Logo"
                width={400}
                height={123}
                priority
                className="h-8 w-auto sm:h-10 md:h-12 object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link href="/book/">
                <Button
                  variant="ghost"
                  className="text-xs uppercase tracking-widest font-light hover:bg-transparent hover:text-slate-800 transition-colors px-2 py-1 h-auto"
                >
                  {t("navigation:vehicles")}
                </Button>
              </Link>
              <Link href="/book/">
                <Button
                  variant="ghost"
                  className="text-xs uppercase tracking-widest font-light hover:bg-transparent hover:text-slate-800 transition-colors px-2 py-1 h-auto"
                >
                  {t("navigation:pricing")}
                </Button>
              </Link>
              <Link href="/book/">
                <Button
                  variant="ghost"
                  className="text-xs uppercase tracking-widest font-light hover:bg-transparent hover:text-slate-800 transition-colors px-2 py-1 h-auto"
                >
                  {t("navigation:contact")}
                </Button>
              </Link>
            </nav>

            {/* Right side controls */}
            <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
              {/* Desktop Language switcher */}
              <div className="hidden lg:flex">
                <LanguageSwitcher />
              </div>

              {/* Desktop Book Now button */}
              <Link href="/book/" className="hidden lg:block">
                <Button
                  variant="outline"
                  className="rounded-none text-xs tracking-widest uppercase font-light px-4 xl:px-6 py-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span className="">{t("contact:bookTestDrive")}</span>
                </Button>
              </Link>

              {/* Mobile/Tablet menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden p-2"
                onClick={toggleMobileMenu}
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Panel */}
          <div className="fixed top-16 sm:top-18 md:top-20 inset-x-0 bg-white border-b shadow-lg">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
              <div className="py-4 space-y-3">
                {/* Navigation Links */}
                <div className="space-y-2">
                  <Link href="/book/">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs sm:text-sm uppercase tracking-widest font-light hover:bg-slate-50 hover:text-slate-800 py-3 px-4"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t("navigation:vehicles")}
                    </Button>
                  </Link>
                  <Link href="/book/">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs sm:text-sm uppercase tracking-widest font-light hover:bg-slate-50 hover:text-slate-800 py-3 px-4"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t("navigation:pricing")}
                    </Button>
                  </Link>
                  <Link href="/book/">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs sm:text-sm uppercase tracking-widest font-light hover:bg-slate-50 hover:text-slate-800 py-3 px-4"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t("navigation:contact")}
                    </Button>
                  </Link>
                </div>

                {/* Language Switcher */}
                <div className="flex justify-center py-4 border-t border-slate-200">
                  <LanguageSwitcher />
                </div>

                {/* Book Now Button */}
                <div className="pt-2">
                  <Link href="/book/" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-center rounded-none text-xs sm:text-sm tracking-widest uppercase font-light px-6 py-3 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t("contact:bookTestDrive")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
