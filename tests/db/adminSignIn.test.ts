import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "@/app/api/admin/session/route";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/admin/password";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { ensureOrganisation } from "@/prisma/seed";

function signIn(body: unknown, ip = "203.0.113.7"): Request {
  return new Request("https://example.test/api/admin/session/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function seedUser(overrides: { disabledAt?: Date } = {}) {
  const org = await ensureOrganisation(prisma);
  return prisma.adminUser.create({
    data: {
      organisationId: org.id,
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
      passwordHash: await hashPassword("Sommer2026!"),
      ...overrides,
    },
    select: { id: true },
  });
}

beforeEach(() => {
  process.env.ADMIN_SECRET = "signing-key-for-tests";
});

describe("POST /api/admin/session", () => {
  it("signs in and sets the cookie", async () => {
    await seedUser();
    const response = await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      username: "ahmed",
      displayName: "Eng Ahmed",
      role: "staff",
    });
    expect(response.headers.get("set-cookie")).toContain(`${ADMIN_COOKIE}=`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("accepts the username in any case", async () => {
    await seedUser();
    const response = await POST(signIn({ username: " AHMED ", password: "Sommer2026!" }));
    expect(response.status).toBe(200);
  });

  it("stamps lastSignInAt", async () => {
    const user = await seedUser();
    await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));
    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lastSignInAt).not.toBeNull();
  });

  it("gives one answer for a wrong password, an unknown user and a disabled account", async () => {
    await seedUser();
    const wrong = await POST(signIn({ username: "ahmed", password: "nope" }));
    const unknown = await POST(signIn({ username: "nobody", password: "Sommer2026!" }));

    await prisma.adminUser.updateMany({ data: { disabledAt: new Date() } });
    const disabled = await POST(signIn({ username: "ahmed", password: "Sommer2026!" }));

    for (const response of [wrong, unknown, disabled]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "unauthorised" });
    }
  });

  it("refuses a malformed body with 400", async () => {
    const response = await POST(
      new Request("https://example.test/api/admin/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      })
    );
    expect(response.status).toBe(400);
  });

  it("rate-limits repeated attempts from one address", async () => {
    await seedUser();
    let last = await POST(signIn({ username: "ahmed", password: "nope" }, "203.0.113.9"));
    for (let i = 0; i < 12; i += 1) {
      last = await POST(signIn({ username: "ahmed", password: "nope" }, "203.0.113.9"));
    }
    expect(last.status).toBe(429);

    // The pickup form's budget is untouched.
    const attempts = await prisma.submissionAttempt.count({ where: { scope: "pickup" } });
    expect(attempts).toBe(0);
  });

  it("does not charge the budget for a run of successful sign-ins", async () => {
    await seedUser();
    // More than SIGNIN_MAX correct sign-ins from one address: the office
    // behind one NAT address, more than ten accounts, nobody typing wrong.
    let last;
    for (let i = 0; i < 12; i += 1) {
      last = await POST(
        signIn({ username: "ahmed", password: "Sommer2026!" }, "203.0.113.11")
      );
    }
    expect(last!.status).toBe(200);
  });

  it("fails closed with 401 when ADMIN_SECRET is unset, and does not stamp lastSignInAt", async () => {
    const user = await seedUser();
    const original = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    try {
      const response = await POST(
        signIn({ username: "ahmed", password: "Sommer2026!" }, "203.0.113.13")
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "unauthorised" });
      expect(response.headers.get("set-cookie")).toBeNull();
    } finally {
      // Restored so the tests that follow are not left signing against an
      // unconfigured key.
      process.env.ADMIN_SECRET = original;
    }

    const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lastSignInAt).toBeNull();
  });

  it("clears the cookie on sign out", async () => {
    const response = await DELETE();
    expect(response.cookies.get(ADMIN_COOKIE)?.value).toBe("");
  });
});
