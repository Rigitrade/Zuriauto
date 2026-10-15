import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { decideWeeksAfterClose } from "@/lib/payments/afterClose";
import { closeRental, RETURN_CLOSE_EVENT } from "@/lib/rental/closeRental";
import { weeklyChargePass } from "@/lib/rental/scheduler";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";
import { seedOrganisation, seedRental } from "./fineHelpers";

const sent: { to: string }[] = [];
vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rental/lifecycleMail")>();
  return { ...original, sendMail: async (_config: unknown, message: { to: string }) => void sent.push(message) };
});
const mail: LifecycleMailConfig = {
  host: "localhost",
  port: 587,
  user: "u",
  pass: "p",
  from: "noreply@zuriauto.ch",
  office: "office@zuriauto.ch",
};
beforeEach(() => void (sent.length = 0));

const office = { id: "user-1", displayName: "Ahmed" };
const RETURNED = new Date("2026-06-16T08:00:00Z"); // during week 3; weeks 4–8 had not begun

async function returnedRental() {
  const org = await seedOrganisation();
  const rental = await seedRental(org.id, { signedAt: new Date("2026-06-01T08:00:00Z") });
  await prisma.$transaction((tx) =>
    closeRental(tx, {
      organisationId: org.id,
      rentalId: rental.id,
      carId: rental.carId,
      fromStatuses: ["ACTIVE"],
      settlement: null,
      event: { type: RETURN_CLOSE_EVENT, payload: {} },
      now: RETURNED,
    })
  );
  const week = (n: number) => prisma.charge.findFirstOrThrow({ where: { rentalId: rental.id, weekNumber: n } });
  return { org, rental, week };
}

describe("decideWeeksAfterClose", () => {
  it("voids the weeks that had not begun, and records who decided", async () => {
    const { rental, week } = await returnedRental();

    expect(await decideWeeksAfterClose(prisma, rental.id, "void", office)).toEqual({ ok: true, count: 5 });

    expect((await week(4)).status).toBe("VOID");
    expect((await week(3)).status).toBe("SCHEDULED");
    const event = await prisma.rentalEvent.findFirstOrThrow({ where: { rentalId: rental.id, type: "rental.weeks-after-close.voided" } });
    expect(event.payload).toMatchObject({ actorName: "Ahmed" });
  });

  it("keeps them owed, and the daily job then asks for them once due", async () => {
    const { rental } = await returnedRental();
    await decideWeeksAfterClose(prisma, rental.id, "keep", office);

    // 23.06: weeks 1–4 due. Weeks 1–3 began before the return; week 4 is owed only because it was kept.
    const now = new Date("2026-06-23T08:00:00Z");
    expect(await weeklyChargePass({ client: prisma, now, baseUrl: "https://zuriauto.ch", mail })).toBe(4);
  });

  it("decides only once, and only for a closed rental", async () => {
    const { rental } = await returnedRental();
    await decideWeeksAfterClose(prisma, rental.id, "void", office);
    expect(await decideWeeksAfterClose(prisma, rental.id, "keep", office)).toEqual({ ok: false, code: "conflict" });

    const org = await prisma.organisation.findFirstOrThrow();
    const running = await seedRental(org.id, {
      signedAt: new Date("2026-07-01T08:00:00Z"),
      details: { vehicleId: "prius-18-zh918474" },
    });
    expect(await decideWeeksAfterClose(prisma, running.id, "void", office)).toEqual({ ok: false, code: "conflict" });
  });
});
