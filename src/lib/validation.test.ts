import { describe, expect, it } from "vitest";
import {
  householdNameSchema,
  invitationSchema,
  invitationTokenSchema,
  passwordSchema,
  uuidSchema,
} from "./validation";

describe("input validation", () => {
  it("accepts and trims household names within the configured bounds", () => {
    expect(householdNameSchema.parse("  Familjen  ")).toBe("Familjen");
    expect(householdNameSchema.safeParse("x").success).toBe(false);
    expect(householdNameSchema.safeParse("x".repeat(101)).success).toBe(false);
  });

  it("validates invite identity data", () => {
    expect(
      invitationSchema.safeParse({ name: "Ada", email: "ada@example.com" }).success,
    ).toBe(true);
    expect(
      invitationSchema.safeParse({ name: "", email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("requires long passwords for invited accounts", () => {
    expect(passwordSchema.safeParse("a-secure-password").success).toBe(true);
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });

  it("accepts only canonical IDs and generated invitation-token shapes", () => {
    expect(uuidSchema.safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("short").success).toBe(false);
  });
});
