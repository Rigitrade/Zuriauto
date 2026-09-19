import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { availabilityPass } from "@/lib/rental/scheduler";
import { generateUnsubscribeToken } from "@/lib/rental/availability";
import { ensureOrganisation, seedFleet } from "@/prisma/seed";
import type { LifecycleMailConfig } from "@/lib/rental/lifecycleMail";

/**
 * The waiting list.
 *
 * The pass that exists because a car becoming free is not an event this system
 * observes: a rental is closed by a button, a car leaves the garage by an
 * edit, and a new car arrives through the fleet form. So the assertions here
 * are about a *state* — something is available, somebody is waiting — rather
 * than about a transition, and about the two ways this could go wrong in a
 * way nobody would notice: writing to the same person twice, and writing to
 * somebody who unsubscribed.
 */

/** Captures what would have been sent, as mfkPass.test.ts does: the
 *  assertions are about content, and no SMTP server is involved. */
const sent: { to: string; subject: string; text: string }[] = [];

vi.mock("@/lib/rental/lifecycleMail", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/rental/lifecycleMail")
  >();
  return {
    ...original,
    sendMail: async (
      _config: unknown,
      message: { to: string; subject: string; text: string }
    ) => {
      sent.push(message);
    },
  };
});

const mail: LifecycleMailConfig = {
  host: "localhost",
  port: 587,
  user: "u",
  pass: "p",
  from: "noreply@zuriauto.ch",
  office: "office@zuriauto.ch",
};

const NOW = new Date("2026-09-19T07:00:00.000Z");

function deps(now = NOW) {
  return { client: prisma, now, baseUrl: "https://zuriauto.ch", mail };
}

/** The fleet, with every car in the given status. */
async function fleetAll(status: "available" | "rented"): Promise<string> {
  const org = await ensureOrganisation(prisma);
  await seedFleet(prisma, org.id);
  await prisma.car.updateMany({ where: { organisationId: org.id }, data: { status } });
  return org.id;
}

async function waiting(
  organisationId: string,
  email: string,
  extra: { language?: string; cancelledAt?: Date; notifiedAt?: Date } = {}
) {
  return prisma.availabilityAlert.create({
    data: {
      organisationId,
      email,
      language: extra.language ?? "de",
      unsubscribeToken: generateUnsubscribeToken(),
      cancelledAt: extra.cancelledAt ?? null,
      notifiedAt: extra.notifiedAt ?? null,
    },
    select: { id: true, unsubscribeToken: true },
  });
}

describe("availabilityPass", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("says nothing while the whole fleet is out", async () => {
    const org = await fleetAll("rented");
    await waiting(org, "hopeful@example.ch");

    expect(await availabilityPass(deps())).toBe(0);
    expect(sent).toHaveLength(0);
    // And crucially, the row is left waiting rather than marked notified.
    const row = await prisma.availabilityAlert.findFirstOrThrow();
    expect(row.notifiedAt).toBeNull();
  });

  it("writes to somebody waiting once a car is free", async () => {
    const org = await fleetAll("rented");
    await waiting(org, "hopeful@example.ch");
    // One car comes back.
    const car = await prisma.car.findFirstOrThrow({ select: { id: true } });
    await prisma.car.update({ where: { id: car.id }, data: { status: "available" } });

    expect(await availabilityPass(deps())).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("hopeful@example.ch");
    // The link the mail exists to deliver.
    expect(sent[0].text).toContain("https://zuriauto.ch/book/");
  });

  it("never writes to the same person twice", async () => {
    // The failure this pass is shaped to prevent: it runs every morning, and
    // a fleet with one idle car would otherwise mail the whole list daily.
    const org = await fleetAll("available");
    await waiting(org, "hopeful@example.ch");

    expect(await availabilityPass(deps())).toBe(1);
    expect(await availabilityPass(deps(new Date("2026-09-20T07:00:00.000Z")))).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("leaves an unsubscribed address alone", async () => {
    const org = await fleetAll("available");
    await waiting(org, "gone@example.ch", { cancelledAt: new Date() });

    expect(await availabilityPass(deps())).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("writes in the language the address was recorded in", async () => {
    const org = await fleetAll("available");
    await waiting(org, "english@example.ch", { language: "en" });

    await availabilityPass(deps());
    expect(sent[0].subject).toContain("available");
  });

  it("carries a working unsubscribe link for that exact row", async () => {
    const org = await fleetAll("available");
    const row = await waiting(org, "hopeful@example.ch");

    await availabilityPass(deps());
    expect(sent[0].text).toContain(encodeURIComponent(row.unsubscribeToken));
  });

  it("marks the row notified, so a restart does not re-send", async () => {
    const org = await fleetAll("available");
    await waiting(org, "hopeful@example.ch");

    await availabilityPass(deps());
    const row = await prisma.availabilityAlert.findFirstOrThrow();
    expect(row.notifiedAt).toEqual(NOW);
  });

  it("does nothing, and claims nothing, without a mailer", async () => {
    // A row marked notified by a run that could not send would strand that
    // person permanently.
    const org = await fleetAll("available");
    await waiting(org, "hopeful@example.ch");

    expect(await availabilityPass({ ...deps(), mail: null })).toBe(0);
    const row = await prisma.availabilityAlert.findFirstOrThrow();
    expect(row.notifiedAt).toBeNull();
  });

  it("tells the longest waiter first", async () => {
    const org = await fleetAll("available");
    const early = await prisma.availabilityAlert.create({
      data: {
        organisationId: org,
        email: "first@example.ch",
        unsubscribeToken: generateUnsubscribeToken(),
        createdAt: new Date("2026-09-01T07:00:00.000Z"),
      },
      select: { id: true },
    });
    await waiting(org, "second@example.ch");

    await availabilityPass(deps());
    expect(sent[0].to).toBe("first@example.ch");
    expect(early.id).toBeTruthy();
  });
});
