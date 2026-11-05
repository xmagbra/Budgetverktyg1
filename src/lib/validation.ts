import { z } from "zod";
import {
  parseAnnualRateToBps,
  parseMoneyToMinor,
} from "./finance";

export const householdNameSchema = z
  .string()
  .trim()
  .min(2, "Namnet måste innehålla minst två tecken.")
  .max(100, "Namnet får vara högst 100 tecken.");

export const emailSchema = z.string().trim().email().max(254);

export const invitationSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
});

export const passwordSchema = z
  .string()
  .min(12, "Lösenordet måste innehålla minst 12 tecken.")
  .max(128, "Lösenordet får vara högst 128 tecken.");

export const uuidSchema = z.uuid();

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);

const moneyInputSchema = z
  .string()
  .trim()
  .refine((value) => parseMoneyToMinor(value) !== null, "Ange ett belopp med högst två decimaler.")
  .refine((value) => (parseMoneyToMinor(value) ?? BigInt(0)) > BigInt(0), "Beloppet måste vara större än noll.");

const nonnegativeMoneyInputSchema = z
  .string()
  .trim()
  .refine((value) => parseMoneyToMinor(value) !== null, "Ange ett belopp med högst två decimaler.");

const annualRateInputSchema = z
  .string()
  .trim()
  .refine((value) => parseAnnualRateToBps(value) !== null, "Ange en årsränta från 0 till 1000 med högst två decimaler.");

const financeDateSchema = z.iso.date();

export const financialAccountInputSchema = z.object({
  householdId: uuidSchema,
  name: z.string().trim().min(1).max(80),
  type: z.enum(["checking", "savings", "cash"]),
  openingBalance: nonnegativeMoneyInputSchema,
  openingBalanceOn: financeDateSchema,
});

export const financeCategoryInputSchema = z.object({
  householdId: uuidSchema,
  name: z.string().trim().min(1).max(80),
  type: z.enum(["income", "expense"]),
});

export const financeTransactionInputSchema = z.object({
  householdId: uuidSchema,
  accountId: uuidSchema,
  categoryId: uuidSchema,
  type: z.enum(["income", "expense"]),
  amount: moneyInputSchema,
  occurredOn: financeDateSchema,
  description: z.string().trim().min(1).max(200),
});

export const financeTransferInputSchema = z.object({
  householdId: uuidSchema,
  sourceAccountId: uuidSchema,
  destinationAccountId: uuidSchema,
  amount: moneyInputSchema,
  occurredOn: financeDateSchema,
  description: z.string().trim().min(1).max(200),
}).refine(
  (value) => value.sourceAccountId !== value.destinationAccountId,
  { message: "Välj två olika konton.", path: ["destinationAccountId"] },
);

export const loanInputSchema = z.object({
  householdId: uuidSchema,
  name: z.string().trim().min(1).max(100),
  principal: moneyInputSchema,
  termMonths: z.coerce.number().int().min(1).max(1200),
  paymentDay: z.coerce.number().int().min(1).max(28),
  repaymentMethod: z.enum(["annuity", "linear"]),
  annualRate: annualRateInputSchema,
});

export const loanRateInputSchema = z.object({
  householdId: uuidSchema,
  loanId: uuidSchema,
  annualRate: annualRateInputSchema,
});

export const loanPaymentInputSchema = z.object({
  householdId: uuidSchema,
  loanId: uuidSchema,
  sourceAccountId: uuidSchema,
  amount: moneyInputSchema,
  paidOn: financeDateSchema,
});

export const loanSimulationInputSchema = z.object({
  householdId: uuidSchema,
  loanId: uuidSchema,
  annualRate: annualRateInputSchema,
});
