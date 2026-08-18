import { describe, expect, it } from "vitest";
import { assetKey, extensionFor } from "./keys";

const SUBMISSION = "11111111-2222-3333-4444-555555555555";

describe("assetKey", () => {
  it("groups a submission's objects under one prefix", () => {
    expect(assetKey(SUBMISSION, "ID_FRONT", "jpg").startsWith(
      `pickup/${SUBMISSION}/`
    )).toBe(true);
  });

  it("says nothing about the person in the key itself", () => {
    // Keys reach logs, storage consoles and support tickets. A name or an
    // email in one is a leak that no access control catches.
    expect(assetKey(SUBMISSION, "ID_FRONT", "jpg")).toMatch(
      /^pickup\/[0-9a-f-]{36}\/ID_FRONT-[0-9a-f]{16}\.jpg$/
    );
  });

  it("gives two objects of the same kind different keys", () => {
    const a = assetKey(SUBMISSION, "CONDITION_PHOTO", "jpg");
    const b = assetKey(SUBMISSION, "CONDITION_PHOTO", "jpg");
    expect(a).not.toBe(b);
  });
});

describe("extensionFor", () => {
  it("maps the content types the wizard produces", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("application/pdf")).toBe("pdf");
  });

  it("falls back to bin rather than inventing an extension", () => {
    expect(extensionFor("application/octet-stream")).toBe("bin");
    expect(extensionFor("")).toBe("bin");
  });
});
