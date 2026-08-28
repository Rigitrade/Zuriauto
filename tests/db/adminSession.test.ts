import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import {
  ADMIN_COOKIE,
  issueAdminSession,
  requireAdmin,
  requireOwner,
} from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

function withCookie(token: string): Request {
  return new Request("https://example.test/api/admin/overview/", {
    headers: { cookie: `${ADMIN_COOKIE}=${token}` },
  });
}

async function makeUser(role: "owner" | "staff" = "staff") {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: role === "owner" ? "chef" : "ahmed",
      displayName: role === "owner" ? "Die Chefin" : "Eng Ahmed",
      role,
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true, username: true },
  });
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("requireAdmin", () => {
  it("resolves a live session to the user", async () => {
    const user = await makeUser();
    const identity = await requireAdmin(withCookie(issueAdminSession(user.id)));
    expect(identity?.username).toBe("ahmed");
    expect(identity?.role).toBe("staff");
  });

  it("refuses a cookie naming a user who does not exist", async () => {
    const token = issueAdminSession("clxdoesnotexist0000000000");
    expect(await requireAdmin(withCookie(token))).toBeNull();
  });

  it("refuses the same cookie once the user is disabled", async () => {
    const user = await makeUser();
    const token = issueAdminSession(user.id);
    expect(await requireAdmin(withCookie(token))).not.toBeNull();

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { disabledAt: new Date() },
    });

    // The whole reason validation reads the row: this must not wait 12 hours.
    expect(await requireAdmin(withCookie(token))).toBeNull();
  });

  it("refuses cookies issued before the password changed", async () => {
    const user = await makeUser();
    const issuedAt = new Date("2026-08-28T08:00:00.000Z");
    const token = issueAdminSession(user.id, issuedAt);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("Herbst2026!"),
        credentialsChangedAt: new Date("2026-08-28T09:00:00.000Z"),
      },
    });

    const later = new Date("2026-08-28T10:00:00.000Z");
    expect(await requireAdmin(withCookie(token), later)).toBeNull();

    // A fresh sign-in works.
    const fresh = issueAdminSession(user.id, later);
    expect(await requireAdmin(withCookie(fresh), later)).not.toBeNull();
  });
});

describe("requireOwner", () => {
  it("admits an owner and refuses a staff member", async () => {
    const staff = await makeUser("staff");
    expect(await requireOwner(withCookie(issueAdminSession(staff.id)))).toBeNull();

    await prisma.adminUser.deleteMany();
    const owner = await makeUser("owner");
    expect(
      await requireOwner(withCookie(issueAdminSession(owner.id)))
    ).not.toBeNull();
  });
});
