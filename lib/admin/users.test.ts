import { describe, expect, it } from "vitest";
import { newUserSchema, updateUserSchema } from "./users";

describe("newUserSchema", () => {
  it("lowercases and trims the username", () => {
    const parsed = newUserSchema.parse({
      username: "  Ahmed  ",
      displayName: "Eng Ahmed",
      password: "Sommer2026!",
      role: "staff",
    });
    expect(parsed.username).toBe("ahmed");
  });

  it("refuses usernames that would be ambiguous or unusable", () => {
    for (const username of ["ab", "a".repeat(33), "has space", "Grüezi", "semi;colon", ""]) {
      const result = newUserSchema.safeParse({
        username,
        displayName: "X",
        password: "Sommer2026!",
        role: "staff",
      });
      expect(result.success, username).toBe(false);
    }
  });

  it("accepts the punctuation an office actually uses", () => {
    for (const username of ["ahmed", "a.meier", "hans-peter", "user_2"]) {
      expect(
        newUserSchema.safeParse({
          username,
          displayName: "X",
          password: "Sommer2026!",
          role: "staff",
        }).success,
        username
      ).toBe(true);
    }
  });

  it("requires a password long enough to be worth hashing", () => {
    const result = newUserSchema.safeParse({
      username: "ahmed",
      displayName: "Eng Ahmed",
      password: "short",
      role: "staff",
    });
    expect(result.success).toBe(false);
  });

  it("defaults the role to staff", () => {
    const parsed = newUserSchema.parse({
      username: "ahmed",
      displayName: "Eng Ahmed",
      password: "Sommer2026!",
    });
    expect(parsed.role).toBe("staff");
  });
});

describe("updateUserSchema", () => {
  it("refuses an empty patch", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a password on its own", () => {
    expect(updateUserSchema.safeParse({ password: "Herbst2026!" }).success).toBe(true);
  });

  it("accepts disabling on its own", () => {
    expect(updateUserSchema.safeParse({ disabled: true }).success).toBe(true);
  });
});
