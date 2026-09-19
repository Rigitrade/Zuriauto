import { describe, expect, it } from "vitest";
import {
  CAR_PHOTO_MAX_BYTES,
  carPhotoExtension,
  normaliseCarPhotoType,
  refuseCarPhoto,
} from "./carPhoto";

describe("refuseCarPhoto", () => {
  it("accepts the three formats a browser reliably produces and displays", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
      expect(refuseCarPhoto({ contentType, bytes: 400_000 })).toBeNull();
    }
  });

  it("ignores content-type parameters", () => {
    // Some clients append one. Comparing the raw header would refuse a
    // perfectly ordinary JPEG.
    expect(
      refuseCarPhoto({ contentType: "image/jpeg; charset=binary", bytes: 1_000 })
    ).toBeNull();
    expect(refuseCarPhoto({ contentType: "IMAGE/JPEG", bytes: 1_000 })).toBeNull();
  });

  it("refuses SVG, which is a document that can carry script", () => {
    // The endpoint serves these bytes back with the type recorded here, so an
    // accepted SVG would be a way to host a page on the company's own origin.
    expect(refuseCarPhoto({ contentType: "image/svg+xml", bytes: 900 })).toBe(
      "unsupported-type"
    );
    expect(refuseCarPhoto({ contentType: "text/html", bytes: 900 })).toBe(
      "unsupported-type"
    );
  });

  it("refuses HEIC, which most desktop browsers cannot display", () => {
    expect(refuseCarPhoto({ contentType: "image/heic", bytes: 900 })).toBe(
      "unsupported-type"
    );
  });

  it("names the reason rather than answering one generic no", () => {
    // Too large and wrong format call for different things from whoever is
    // holding the phone.
    expect(
      refuseCarPhoto({ contentType: "image/jpeg", bytes: CAR_PHOTO_MAX_BYTES + 1 })
    ).toBe("too-large");
    expect(refuseCarPhoto({ contentType: "image/jpeg", bytes: 0 })).toBe("empty");
  });

  it("allows a file at exactly the ceiling", () => {
    expect(
      refuseCarPhoto({ contentType: "image/png", bytes: CAR_PHOTO_MAX_BYTES })
    ).toBeNull();
  });
});

describe("normaliseCarPhotoType", () => {
  it("strips parameters and case, so nothing raw is stored", () => {
    expect(normaliseCarPhotoType("Image/JPEG; charset=binary")).toBe("image/jpeg");
  });
});

describe("carPhotoExtension", () => {
  it("maps each accepted type to the extension it is stored under", () => {
    expect(carPhotoExtension("image/jpeg")).toBe("jpg");
    expect(carPhotoExtension("image/webp")).toBe("webp");
  });

  it("falls back rather than throwing on a type that got past the guard", () => {
    expect(carPhotoExtension("application/pdf")).toBe("bin");
  });
});
