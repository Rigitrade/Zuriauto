import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  allocateContractNumber,
  formatContractNumber,
} from "@/lib/rental/contractNumber";

async function anOrganisation() {
  return prisma.organisation.create({ data: { name: "ZURIAUTO" } });
}

describe("formatContractNumber", () => {
  it("keeps the shape numbers were already issued in", () => {
    expect(formatContractNumber("20260817", 1)).toBe("ZA-20260817-0001");
    expect(formatContractNumber("20260817", 42)).toBe("ZA-20260817-0042");
  });

  it("grows past four digits rather than wrapping to zero", () => {
    expect(formatContractNumber("20260817", 10_000)).toBe("ZA-20260817-10000");
  });
});

describe("allocateContractNumber", () => {
  it("starts at one on a new day", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    expect(await allocateContractNumber(prisma, org.id, at)).toBe(
      "ZA-20260817-0001"
    );
  });

  it("increments within the same day", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    await allocateContractNumber(prisma, org.id, at);
    expect(await allocateContractNumber(prisma, org.id, at)).toBe(
      "ZA-20260817-0002"
    );
  });

  it("restarts on the next day", async () => {
    const org = await anOrganisation();
    await allocateContractNumber(
      prisma,
      org.id,
      new Date("2026-08-17T10:00:00.000Z")
    );
    expect(
      await allocateContractNumber(
        prisma,
        org.id,
        new Date("2026-08-18T10:00:00.000Z")
      )
    ).toBe("ZA-20260818-0001");
  });

  it("uses the Zurich date, not the UTC one", async () => {
    const org = await anOrganisation();
    // 23:30 UTC on the 17th is already the 18th in Zurich (CEST, UTC+2).
    expect(
      await allocateContractNumber(
        prisma,
        org.id,
        new Date("2026-08-17T23:30:00.000Z")
      )
    ).toBe("ZA-20260818-0001");
  });

  it("never issues the same number twice under concurrency", async () => {
    const org = await anOrganisation();
    const at = new Date("2026-08-17T10:00:00.000Z");
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => allocateContractNumber(prisma, org.id, at))
    );
    expect(new Set(numbers).size).toBe(20);
  });

  it("counts separately per organisation", async () => {
    const a = await anOrganisation();
    const b = await prisma.organisation.create({ data: { name: "OTHER" } });
    const at = new Date("2026-08-17T10:00:00.000Z");
    await allocateContractNumber(prisma, a.id, at);
    expect(await allocateContractNumber(prisma, b.id, at)).toBe(
      "ZA-20260817-0001"
    );
  });
});
