import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), member: vi.fn(), select: vi.fn(), batch: vi.fn(),
}));
vi.mock("@/db/server", () => ({ db: { select: mocks.select, batch: mocks.batch } }));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.session }));
vi.mock("@/lib/finance-access", () => ({ isHouseholdMember: mocks.member }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createFinancialAccountAction, createFinanceCategoryAction,
  createFinanceTransactionAction, createFinanceTransferAction,
  createLoanAction, changeLoanRateAction, recordLoanPaymentAction, simulateLoanAction,
} from "./actions";

const householdId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const accountId = "1b671a64-40d5-491e-99b0-da01ff1f3341";
const otherId = "7f8e9d8c-5f23-4f90-b207-589cd6f3a5a1";
const cases = [
  [createFinancialAccountAction, { name: "Bank", type: "checking", openingBalance: "0", openingBalanceOn: "2025-01-01" }],
  [createFinanceCategoryAction, { name: "Mat", type: "expense" }],
  [createFinanceTransactionAction, { accountId, categoryId: otherId, type: "expense", amount: "10", occurredOn: "2025-01-01", description: "Mat" }],
  [createFinanceTransferAction, { sourceAccountId: accountId, destinationAccountId: otherId, amount: "10", occurredOn: "2025-01-01", description: "Sparande" }],
  [createLoanAction, { name: "Lån", principal: "1000", termMonths: "12", paymentDay: "28", repaymentMethod: "annuity", annualRate: "5" }],
  [changeLoanRateAction, { loanId: otherId, annualRate: "5" }],
  [recordLoanPaymentAction, { loanId: otherId, sourceAccountId: accountId, amount: "100", paidOn: "2025-01-01" }],
  [simulateLoanAction, { loanId: otherId, annualRate: "5" }],
] as const;

describe("finance action authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // A system administrator still needs household membership to read finances.
    mocks.session.mockResolvedValue({ user: { id: "admin", role: "admin" } });
    mocks.member.mockResolvedValue(false);
  });

  for (const [action, fields] of cases) {
    it(`${action.name} rejects access to another household before querying finances`, async () => {
      const form = new FormData();
      for (const [key, value] of Object.entries({ householdId, ...fields })) form.set(key, value);
      expect(await action({}, form)).toEqual({ error: "Du saknar åtkomst till hushållets ekonomi." });
      expect(mocks.member).toHaveBeenCalledWith("admin", householdId);
      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.batch).not.toHaveBeenCalled();
    });

    it(`${action.name} requires a session`, async () => {
      mocks.session.mockRejectedValue(new Error("Unauthenticated"));
      await expect(action({}, new FormData())).rejects.toThrow("Unauthenticated");
      expect(mocks.member).not.toHaveBeenCalled();
      expect(mocks.batch).not.toHaveBeenCalled();
    });
  }
});
