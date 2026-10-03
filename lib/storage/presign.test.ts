import { describe, expect, it } from "vitest";
import { uploadTarget } from "./presign";

const R2 = {
  R2_ACCOUNT_ID: "acc",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "zuriauto",
  NODE_ENV: "production",
};

describe("uploadTarget", () => {
  it("signs a direct PUT to the bucket when R2 is configured", async () => {
    const target = await uploadTarget("fines/d1/letter-ab.pdf", "application/pdf", R2);
    const url = new URL(target.url);
    expect(url.host).toBe("acc.eu.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/zuriauto/fines/d1/letter-ab.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(target.headers).toEqual({ "content-type": "application/pdf" });
  });

  it("points at the local route in development without R2", async () => {
    const target = await uploadTarget("fines/d1/letter-ab.pdf", "application/pdf", {
      NODE_ENV: "development",
    });
    expect(target.url).toBe("/api/admin/fines/uploads/local/fines/d1/letter-ab.pdf/");
  });

  it("refuses to accept files nowhere in production", async () => {
    await expect(
      uploadTarget("fines/d1/letter-ab.pdf", "application/pdf", { NODE_ENV: "production" })
    ).rejects.toThrow(/R2 is not configured/);
  });
});
