import { describe, expect, it } from "vitest";
import { MILEAGE_MAX_KM, parseMileageKm } from "./mileage";
import { returnDetailsSchema } from "./returnSchema";
import { contractDetailsSchema } from "./schema";

describe("parseMileageKm", () => {
  it("reads a plain reading", () => {
    expect(parseMileageKm("120000")).toBe(120_000);
  });

  it.each(["120'000", "120’000", "120 000", "120.000", " 120000 "])(
    "tolerates the thousands separator in %j",
    (input) => {
      expect(parseMileageKm(input)).toBe(120_000);
    }
  );

  it("accepts zero and the limit itself", () => {
    expect(parseMileageKm("0")).toBe(0);
    expect(parseMileageKm("2'000'000")).toBe(MILEAGE_MAX_KM);
  });

  // 3'000'000 used to pass the form's step and fail only at submit, with a
  // message that asked for a number — which it was.
  it.each(["2000001", "3000000", "99999999"])("refuses %s, over the limit", (input) => {
    expect(parseMileageKm(input)).toBeNull();
  });

  it.each(["", "   ", "12a", "-5", "1e5"])("refuses %j, not a reading", (input) => {
    expect(parseMileageKm(input)).toBeNull();
  });
});

/**
 * The form and the server must agree on the limit, or a reading passes the
 * form's own check and is refused at submit.
 */
describe("the schemas take the readings the form takes", () => {
  const fields = [
    ["contract", contractDetailsSchema.shape.mileageKm],
    ["return", returnDetailsSchema.shape.mileageKm],
    ["return, at handover", returnDetailsSchema.shape.mileagePickupKm],
  ] as const;

  it.each(fields)("%s", (_, field) => {
    for (const km of [0, MILEAGE_MAX_KM, MILEAGE_MAX_KM + 1]) {
      expect(field.safeParse(km).success, String(km)).toBe(
        parseMileageKm(String(km)) !== null
      );
    }
  });
});
