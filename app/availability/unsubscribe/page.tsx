import { TriangleAlert } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import UnsubscribeAvailability from "@/components/rental/UnsubscribeAvailability";
import { prisma } from "@/lib/db";
import { asRentalLanguage } from "@/lib/rental/labels";

/**
 * Where the unsubscribe link in an availability email leads.
 *
 * A server component, so the token is resolved before anything renders: the
 * page names the address it is about, and sending an unresolved token to the
 * browser to look up there would mean anyone guessing a link learns whether it
 * is real by watching the request.
 *
 * Rendered in the language the alert was recorded in — the reader arrived from
 * a message written in it, not from the site.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `ah***@example.ch`.
 *
 * Enough for the reader to recognise which of their addresses this is, not
 * enough to hand a whole address to somebody who guessed a URL. The domain
 * stays because two addresses at different providers are exactly what
 * somebody is trying to tell apart here.
 */
function mask(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "•••";
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(3, name.length - head.length))}@${domain}`;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const alert =
    token && token.length >= 16
      ? await prisma.availabilityAlert.findUnique({
          where: { unsubscribeToken: token },
          select: { email: true, language: true, cancelledAt: true },
        })
      : null;

  if (!alert) {
    // One page for an unknown token and a missing one. A caller learns only
    // that the link does not work.
    return (
      <MainLayout>
        <section className="bg-gradient-to-b from-slate-50 to-white py-16">
          <div className="container mx-auto max-w-xl px-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
              <TriangleAlert className="mx-auto h-12 w-12 text-amber-500" />
              <h1 className="mt-4 text-xl font-semibold text-slate-900">
                Dieser Link funktioniert nicht mehr.
              </h1>
              {/* Both languages: without a valid token there is nothing to say
                  which one the reader speaks. */}
              <p className="mt-2 text-sm text-slate-500">
                This link no longer works.
              </p>
            </div>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <section className="bg-gradient-to-b from-slate-50 to-white py-16">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <UnsubscribeAvailability
              token={token ?? ""}
              email={mask(alert.email)}
              language={asRentalLanguage(alert.language)}
            />
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
