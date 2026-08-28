import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, passwordMatches } from "@/lib/admin/password";
import { ensureOrganisation, seedOwner } from "@/prisma/seed";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_OWNER_USERNAME = "chef";
  process.env.ADMIN_OWNER_PASSWORD = "Startpasswort2026!";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("seedOwner", () => {
  it("creates the owner when there is none", async () => {
    const org = await ensureOrganisation(prisma);
    expect(await seedOwner(prisma, org.id)).toEqual({ created: true });

    const owner = await prisma.adminUser.findFirstOrThrow();
    expect(owner.username).toBe("chef");
    expect(owner.role).toBe("owner");
    expect(await passwordMatches("Startpasswort2026!", owner.passwordHash)).toBe(true);
  });

  it("NEVER overwrites a password that already exists", async () => {
    const org = await ensureOrganisation(prisma);
    await seedOwner(prisma, org.id);

    // The owner changes their password, as they should.
    const before = await prisma.adminUser.findFirstOrThrow();
    await prisma.adminUser.update({
      where: { id: before.id },
      data: { passwordHash: await hashPassword("Eigenes2026!") },
    });

    // A later deploy runs the seed again.
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });

    const after = await prisma.adminUser.findFirstOrThrow();
    expect(await passwordMatches("Eigenes2026!", after.passwordHash)).toBe(true);
    expect(await passwordMatches("Startpasswort2026!", after.passwordHash)).toBe(false);
  });

  it("does nothing when the environment does not ask for an owner", async () => {
    delete process.env.ADMIN_OWNER_USERNAME;
    delete process.env.ADMIN_OWNER_PASSWORD;
    const org = await ensureOrganisation(prisma);
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("leaves an existing owner alone even under a different username", async () => {
    const org = await ensureOrganisation(prisma);
    await seedOwner(prisma, org.id);

    process.env.ADMIN_OWNER_USERNAME = "somebodyelse";
    expect(await seedOwner(prisma, org.id)).toEqual({ created: false });
    expect(await prisma.adminUser.count()).toBe(1);
  });
});
