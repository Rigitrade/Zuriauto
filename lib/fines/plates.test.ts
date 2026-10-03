import { describe, expect, it } from "vitest";
import { findFleetPlates, matchPlate, normalisePlate, suggestPlate } from "./plates";

const FLEET = [
  { id: "prius-a", plate: "ZH 949 636" },
  { id: "prius-b", plate: "ZH 513 925" },
  { id: "octavia", plate: "ZH 123 456" },
  // Retired: fines arrive months after a car has left the fleet.
  { id: "retired", plate: "ZH 401 859" },
];

describe("normalisePlate", () => {
  it("keeps letters and digits only, upper case", () => {
    expect(normalisePlate("zh 949-636.")).toBe("ZH949636");
  });
});

describe("findFleetPlates", () => {
  it("finds our plate however it is spaced", () => {
    for (const printed of ["ZH 949 636", "ZH949636", "ZH-949.636", "zh 949636"]) {
      expect(findFleetPlates(`Kontrollschild ${printed} Fahrzeugart`, FLEET).map((c) => c.id)).toEqual([
        "prius-a",
      ]);
    }
  });

  it("does not find a plate inside a longer one", () => {
    expect(findFleetPlates("Kontrollschild ZH 1234567", FLEET)).toEqual([]);
    expect(findFleetPlates("Kontrollschild AZH 123456", FLEET)).toEqual([]);
  });

  it("never finds a plate in the payment reference's digits", () => {
    expect(findFleetPlates("Referenz 00 19809 19800 08305 57506 01742 949636", FLEET)).toEqual([]);
  });

  it("finds a retired car", () => {
    expect(findFleetPlates("Targa ZH 401859", FLEET).map((c) => c.id)).toEqual(["retired"]);
  });
});

describe("suggestPlate", () => {
  it("forgives the usual OCR confusions", () => {
    expect(suggestPlate("ZH 9496З6", FLEET)?.id).toBe("prius-a");
    expect(suggestPlate("ZH 949G36", FLEET)?.id).toBe("prius-a");
    expect(suggestPlate("2H 949636", FLEET)?.id).toBe("prius-a");
  });

  it("forgives one other wrong character", () => {
    expect(suggestPlate("ZH 949C36", FLEET)?.id).toBe("prius-a");
  });

  it("suggests nothing when two cars are equally close", () => {
    const fleet = [...FLEET, { id: "twin", plate: "ZH 949 637" }];
    expect(suggestPlate("ZH 949 63X", fleet)).toBeNull();
  });

  it("suggests nothing for a plate that is not ours", () => {
    expect(suggestPlate("VD 777 111", FLEET)).toBeNull();
    expect(suggestPlate(null, FLEET)).toBeNull();
  });
});

describe("matchPlate", () => {
  it("confirms one of our plates found in the text", () => {
    expect(matchPlate("Kontrollschild ZH 949636", "ZH 949636", FLEET)).toEqual({
      carId: "prius-a",
      status: "CONFIRMED",
      reason: null,
      candidates: ["prius-a"],
    });
  });

  it("refuses to choose between two of our plates", () => {
    const result = matchPlate("ZH 949636 und ZH 513925", "ZH 949636", FLEET);
    expect(result.reason).toBe("PLATE_AMBIGUOUS");
    expect(result.carId).toBeNull();
    expect(result.candidates.sort()).toEqual(["prius-a", "prius-b"]);
  });

  it("offers a misread plate as a doubtful suggestion only", () => {
    expect(matchPlate("Kontrollschild ZH 949G36", "ZH 949G36", FLEET)).toEqual({
      carId: "prius-a",
      status: "DOUBTFUL",
      reason: null,
      candidates: ["prius-a"],
    });
  });

  it("says a printed plate is not ours", () => {
    expect(matchPlate("Plaque VD 777111", "VD 777111", FLEET)).toEqual({
      carId: null,
      status: "MISSING",
      reason: "PLATE_NOT_IN_FLEET",
      candidates: [],
    });
  });

  it("says nothing was found when there is no plate at all", () => {
    expect(matchPlate("no plate here", null, FLEET).reason).toBeNull();
    expect(matchPlate("no plate here", null, FLEET).status).toBe("MISSING");
  });
});
