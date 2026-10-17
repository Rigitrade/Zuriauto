import { describe, expect, it } from "vitest";
import { rentalTermsSchema } from "@/lib/rental/terms";
import { EMPTY_TERMS, toRentalTerms, type TermsFormState } from "./RentalTermsStep";

const weekly: TermsFormState = {
  ...EMPTY_TERMS,
  startDate: "2026-10-19",
  startTime: "10:00",
  amount: "450.00",
  paymentMethod: "cash",
};

const weeksOf = (state: TermsFormState) => {
  const parsed = rentalTermsSchema.safeParse(toRentalTerms(state));
  if (!parsed.success) return parsed.error.issues[0]?.message;
  return parsed.data.type === "WEEKLY" ? parsed.data.totalWeeks : null;
};

describe("the number of weeks on the pickup form", () => {
  it("starts at one week", () => {
    expect(EMPTY_TERMS.totalWeeks).toBe("1");
    expect(weeksOf(weekly)).toBe(1);
  });

  it("books one week when the office empties the field", () => {
    expect(weeksOf({ ...weekly, totalWeeks: "" })).toBe(1);
    expect(weeksOf({ ...weekly, totalWeeks: "  " })).toBe(1);
  });

  it("books the number the office typed", () => {
    expect(weeksOf({ ...weekly, totalWeeks: "4" })).toBe(4);
  });

  it("refuses what is not a whole number of weeks, naming the field", () => {
    for (const totalWeeks of ["abc", "0", "2.5", "105"]) {
      expect(weeksOf({ ...weekly, totalWeeks })).toBe("totalWeeks");
    }
  });

  it("sends no number of weeks for a daily rental", () => {
    const daily = toRentalTerms({
      ...weekly,
      type: "FIXED_TERM",
      totalWeeks: "4",
      endDate: "2026-10-22",
      endTime: "10:00",
    });
    expect(daily).not.toHaveProperty("totalWeeks");
    expect(rentalTermsSchema.safeParse(daily).success).toBe(true);
  });
});
