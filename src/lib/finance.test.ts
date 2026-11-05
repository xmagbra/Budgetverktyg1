import { describe, expect, it } from "vitest";
import {
  accruedInterestMinor,
  formatMinorAsMoney,
  parseAnnualRateToBps,
  parseMoneyToMinor,
  projectLoanAtRate,
  remainingTermMonths,
} from "./finance";

describe("exact SEK and interest helpers", () => {
  it("parses kronor to ören without floating-point arithmetic", () => {
    expect(parseMoneyToMinor("123,45")).toBe(BigInt(12_345));
    expect(parseMoneyToMinor("0.5")).toBe(BigInt(50));
    expect(parseMoneyToMinor("1.234")).toBeNull();
    expect(parseMoneyToMinor("-1")).toBeNull();
    expect(parseMoneyToMinor("9".repeat(100))).toBeNull();
    expect(formatMinorAsMoney(-BigInt(12_345))).toBe("-123,45");
  });

  it("parses annual percentage rates to basis points", () => {
    expect(parseAnnualRateToBps("4,25")).toBe(425);
    expect(parseAnnualRateToBps("0")).toBe(0);
    expect(parseAnnualRateToBps("1000,01")).toBeNull();
    expect(parseAnnualRateToBps("4,257")).toBeNull();
  });

  it("accrues actual days over a fixed 365-day year and rounds half up", () => {
    expect(
      accruedInterestMinor(
        BigInt(10_000),
        [{ effectiveOn: "2025-01-01", annualRateBps: 365 }],
        "2025-01-01",
        "2026-01-01",
      ),
    ).toBe(BigInt(365));
    expect(
      accruedInterestMinor(
        BigInt(10_000),
        [{ effectiveOn: "2025-01-01", annualRateBps: 1 }],
        "2025-01-01",
        "2025-01-02",
      ),
    ).toBe(BigInt(0));
    expect(
      accruedInterestMinor(
        BigInt(10_000),
        [{ effectiveOn: "2024-01-01", annualRateBps: 365 }],
        "2024-01-01",
        "2025-01-01",
      ),
    ).toBe(BigInt(366));
    expect(
      accruedInterestMinor(
        BigInt(50),
        [{ effectiveOn: "2025-01-01", annualRateBps: 365 }],
        "2025-01-01",
        "2025-04-11",
      ),
    ).toBe(BigInt(1));
  });

  it("uses the historical rate for each day in an accrued period", () => {
    expect(
      accruedInterestMinor(
        BigInt(10_000),
        [
          { effectiveOn: "2025-01-01", annualRateBps: 365 },
          { effectiveOn: "2025-07-02", annualRateBps: 730 },
        ],
        "2025-01-01",
        "2026-01-01",
      ),
    ).toBe(BigInt(548));
  });
});

describe("loan projections", () => {
  it("projects an annuity with a fixed term and a fixed-payment alternative", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(100_000),
      annualRateBps: 0,
      fromDate: "2025-01-01",
      paymentDay: 28,
      remainingMonths: 10,
      repaymentMethod: "annuity",
      currentPaymentMinor: BigInt(9_000),
    });

    expect(projection.recalculated.monthlyPaymentMinor).toBe(BigInt(10_000));
    expect(projection.recalculated.payoffMonths).toBe(10);
    expect(projection.recalculated.totalInterestMinor).toBe(BigInt(0));
    expect(projection.fixedPayment.payoffMonths).toBe(12);
  });

  it("projects linear amortization without floating-point money", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(100_001),
      annualRateBps: 0,
      fromDate: "2025-01-01",
      paymentDay: 28,
      remainingMonths: 10,
      repaymentMethod: "linear",
    });
    expect(projection.recalculated.monthlyPaymentMinor).toBe(BigInt(10_001));
    expect(projection.recalculated.payoffMonths).toBe(10);
    expect(projection.recalculated.remainingBalanceMinor).toBe(BigInt(0));
    expect(projection.recalculated.totalInterestMinor).toBe(BigInt(0));
  });

  it("calculates an exact amortization projection with daily interest", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(1_000_000),
      annualRateBps: 500,
      fromDate: "2025-01-01",
      paymentDay: 28,
      remainingMonths: 12,
      repaymentMethod: "annuity",
    });

    expect(projection.recalculated.monthlyPaymentMinor).toBeGreaterThan(BigInt(83_333));
    expect(projection.recalculated.payoffMonths).toBe(12);
    expect(projection.fixedPayment.totalInterestMinor).toBeGreaterThan(BigInt(0));
  });

  it("rejects a fixed payment that cannot cover the simulated interest", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(100_000),
      annualRateBps: 100_000,
      fromDate: "2025-01-01",
      paymentDay: 28,
      remainingMonths: 10,
      repaymentMethod: "annuity",
      currentPaymentMinor: BigInt(1),
    });

    expect(projection.fixedPayment.payoffMonths).toBeNull();
    expect(projection.fixedPayment.remainingBalanceMinor).toBeGreaterThan(BigInt(0));
  });

  it("validates remaining loan terms", () => {
    expect(remainingTermMonths(12, "2025-01-01", 28, "2025-05-01")).toBe(8);
    expect(remainingTermMonths(12, "2025-01-01", 28, "2025-01-27")).toBe(12);
    expect(remainingTermMonths(12, "2025-01-01", 28, "2025-01-28")).toBe(11);
    expect(remainingTermMonths(12, "2025-01-28", 28, "2025-01-28")).toBe(12);
    expect(remainingTermMonths(12, "2025-01-29", 28, "2025-03-01")).toBe(11);
    expect(remainingTermMonths(12, "2025-01-01", 28, "2026-12-01")).toBe(1);
    expect(() => remainingTermMonths(0, "2025-01-01", 28, "2025-01-01")).toThrow(RangeError);
    expect(() => remainingTermMonths(12, "2025-01-01", 28, "2024-12-31")).toThrow(RangeError);
  });

  it("includes interest in the default fixed payment for linear loans", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(100_000), annualRateBps: 500,
      fromDate: "2025-01-01", paymentDay: 28, remainingMonths: 10,
      repaymentMethod: "linear",
    });
    expect(projection.fixedPayment.monthlyPaymentMinor).toBe(projection.recalculated.monthlyPaymentMinor);
    expect(projection.fixedPayment.payoffMonths).not.toBeNull();
  });

  it("reports the actual payment when the balance is smaller than the fixed amount", () => {
    const projection = projectLoanAtRate({
      principalMinor: BigInt(1), annualRateBps: 0,
      fromDate: "2025-01-01", paymentDay: 28, remainingMonths: 12,
      repaymentMethod: "annuity", currentPaymentMinor: BigInt(100),
    });
    expect(projection.fixedPayment.monthlyPaymentMinor).toBe(BigInt(1));
    expect(projection.fixedPayment.payoffMonths).toBe(1);
  });
});
