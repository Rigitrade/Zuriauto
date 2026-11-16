import { describe, expect, it } from "vitest";
import { refusedWhileViewing } from "./viewGuard";

describe("refusedWhileViewing (the read-only view of a partner, phase D)", () => {
  const viewing = true;

  it("refuses every change to the office API while viewing", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(refusedWhileViewing({ method, pathname: "/api/admin/cars/x/", viewing })).toBe(true);
      expect(refusedWhileViewing({ method, pathname: "/api/admin/users/", viewing })).toBe(true);
    }
  });

  it("lets reading through", () => {
    expect(refusedWhileViewing({ method: "GET", pathname: "/api/admin/overview/", viewing })).toBe(false);
    expect(refusedWhileViewing({ method: "HEAD", pathname: "/api/admin/overview/", viewing })).toBe(false);
  });

  it("lets the way out through: leaving the view, and signing out", () => {
    expect(refusedWhileViewing({ method: "DELETE", pathname: "/api/admin/view/", viewing })).toBe(false);
    expect(refusedWhileViewing({ method: "POST", pathname: "/api/admin/view/", viewing })).toBe(false);
    expect(refusedWhileViewing({ method: "DELETE", pathname: "/api/admin/session/", viewing })).toBe(false);
  });

  it("does nothing when not viewing, or outside the office API", () => {
    expect(refusedWhileViewing({ method: "POST", pathname: "/api/admin/cars/", viewing: false })).toBe(false);
    expect(refusedWhileViewing({ method: "POST", pathname: "/api/rental-contract/", viewing })).toBe(false);
  });

  it("is not fooled by a look-alike path", () => {
    expect(refusedWhileViewing({ method: "POST", pathname: "/api/admin/viewer/", viewing })).toBe(true);
    expect(refusedWhileViewing({ method: "POST", pathname: "/api/admin/session-x/", viewing })).toBe(true);
  });
});
