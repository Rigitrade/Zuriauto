import { describe, expect, it } from "vitest";
import {
  CAR_LICENCE_MAX_BYTES,
  carLicenceExtension,
  isPdfLicence,
  normaliseCarLicenceType,
  refuseCarLicence,
} from "./carLicence";

describe("refuseCarLicence", () => {
  it("accepts the three image formats and a PDF", () => {
    for (const contentType of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]) {
      expect(refuseCarLicence({ contentType, bytes: 400_000 })).toBeNull();
    }
  });

  it("accepts a PDF, unlike the car photograph", () => {
    // The whole reason this is a separate module. The office scans these, and
    // refusing a scan would mean asking somebody to photograph a document they
    // already hold in a better form.
    expect(
      refuseCarLicence({ contentType: "application/pdf", bytes: 900_000 })
    ).toBeNull();
  });

  it("ignores content-type parameters and case", () => {
    expect(
      refuseCarLicence({ contentType: "image/jpeg; charset=binary", bytes: 1000 })
    ).toBeNull();
    expect(
      refuseCarLicence({ contentType: "APPLICATION/PDF", bytes: 1000 })
    ).toBeNull();
  });

  it("refuses SVG and HTML, which are documents that can carry script", () => {
    // The endpoint serves these bytes back with the type recorded here, so an
    // accepted SVG would be a way to host a page on the company's own origin.
    expect(
      refuseCarLicence({ contentType: "image/svg+xml", bytes: 900 })
    ).toBe("unsupported-type");
    expect(refuseCarLicence({ contentType: "text/html", bytes: 900 })).toBe(
      "unsupported-type"
    );
  });

  it("refuses an empty body, which is a failed read rather than a document", () => {
    expect(
      refuseCarLicence({ contentType: "application/pdf", bytes: 0 })
    ).toBe("empty");
  });

  it("refuses anything over the ceiling", () => {
    expect(
      refuseCarLicence({
        contentType: "application/pdf",
        bytes: CAR_LICENCE_MAX_BYTES + 1,
      })
    ).toBe("too-large");
    // And accepts exactly the ceiling: an off-by-one here would refuse a file
    // the stated limit permits.
    expect(
      refuseCarLicence({
        contentType: "application/pdf",
        bytes: CAR_LICENCE_MAX_BYTES,
      })
    ).toBeNull();
  });

  it("stays inside the platform's request limit", () => {
    // Roughly 4.5 MB is the cap on a function request body. A ceiling above it
    // would be a promise this endpoint cannot keep.
    expect(CAR_LICENCE_MAX_BYTES).toBeLessThan(6 * 1024 * 1024);
  });
});

describe("normaliseCarLicenceType", () => {
  it("strips parameters and lowercases, so nothing is served back verbatim", () => {
    expect(normaliseCarLicenceType("IMAGE/JPEG; charset=binary")).toBe(
      "image/jpeg"
    );
  });
});

describe("carLicenceExtension", () => {
  it("maps each accepted type to its stored extension", () => {
    expect(carLicenceExtension("image/jpeg")).toBe("jpg");
    expect(carLicenceExtension("application/pdf")).toBe("pdf");
  });

  it("falls back rather than throwing on something unaccepted", () => {
    // Unreachable through the endpoint, which refuses first. A throw here
    // would turn a rejected upload into a 500.
    expect(carLicenceExtension("image/svg+xml")).toBe("bin");
  });
});

describe("isPdfLicence", () => {
  it("decides between a document link and a thumbnail", () => {
    expect(isPdfLicence("application/pdf")).toBe(true);
    expect(isPdfLicence("image/jpeg")).toBe(false);
  });

  it("reads nothing stored as not a PDF", () => {
    expect(isPdfLicence(null)).toBe(false);
    expect(isPdfLicence(undefined)).toBe(false);
  });
});
