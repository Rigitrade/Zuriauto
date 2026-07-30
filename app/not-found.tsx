"use client";
import { MainLayout } from "@/components/MainLayout";
import ReusableButton from "@/components/ReusableButton";
import { useI18n } from "@/lib/hooks/use-i18n";
import Link from "next/link";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <MainLayout>
      <section className="relative min-h-screen bg-slate-200 overflow-hidden flex items-center justify-center">
        {/* Background Text */}
        <div className="absolute inset-0 flex items-center justify-center z-0 opacity-20 text-[8rem] sm:text-[12rem] lg:text-[20rem] font-bold tracking-widest text-slate-300">
          404
        </div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-wider mb-3 sm:mb-4 px-4">
              {t("common:404:title").toUpperCase()}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed tracking-wide px-4 mb-8">
              {t("common:404:subtitle")}
            </p>
            <Link href="/">
              <ReusableButton text={t("common:404:cta").toUpperCase()} />
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
