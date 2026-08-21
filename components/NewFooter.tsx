"use client";

import { useState } from "react";
import {
  Building2,
  CreditCard,
  Facebook,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  Smartphone,
  Twitter,
} from "lucide-react";
import Link from "next/link";
import { PAYMENT_URL, TWINT_URL } from "@/lib/payment";

export default function Footer() {
  // Whether "Pay now" has been clicked and the method choice is showing.
  const [payChoiceOpen, setPayChoiceOpen] = useState(false);

  return (
    <footer
      dir="ltr"
      className="bg-slate-800 text-white dark:bg-slate-900 dark:text-slate-300 pt-4 sm:pt-6 lg:pt-8 pb-3 sm:pb-4 border-t border-slate-200 dark:border-slate-800 tracking-widest"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 lg:mb-14">
          <h3 className="text-lg sm:text-xl lg:text-2xl tracking-[3px] sm:tracking-[4px] lg:tracking-[6px] my-3 sm:my-5 lg:my-7">
            ZURIAUTO
          </h3>
          {/* <h3 className="text-lg sm:text-xl lg:text-2xl tracking-[3px] sm:tracking-[4px] lg:tracking-[6px]">
            SWITZERLAND
          </h3> */}
        </div>

        {/* 3 Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-10 lg:mb-12">
          {/* Section 1: Address */}
          <div className="p-4 sm:p-6 rounded-lg text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <MapPin className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-slate-200 dark:text-white" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <h4 className="font-semibold text-sm sm:text-base">ZURIAUTO</h4>
              <h4 className="uppercase text-xs sm:text-sm">
                A brand by RIGITRADE AG
              </h4>
              <h4 className="mt-2 uppercase text-xs sm:text-sm">
                Schaffhauserstrasse 550
              </h4>
              <h4 className="uppercase text-xs sm:text-sm">8052 ZURICH</h4>
              <h4 className="uppercase text-xs sm:text-sm">Switzerland</h4>
              <div className="mt-3 sm:mt-4 space-y-2 uppercase text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0">
                  <Link
                    href="/GTC"
                    className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  >
                    GTC
                  </Link>
                  <span className="hidden sm:inline mx-2">|</span>
                  <Link
                    href="/privacy"
                    className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  >
                    Privacy
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact */}
          <div className="p-4 sm:p-6 rounded-lg text-center">
            <div className="flex justify-center mb-4 sm:mb-6 text-slate-200 dark:text-white">
              <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <h4 className="font-semibold text-sm sm:text-base">
                T. +41 76 366 66 69
              </h4>
              <h4 className="text-xs sm:text-sm">
                Monday – Friday 09.00 – 17.00
              </h4>
              <div className="mt-3 sm:mt-4 space-y-2">
                <Link
                  href="mailto:info@zuriauto.ch"
                  className="text-blue-400 hover:text-blue-300 hover:underline block transition-colors"
                >
                  <h4 className="text-xs sm:text-sm break-all">
                    info@zuriauto.ch
                  </h4>
                </Link>
                <Link
                  href="https://zuriauto.ch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline block transition-colors"
                >
                  <h4 className="text-xs sm:text-sm break-all">
                    www.zuriauto.ch
                  </h4>
                </Link>
                <Link
                  href="https://maps.google.com/?q=47.4240,8.5540"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline block mt-3 transition-colors"
                >
                  <h4 className="text-xs sm:text-sm">GPS Location</h4>
                </Link>
              </div>
            </div>
          </div>

          {/* Section 3: Bank Details */}
          <div className="p-4 sm:p-6 rounded-lg text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-slate-200 dark:text-white" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <h4 className="font-semibold mb-2 uppercase text-sm sm:text-base">
                Our Bank Account
              </h4>
              <h4 className="uppercase text-xs sm:text-sm">
                UBS Switzerland AG 8098 Zurich
              </h4>
              {/* Account holder for the IBAN below. Confirm with the bank that
                  the account was transferred with the entity: Swiss banks
                  increasingly verify that the payee name matches the IBAN, and
                  a mismatch gets transfers rejected. */}
              <h4 className="uppercase text-xs sm:text-sm">RIGITRADE AG</h4>
              <h4 className="uppercase mt-2 text-xs sm:text-sm break-all">
                IBAN CH650020720711359501Q
              </h4>
              <h4 className="uppercase text-xs sm:text-sm">
                SWIFT / BIC UBSWCHZH81M
              </h4>
            </div>

            {/* Card payment, next to the bank details rather than in the
                navigation: someone looking for how to pay looks here. The
                checkout is hosted by SumUp, so no card details touch this
                site. */}
            {/* Outlined rather than a solid white block: at footer scale a
                filled button drew more attention than the bank details it sits
                beside. Still obviously a button, just proportionate. */}
            {payChoiceOpen ? (
              /* The choice replaces the button in place: at footer scale a
                 dropdown or dialog would be heavier than the two links. */
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <a
                  href={PAYMENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors hover:border-white/50 hover:bg-white/15"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Credit card
                </a>
                <a
                  href={TWINT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors hover:border-white/50 hover:bg-white/15"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  TWINT
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPayChoiceOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors hover:border-white/50 hover:bg-white/15"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Pay now
              </button>
            )}

            {/* Social Media Icons */}
            <div className="flex justify-center space-x-3 sm:space-x-4 mt-4 sm:mt-6">
              <Link
                href="#"
                className="text-slate-300 hover:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                aria-label="Facebook"
              >
                <Facebook size={18} className="sm:w-5 sm:h-5" />
              </Link>
              <Link
                href="#"
                className="text-slate-300 hover:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                aria-label="LinkedIn"
              >
                <Linkedin size={18} className="sm:w-5 sm:h-5" />
              </Link>
              <Link
                href="#"
                className="text-slate-300 hover:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                aria-label="Instagram"
              >
                <Instagram size={18} className="sm:w-5 sm:h-5" />
              </Link>
              <Link
                href="#"
                className="text-slate-300 hover:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                aria-label="Twitter"
              >
                <Twitter size={18} className="sm:w-5 sm:h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center border-t border-slate-700 dark:border-slate-600 pt-4 sm:pt-6">
          <h4 className="text-xs sm:text-sm text-slate-300 dark:text-slate-400">
            © ZURIAUTO 2025
          </h4>
        </div>
      </div>
    </footer>
  );
}
