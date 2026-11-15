import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { getAssetStore } from "@/lib/storage";

/**
 * One complete company, for the multi-company isolation tests: an owner, a
 * car, a renter, a running weekly rental with its signed contract and an ID
 * image, a requested week, an unmatched payment, a repair, a fine with its
 * letter and a payment proof, a payment email and a mail issue.
 *
 * Plates and names are deliberately unusual, so a test can search a response
 * body for them and find them only if they leaked.
 */
export interface CompanyFixture {
  label: "A" | "B";
  organisationId: string;
  /** The company's phone in its settings (phase B), unusual like the plate. */
  companyPhone: string;
  ownerId: string;
  headers: Record<string, string>;
  carId: string;
  carSlug: string;
  plate: string;
  customerId: string;
  renterLastName: string;
  rentalId: string;
  contractId: string;
  assetId: string;
  chargeId: string;
  paymentId: string;
  repairId: string;
  fineId: string;
  fineDocumentId: string;
  fineDocumentKey: string;
  proofId: string;
  notificationId: string;
  mailIssueId: string;
}

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

export async function buildCompany(label: "A" | "B"): Promise<CompanyFixture> {
  const tag = label.toLowerCase();
  const plate = label === "A" ? "ZH 9100A1" : "ZH 9200B2";
  const renterLastName = label === "A" ? "Zzyzx" : "Yyxw";
  const store = getAssetStore();

  const companyPhone = label === "A" ? "+41 44 917 17 17" : "+41 44 928 28 28";
  const org = await prisma.organisation.create({
    data: { name: `Company ${label}`, slug: `co-${tag}`, phone: companyPhone, officeEmail: `office-${tag}@example.ch` },
    select: { id: true },
  });
  const organisationId = org.id;

  const owner = await prisma.adminUser.create({
    data: {
      organisationId,
      username: `owner-${tag}`,
      displayName: `Owner ${label}`,
      role: "owner",
      passwordHash: "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA",
    },
    select: { id: true },
  });

  const car = await prisma.car.create({
    data: {
      organisationId,
      slug: `car-${tag}`,
      model: "Toyota Prius",
      plate,
      status: "rented",
      licenceKey: `cars/car-${tag}/licence.pdf`,
      licenceContentType: "application/pdf",
      licenceUpdatedAt: new Date("2026-10-01T00:00:00Z"),
      photoKey: `cars/car-${tag}/photo.jpg`,
      photoContentType: "image/jpeg",
      photoUpdatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    select: { id: true, slug: true },
  });
  await store.put(`cars/car-${tag}/licence.pdf`, PDF, "application/pdf");
  await store.put(`cars/car-${tag}/photo.jpg`, JPEG, "image/jpeg");

  const customer = await prisma.customer.create({
    data: {
      organisationId,
      firstName: label === "A" ? "Annabelle" : "Bertram",
      lastName: renterLastName,
      email: `renter-${tag}@example.ch`,
      phone: label === "A" ? "+41790000001" : "+41790000002",
      phoneKey: label === "A" ? "+41790000001" : "+41790000002",
      birthDate: new Date("1990-01-01T00:00:00Z"),
      street: "Teststrasse 1",
      postalCode: "8000",
      city: "Zürich",
      country: "CH",
    },
    select: { id: true },
  });

  const rental = await prisma.rental.create({
    data: {
      organisationId,
      carId: car.id,
      customerId: customer.id,
      createdBy: "test",
      type: "WEEKLY",
      status: "ACTIVE",
      startAt: new Date("2026-11-02T08:00:00Z"),
      weeklyAmountCents: 40_000,
      billingWeekday: 1,
    },
    select: { id: true },
  });

  const contract = await prisma.contract.create({
    data: {
      organisationId,
      rentalId: rental.id,
      contractNumber: `${label}-2026-0001`,
      createdBy: "test",
      kind: "PICKUP",
      mileageKm: 100_000,
      fuelLevel: "full",
      gtcVersion: "2026-10-22",
      gtcLanguage: "de",
      acceptedAt: new Date("2026-11-02T08:00:00Z"),
      pdfKey: `contracts/${tag}/contract.pdf`,
    },
    select: { id: true },
  });
  await store.put(`contracts/${tag}/contract.pdf`, PDF, "application/pdf");

  const asset = await prisma.asset.create({
    data: {
      contractId: contract.id,
      kind: "ID_FRONT",
      storageKey: `assets/${tag}/id-front.jpg`,
      contentType: "image/jpeg",
      bytes: JPEG.byteLength,
    },
    select: { id: true },
  });
  await store.put(`assets/${tag}/id-front.jpg`, JPEG, "image/jpeg");

  const charge = await prisma.charge.create({
    data: {
      organisationId,
      rentalId: rental.id,
      weekNumber: 1,
      dueDate: new Date("2026-11-02T08:00:00Z"),
      amountCents: 40_000,
      status: "REQUESTED",
      requestedAt: new Date("2026-11-02T08:00:00Z"),
    },
    select: { id: true },
  });

  const payment = await prisma.payment.create({
    data: {
      organisationId,
      externalId: `twint-${tag}-1`,
      amountCents: 40_000,
      paidAt: new Date("2026-11-03T10:00:00Z"),
      status: "NEEDS_REVIEW",
      payerName: `${renterLastName} Payer`,
    },
    select: { id: true },
  });

  const repair = await prisma.carRepair.create({
    data: { organisationId, carId: car.id, details: `Brakes ${label}`, createdBy: "test" },
    select: { id: true },
  });

  const fine = await prisma.fine.create({
    data: {
      organisationId,
      carId: car.id,
      rentalId: rental.id,
      customerId: customer.id,
      fineNumber: `F-${label}-1`,
      amountCents: 12_000,
      violationAt: new Date("2026-11-04T10:00:00Z"),
      status: "NEEDS_REVIEW",
      reviewReason: "FIELDS_DOUBTFUL",
    },
    select: { id: true },
  });

  // The shape lib/fines/keys.ts gives a letter, so the routes accept it.
  // A UUID id, as the upload route issues, so routes that check its shape
  // reach the record instead of refusing the id.
  const fineDocumentId = label === "A" ? "aaaaaaaa-0000-4000-8000-00000000000a" : "bbbbbbbb-0000-4000-8000-00000000000b";
  const fineDocumentKey = `fines/${fineDocumentId}/letter-0123456789abcdef.pdf`;
  const fineDocument = await prisma.fineDocument.create({
    data: {
      id: fineDocumentId,
      organisationId,
      fineId: fine.id,
      storageKey: fineDocumentKey,
      bytes: PDF.byteLength,
      pages: 1,
      sha256: tag.repeat(64),
      status: "PROCESSED",
      uploadedById: owner.id,
      uploadedByName: `Owner ${label}`,
    },
    select: { id: true },
  });
  await store.put(fineDocumentKey, PDF, "application/pdf");

  const proof = await prisma.finePaymentProof.create({
    data: {
      fineId: fine.id,
      storageKey: `fines/proof-${tag}.jpg`,
      contentType: "image/jpeg",
      bytes: JPEG.byteLength,
      verdict: "MISMATCH",
    },
    select: { id: true },
  });
  await store.put(`fines/proof-${tag}.jpg`, JPEG, "image/jpeg");

  const notification = await prisma.notification.create({
    data: {
      organisationId,
      rentalId: rental.id,
      kind: "CHARGE_REQUESTED",
      dedupeKey: `week-1`,
      to: `renter-${tag}@example.ch`,
      sentAt: new Date("2026-11-02T08:05:00Z"),
    },
    select: { id: true },
  });

  const issue = await prisma.paymentMailIssue.create({
    data: { organisationId, messageKey: `msg-${tag}`, reason: "UNREADABLE" },
    select: { id: true },
  });

  return {
    label,
    organisationId,
    companyPhone,
    ownerId: owner.id,
    headers: { cookie: `${ADMIN_COOKIE}=${issueAdminSession(owner.id)}` },
    carId: car.id,
    carSlug: car.slug,
    plate,
    customerId: customer.id,
    renterLastName,
    rentalId: rental.id,
    contractId: contract.id,
    assetId: asset.id,
    chargeId: charge.id,
    paymentId: payment.id,
    repairId: repair.id,
    fineId: fine.id,
    fineDocumentId: fineDocument.id,
    fineDocumentKey,
    proofId: proof.id,
    notificationId: notification.id,
    mailIssueId: issue.id,
  };
}

/**
 * Everything about a company's rows that a write could change, as one string.
 * Equal before and after means nothing of the company was touched.
 */
export async function snapshot(f: CompanyFixture): Promise<string> {
  const org = { organisationId: f.organisationId };
  const company = await prisma.organisation.findUnique({ where: { id: f.organisationId } });
  const [cars, rentals, charges, payments, repairs, fines, documents, proofs, notifications, issues, users, contracts, assets] =
    await Promise.all([
      prisma.car.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.rental.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.charge.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.payment.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.carRepair.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.fine.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.fineDocument.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.finePaymentProof.findMany({ where: { fine: org }, orderBy: { id: "asc" } }),
      prisma.notification.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.paymentMailIssue.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.adminUser.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.contract.findMany({ where: org, orderBy: { id: "asc" } }),
      prisma.asset.findMany({ where: { contract: org }, orderBy: { id: "asc" } }),
    ]);
  const letter = await getAssetStore().get(f.fineDocumentKey);
  return JSON.stringify({
    company,
    cars, rentals, charges, payments, repairs, fines, documents, proofs,
    notifications, issues, users, contracts, assets,
    letterBytes: letter ? Array.from(letter.body) : null,
  });
}
