import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";
import { prisma } from "@/lib/db";
import { hashPassword, passwordMatches } from "@/lib/admin/password";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

async function makeUser(
  role: "owner" | "staff",
  username: string
): Promise<{ id: string }> {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username,
      displayName: username,
      role,
      passwordHash: await hashPassword("Sommer2026!"),
    },
    select: { id: true },
  });
}

function as(userId: string, body?: unknown, method = "GET"): Request {
  return new Request("https://example.test/api/admin/users/", {
    method,
    headers: {
      cookie: `${ADMIN_COOKIE}=${issueAdminSession(userId)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("GET /api/admin/users", () => {
  it("lists accounts for an owner", async () => {
    const owner = await makeUser("owner", "chef");
    await makeUser("staff", "ahmed");

    const body = await (await GET(as(owner.id))).json();
    expect(body.users).toHaveLength(2);
    // Never leaves the server, not even to an owner.
    expect(JSON.stringify(body)).not.toContain("scrypt$");
  });

  it("refuses a staff member with 403", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await GET(as(staff.id));
    expect(response.status).toBe(403);
  });

  it("refuses a stranger with 401", async () => {
    const response = await GET(new Request("https://example.test/api/admin/users/"));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/admin/users", () => {
  it("creates an account an owner can hand over", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await POST(
      as(owner.id, {
        username: "ahmed",
        displayName: "Eng Ahmed",
        password: "Sommer2026!",
        role: "staff",
      }, "POST")
    );

    expect(response.status).toBe(201);
    const created = await prisma.adminUser.findFirstOrThrow({
      where: { username: "ahmed" },
    });
    expect(created.role).toBe("staff");
    expect(created.createdById).toBe(owner.id);
    expect(await passwordMatches("Sommer2026!", created.passwordHash)).toBe(true);
  });

  it("refuses a duplicate username with 409", async () => {
    const owner = await makeUser("owner", "chef");
    await makeUser("staff", "ahmed");

    const response = await POST(
      as(owner.id, {
        username: "ahmed",
        displayName: "Someone Else",
        password: "Sommer2026!",
      }, "POST")
    );
    expect(response.status).toBe(409);
  });

  it("refuses a staff member with 403", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await POST(
      as(staff.id, {
        username: "sneaky",
        displayName: "Sneaky",
        password: "Sommer2026!",
      }, "POST")
    );
    expect(response.status).toBe(403);
    expect(await prisma.adminUser.count()).toBe(1);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  it("lets an owner set somebody else's password and ends their sessions", async () => {
    const owner = await makeUser("owner", "chef");
    const staff = await makeUser("staff", "ahmed");
    const before = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });

    const response = await PATCH(
      as(owner.id, { password: "Herbst2026!" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(200);

    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(await passwordMatches("Herbst2026!", after.passwordHash)).toBe(true);
    expect(after.credentialsChangedAt.getTime()).toBeGreaterThan(
      before.credentialsChangedAt.getTime()
    );
  });

  it("lets a staff member change their own password", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await PATCH(
      as(staff.id, { password: "Herbst2026!" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(200);

    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(await passwordMatches("Herbst2026!", after.passwordHash)).toBe(true);
  });

  it("refuses a staff member setting their own displayName alongside a password change", async () => {
    const staff = await makeUser("staff", "ahmed");
    const before = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });

    const response = await PATCH(
      as(staff.id, { password: "Herbst2026!", displayName: "Not Ahmed" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(403);

    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after.displayName).toBe(before.displayName);
  });

  it("refuses a staff member changing somebody else's password", async () => {
    const staff = await makeUser("staff", "ahmed");
    const other = await makeUser("staff", "bea");

    const response = await PATCH(
      as(staff.id, { password: "Herbst2026!" }, "PATCH"),
      params(other.id)
    );
    expect(response.status).toBe(403);
  });

  it("refuses a staff member promoting themselves", async () => {
    const staff = await makeUser("staff", "ahmed");
    const response = await PATCH(
      as(staff.id, { role: "owner" }, "PATCH"),
      params(staff.id)
    );
    expect(response.status).toBe(403);
    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after.role).toBe("staff");
  });

  it("refuses to disable the last enabled owner", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { disabled: true }, "PATCH"),
      params(owner.id)
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "last-owner" });
  });

  it("refuses to demote the last enabled owner", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { role: "staff" }, "PATCH"),
      params(owner.id)
    );
    expect(response.status).toBe(409);
  });

  it("allows disabling one of two owners", async () => {
    const first = await makeUser("owner", "chef");
    const second = await makeUser("owner", "chef2");

    const response = await PATCH(
      as(first.id, { disabled: true }, "PATCH"),
      params(second.id)
    );
    expect(response.status).toBe(200);
  });

  it("answers 404 for an id that does not exist", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      as(owner.id, { displayName: "X" }, "PATCH"),
      params("clxnope00000000000000000")
    );
    expect(response.status).toBe(404);
  });

  it("refuses a stranger with 401", async () => {
    const owner = await makeUser("owner", "chef");
    const response = await PATCH(
      new Request("https://example.test/api/admin/users/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: "X" }),
      }),
      params(owner.id)
    );
    expect(response.status).toBe(401);
  });
});
