import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findSiteOrganisation, organisationBySlug } from "@/lib/organisation";
import type { OrgClient } from "@/lib/organisationCore";
import { COMPANY_PARAM } from "./companyLink";

/**
 * The company a public form request serves (multi-company phase C,
 * 16.11.2026).
 *
 * A partner's pickup and return pages (`zuriauto.ch/<slug>/pickup`) name
 * their company to every endpoint they call as `?company=<slug>`. ZURIAUTO's
 * own pages name none and are served the site company, exactly as before.
 *
 * A name that matches no company is an answer of its own, never a fall back
 * to ZURIAUTO: a mistyped partner link must not quietly sign a renter up
 * with the wrong company.
 */

/** The company named in the request's query, if any. */
export function companyParam(request: Request): string | null {
  const value = new URL(request.url).searchParams.get(COMPANY_PARAM);
  return value && value.trim() !== "" ? value.trim() : null;
}

export type FormCompany =
  | { organisation: { id: string; slug: string | null }; response?: undefined }
  | { organisation?: undefined; response: NextResponse };

export async function formCompany(request: Request, client: OrgClient = prisma): Promise<FormCompany> {
  const slug = companyParam(request);
  if (slug) {
    const named = await organisationBySlug(slug, client);
    return named
      ? { organisation: named }
      : { response: NextResponse.json({ code: "unknown-company" }, { status: 404 }) };
  }
  const site = await findSiteOrganisation(client);
  return site
    ? { organisation: site }
    : { response: NextResponse.json({ code: "not-configured" }, { status: 503 }) };
}

