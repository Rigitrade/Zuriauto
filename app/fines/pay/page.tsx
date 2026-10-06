import { TriangleAlert } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import FinePayment from "@/components/fines/FinePayment";
import { prisma } from "@/lib/db";
import { formatFineMoment } from "@/lib/fines/mail";
import { resolveFinePaymentToken } from "@/lib/fines/token";
import { asRentalLanguage, labelsFor } from "@/lib/rental/labels";
import { formatChf } from "@/lib/rental/money";

/**
 * Where a fine email's "confirm payment" link leads.
 *
 * Resolved on the server before anything renders, like the manage page: a
 * fine names a person, a car and a place, and none of it should reach a
 * browser that holds a guessed link. In the renter's contract language.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function FinePayPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const resolved = await resolveFinePaymentToken(prisma, t ?? "", new Date());

  if (!resolved.ok) {
    // One page for unknown, expired, burned and settled: a caller learns only
    // that the link does not work. Both languages, since without a fine there
    // is no contract to say which one the reader speaks.
    const L = labelsFor("de").fines;
    const En = labelsFor("en").fines;
    return (
      <MainLayout>
        <section className="bg-gradient-to-b from-slate-50 to-white py-16">
          <div className="container mx-auto max-w-xl px-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
              <TriangleAlert className="mx-auto h-14 w-14 text-amber-500" />
              <h1 className="mt-4 text-xl font-semibold text-slate-900">{L.unusableTitle}</h1>
              <p className="mt-2 text-slate-600">{L.unusableBody}</p>
              <hr className="my-5 border-slate-200" />
              <h2 className="text-sm font-semibold text-slate-700">{En.unusableTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{En.unusableBody}</p>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }

  const fine = await prisma.fine.findUniqueOrThrow({
    where: { id: resolved.fineId },
    select: {
      violationAt: true,
      violationTimeKnown: true,
      amountCents: true,
      issuerName: true,
      fineNumber: true,
      car: { select: { plate: true, model: true } },
      rental: {
        select: { contracts: { where: { kind: "PICKUP" }, select: { gtcLanguage: true }, take: 1 } },
      },
    },
  });

  return (
    <MainLayout>
      <section className="bg-gradient-to-b from-slate-50 to-white py-12 sm:py-16">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <FinePayment
              token={t ?? ""}
              language={asRentalLanguage(fine.rental?.contracts[0]?.gtcLanguage)}
              plate={fine.car?.plate ?? "—"}
              carModel={fine.car?.model ?? ""}
              when={fine.violationAt ? formatFineMoment(fine.violationAt, fine.violationTimeKnown) : "—"}
              amount={`CHF ${formatChf(fine.amountCents ?? 0)}`}
              issuer={fine.issuerName}
              number={fine.fineNumber}
            />
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
