import { describe, expect, it } from "vitest";
import {
  householdNameSchema,
  invitationSchema,
  invitationTokenSchema,
  passwordSchema,
  financeTransactionInputSchema,
  financeTransferInputSchema,
  loanInputSchema,
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

  it("validates household finance inputs and keeps transfers distinct", () => {
    const householdId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const accountId = "1b671a64-40d5-491e-99b0-da01ff1f3341";
    const categoryId = "7f8e9d8c-5f23-4f90-b207-589cd6f3a5a1";
    expect(financeTransactionInputSchema.safeParse({
      householdId,
      accountId,
      categoryId,
      type: "expense",
      amount: "12,34",
      occurredOn: "2025-01-31",
      description: "Mat",
    }).success).toBe(true);
    expect(financeTransactionInputSchema.safeParse({
      householdId,
      accountId,
      categoryId,
      type: "expense",
      amount: "12,345",
      occurredOn: "2025-02-31",
      description: "Mat",
    }).success).toBe(false);
    expect(financeTransferInputSchema.safeParse({
      householdId,
      sourceAccountId: accountId,
      destinationAccountId: accountId,
      amount: "10.00",
      occurredOn: "2025-01-01",
      description: "Eget sparande",
    }).success).toBe(false);
  });

  it("validates loan repayment terms, amount and interest rate", () => {
    expect(loanInputSchema.safeParse({
      householdId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      name: "Bolån",
      principal: "2500000,00",
      termMonths: "240",
      paymentDay: "28",
      repaymentMethod: "annuity",
      annualRate: "4,25",
    }).success).toBe(true);
    expect(loanInputSchema.safeParse({
      householdId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      name: "Bolån",
      principal: "0",
      termMonths: "240",
      paymentDay: "31",
      repaymentMethod: "annuity",
      annualRate: "1000,01",
    }).success).toBe(false);
  });
});
