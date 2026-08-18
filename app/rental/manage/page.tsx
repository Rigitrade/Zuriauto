import { TriangleAlert } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import ManageRental from "@/components/rental/ManageRental";
import { prisma } from "@/lib/db";
import { asRentalLanguage, labelsFor } from "@/lib/rental/labels";
import { MAX_SELF_SERVICE_WEEKS, resolveManageToken } from "@/lib/rental/manage";

/**
 * Where the reminder email leads.
 *
 * A server component, because the token has to be resolved before anything is
 * rendered — sending the rental down to the browser and checking there would
 * mean the page briefly holds a stranger's details for anyone with a guessed
 * link.
 *
 * The page is rendered in the language the renter signed the contract in, not
 * the browser's: they came here from an email written in that language.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const resolved = await resolveManageToken(prisma, t ?? "", new Date());

  if (!resolved.ok) {
    // Deliberately the same page for unknown, expired, used, and a rental that
    // is no longer active. A caller learns only that the link does not work.
    const L = labelsFor("de");
    const En = labelsFor("en");
    return (
      <MainLayout>
        <section className="bg-gradient-to-b from-slate-50 to-white py-16">
          <div className="container mx-auto max-w-xl px-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
              <TriangleAlert className="mx-auto h-14 w-14 text-amber-500" />
              <h1 className="mt-4 text-xl font-semibold text-slate-900">
                {L.manage.unusableTitle}
              </h1>
              <p className="mt-2 text-slate-600">{L.manage.unusableBody}</p>
              {/* Both languages, because without a valid token there is no
                  contract to tell us which one the reader speaks. */}
              <hr className="my-5 border-slate-200" />
              <h2 className="text-sm font-semibold text-slate-700">
                {En.manage.unusableTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {En.manage.unusableBody}
              </p>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }

  const { rental } = resolved;

  return (
    <MainLayout>
      <section className="bg-gradient-to-b from-slate-50 to-white py-12 sm:py-16">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <ManageRental
              token={t ?? ""}
              language={asRentalLanguage(rental.language)}
              carModel={rental.carModel}
              carPlate={rental.carPlate}
              endAt={rental.endAt.toISOString()}
              weeklyAmountCents={
                rental.type === "WEEKLY" ? rental.weeklyAmountCents : null
              }
              maxWeeks={MAX_SELF_SERVICE_WEEKS}
            />
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
