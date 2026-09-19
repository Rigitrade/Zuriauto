import { describe, expect, it } from "vitest";
import {
  SERVICE_NOTICE_KM,
  formatKm,
  kmUntilService,
  serviceStanding,
} from "./service";

describe("serviceStanding", () => {
  it("says nothing when either figure is missing", () => {
    // The case this exists for: a due reading and no current one. The car may
    // need a service today or in a year, and a screen that guessed would be
    // believed exactly once.
    expect(serviceStanding({ currentMileageKm: null, serviceDueKm: 107_000 })).toBe(
      "none"
    );
    expect(serviceStanding({ currentMileageKm: 100_000, serviceDueKm: null })).toBe(
      "none"
    );
    expect(serviceStanding({})).toBe("none");
  });

  it("is quiet while the service is comfortably ahead", () => {
    // The client's own figures: 100'000 now, due at 107'000.
    expect(serviceStanding({ currentMileageKm: 100_000, serviceDueKm: 107_000 })).toBe(
      "ok"
    );
  });

  it("warns from the notice window, and at its exact edge", () => {
    expect(
      serviceStanding({
        currentMileageKm: 107_000 - SERVICE_NOTICE_KM,
        serviceDueKm: 107_000,
      })
    ).toBe("due");
    expect(
      serviceStanding({
        currentMileageKm: 107_000 - SERVICE_NOTICE_KM - 1,
        serviceDueKm: 107_000,
      })
    ).toBe("ok");
  });

  it("calls it overdue once the reading is reached, not only once passed", () => {
    // Reaching the due figure is the service falling due, not the last
    // kilometre before it.
    expect(serviceStanding({ currentMileageKm: 107_000, serviceDueKm: 107_000 })).toBe(
      "overdue"
    );
    expect(serviceStanding({ currentMileageKm: 109_400, serviceDueKm: 107_000 })).toBe(
      "overdue"
    );
  });

  it("refuses a figure that is not a finite number", () => {
    // These arrive as JSON. A NaN that sorted as a number would put a car
    // somewhere arbitrary in a list the office reads top-down.
    expect(
      serviceStanding({ currentMileageKm: Number.NaN, serviceDueKm: 107_000 })
    ).toBe("none");
  });
});

describe("kmUntilService", () => {
  it("counts down to the due reading", () => {
    expect(kmUntilService({ currentMileageKm: 100_000, serviceDueKm: 107_000 })).toBe(
      7_000
    );
  });

  it("goes negative past it, so the caller picks the wording", () => {
    expect(kmUntilService({ currentMileageKm: 108_200, serviceDueKm: 107_000 })).toBe(
      -1_200
    );
  });

  it("is null when it cannot be said", () => {
    expect(kmUntilService({ currentMileageKm: 100_000 })).toBeNull();
  });
});

describe("formatKm", () => {
  it("groups with a typewriter apostrophe, not a curly one", () => {
    // The office copies these figures into a garage's form; U+2019 is correct
    // typography and the wrong character to paste.
    expect(formatKm(107_000)).toBe("107'000");
    expect(formatKm(107_000)).not.toContain("’");
  });

  it("leaves a small reading alone", () => {
    expect(formatKm(940)).toBe("940");
  });
});
