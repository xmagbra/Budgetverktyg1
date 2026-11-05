"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/server";
import {
  financeCategories,
  financeTransactions,
  financeTransfers,
  financialAccounts,
  auditLogs,
  loanPayments,
  loanRates,
  loans,
} from "@/db/schema";
import { isHouseholdMember } from "@/lib/finance-access";
import {
  accruedInterestMinor,
  formatMinorAsMoney,
  parseAnnualRateToBps,
  parseMoneyToMinor,
  projectLoanAtRate,
  remainingTermMonths,
  type LoanRate,
} from "@/lib/finance";
import { requireSession } from "@/lib/auth/session";
import {
  financeCategoryInputSchema,
  financeTransactionInputSchema,
  financeTransferInputSchema,
  financialAccountInputSchema,
  loanInputSchema,
  loanPaymentInputSchema,
  loanRateInputSchema,
  loanSimulationInputSchema,
} from "@/lib/validation";

export type FinanceActionState = {
  error?: string;
  success?: string;
  simulation?: {
    recalculated: {
      paymentMinor: string;
      payoffMonths: number | null;
      totalInterestMinor: string;
    };
    fixedPayment: {
      paymentMinor: string;
      payoffMonths: number | null;
      totalInterestMinor: string;
      remainingBalanceMinor: string;
    };
  };
};

function swedishDateNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Kontrollera de angivna uppgifterna.";
}

async function authorized(householdId: string, userId: string) {
  return isHouseholdMember(userId, householdId);
}

function auditStatement(input: {
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
}) {
  return db.insert(auditLogs).values(input);
}

export async function createFinancialAccountAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = financialAccountInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (!(await authorized(parsed.data.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  if (parsed.data.openingBalanceOn > swedishDateNow()) {
    return { error: "Datumet för ingående saldo får inte ligga i framtiden." };
  }
  const id = crypto.randomUUID();
  const insertAccount = db.insert(financialAccounts).values({
    id,
    householdId: parsed.data.householdId,
    name: parsed.data.name,
    type: parsed.data.type,
    openingBalanceMinor: parseMoneyToMinor(parsed.data.openingBalance)!,
    openingBalanceOn: parsed.data.openingBalanceOn,
    createdBy: actor.id,
  });
  await db.batch([insertAccount, auditStatement({
    actorId: actor.id,
    eventType: "finance.account_created",
    entityType: "financial_account",
    entityId: id,
  })]);
  revalidatePath(`/households/${parsed.data.householdId}/finance`);
  return { success: "Kontot har skapats." };
}

export async function createFinanceCategoryAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = financeCategoryInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (!(await authorized(parsed.data.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  const id = crypto.randomUUID();
  const insertCategory = db.insert(financeCategories).values({
    id,
    householdId: parsed.data.householdId,
    name: parsed.data.name,
    type: parsed.data.type,
    createdBy: actor.id,
  }).onConflictDoNothing().returning({ id: financeCategories.id });
  const [created] = await db.batch([insertCategory, db.execute(sql`
    INSERT INTO audit_logs (actor_id, event_type, entity_type, entity_id)
    SELECT ${actor.id}, 'finance.category_created', 'finance_category', ${id}
    WHERE EXISTS (SELECT 1 FROM finance_categories WHERE id = ${id}::uuid)
  `)]);
  if (!created.length) return { error: "Det finns redan en kategori med detta namn och denna typ." };
  revalidatePath(`/households/${parsed.data.householdId}/finance`);
  return { success: "Kategorin har skapats." };
}

export async function createFinanceTransactionAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = financeTransactionInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  if (input.occurredOn > swedishDateNow()) {
    return { error: "Transaktionens datum får inte ligga i framtiden." };
  }
  const [account] = await db
    .select({
      id: financialAccounts.id,
      openingBalanceOn: financialAccounts.openingBalanceOn,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, input.accountId),
        eq(financialAccounts.householdId, input.householdId),
      ),
    )
    .limit(1);
  const [category] = await db
    .select({ type: financeCategories.type })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.id, input.categoryId),
        eq(financeCategories.householdId, input.householdId),
        eq(financeCategories.type, input.type),
      ),
    )
    .limit(1);
  if (!account || !category) {
    return { error: "Välj ett konto och en kategori av rätt typ i hushållet." };
  }
  if (input.occurredOn < account.openingBalanceOn) {
    return { error: "Transaktionsdatumet får inte ligga före kontots ingående saldo." };
  }
  const id = crypto.randomUUID();
  const insertTransaction = db.insert(financeTransactions).values({
    id,
    householdId: input.householdId,
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
    amountMinor: parseMoneyToMinor(input.amount)!,
    occurredOn: input.occurredOn,
    description: input.description,
    createdBy: actor.id,
  });
  await db.batch([insertTransaction, auditStatement({
    actorId: actor.id,
    eventType: "finance.transaction_created",
    entityType: "finance_transaction",
    entityId: id,
  })]);
  revalidatePath(`/households/${input.householdId}/finance`);
  return { success: "Transaktionen har registrerats." };
}

export async function createFinanceTransferAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = financeTransferInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  if (input.occurredOn > swedishDateNow()) {
    return { error: "Överföringens datum får inte ligga i framtiden." };
  }
  const matchingAccounts = await db
    .select({
      id: financialAccounts.id,
      openingBalanceOn: financialAccounts.openingBalanceOn,
    })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, input.householdId));
  const accountIds = new Set(matchingAccounts.map((account) => account.id));
  if (!accountIds.has(input.sourceAccountId) ||
    !accountIds.has(input.destinationAccountId)) {
    return { error: "Välj två konton i samma hushåll." };
  }
  if (matchingAccounts.some((account) =>
    (account.id === input.sourceAccountId || account.id === input.destinationAccountId) &&
    input.occurredOn < account.openingBalanceOn
  )) {
    return { error: "Överföringsdatumet får inte ligga före något av kontonas ingående saldo." };
  }
  const id = crypto.randomUUID();
  const insertTransfer = db.insert(financeTransfers).values({
    id,
    householdId: input.householdId,
    sourceAccountId: input.sourceAccountId,
    destinationAccountId: input.destinationAccountId,
    amountMinor: parseMoneyToMinor(input.amount)!,
    occurredOn: input.occurredOn,
    description: input.description,
    createdBy: actor.id,
  });
  await db.batch([insertTransfer, auditStatement({
    actorId: actor.id,
    eventType: "finance.transfer_created",
    entityType: "finance_transfer",
    entityId: id,
  })]);
  revalidatePath(`/households/${input.householdId}/finance`);
  return { success: "Överföringen har registrerats utan att räknas som inkomst eller utgift." };
}

export async function createLoanAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = loanInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  const id = crypto.randomUUID();
  const today = swedishDateNow();
  const insertLoan = db.insert(loans).values({
    id,
    householdId: input.householdId,
    name: input.name,
    startingPrincipalMinor: parseMoneyToMinor(input.principal)!,
    startDate: today,
    termMonths: input.termMonths,
    paymentDay: input.paymentDay,
    repaymentMethod: input.repaymentMethod,
    createdBy: actor.id,
  });
  const insertRate = db.insert(loanRates).values({
    loanId: id,
    annualRateBps: parseAnnualRateToBps(input.annualRate)!,
    effectiveOn: today,
    changedBy: actor.id,
  });
  const insertAudit = auditStatement({
    actorId: actor.id,
    eventType: "finance.loan_created",
    entityType: "loan",
    entityId: id,
  });
  await db.batch([insertLoan, insertRate, insertAudit]);
  revalidatePath(`/households/${input.householdId}/finance`);
  return { success: "Lånet har registrerats." };
}

export async function changeLoanRateAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = loanRateInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  const [loan] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.id, input.loanId), eq(loans.householdId, input.householdId)))
    .limit(1);
  if (!loan) return { error: "Lånet kunde inte hittas i hushållet." };
  const today = swedishDateNow();
  const changeRate = db
    .insert(loanRates)
    .values({
      loanId: input.loanId,
      annualRateBps: parseAnnualRateToBps(input.annualRate)!,
      effectiveOn: today,
      changedBy: actor.id,
    })
    .onConflictDoUpdate({
      target: [loanRates.loanId, loanRates.effectiveOn],
      set: {
        annualRateBps: parseAnnualRateToBps(input.annualRate)!,
        changedBy: actor.id,
      },
    });
  await db.batch([changeRate, auditStatement({
    actorId: actor.id,
    eventType: "finance.loan_rate_changed",
    entityType: "loan",
    entityId: input.loanId,
  })]);
  revalidatePath(`/households/${input.householdId}/finance`);
  return { success: `Den nya räntan gäller från ${today}.` };
}

export async function recordLoanPaymentAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = loanPaymentInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  const [loan] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, input.loanId), eq(loans.householdId, input.householdId)))
    .limit(1);
  const [account] = await db
    .select({
      id: financialAccounts.id,
      openingBalanceOn: financialAccounts.openingBalanceOn,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, input.sourceAccountId),
        eq(financialAccounts.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!loan || !account) return { error: "Välj ett befintligt lån och ett konto i hushållet." };
  if (input.paidOn < account.openingBalanceOn) {
    return { error: "Betalningsdatumet får inte ligga före kontots ingående saldo." };
  }

  const payments = await db
    .select({
      principalMinor: loanPayments.principalMinor,
      paidOn: loanPayments.paidOn,
    })
    .from(loanPayments)
    .where(eq(loanPayments.loanId, loan.id));
  const rates: LoanRate[] = await db
    .select({
      annualRateBps: loanRates.annualRateBps,
      effectiveOn: loanRates.effectiveOn,
    })
    .from(loanRates)
    .where(eq(loanRates.loanId, loan.id))
    .orderBy(loanRates.effectiveOn);
  const latestPaymentDate = payments.reduce(
    (latest, payment) => payment.paidOn > latest ? payment.paidOn : latest,
    loan.startDate,
  );
  if (input.paidOn < latestPaymentDate || input.paidOn > swedishDateNow()) {
    return { error: "Betalningsdatumet måste vara efter senaste betalningen och får inte ligga i framtiden." };
  }
  const currentRate = rates.at(-1);
  if (!currentRate) return { error: "Lånet saknar registrerad ränta." };
  const balance = loan.startingPrincipalMinor -
    payments.reduce((sum, payment) => sum + payment.principalMinor, BigInt(0));
  if (balance <= BigInt(0)) return { error: "Lånet är redan återbetalt." };

  const interestMinor = accruedInterestMinor(
    balance,
    rates,
    latestPaymentDate,
    input.paidOn,
  );
  const amountMinor = parseMoneyToMinor(input.amount)!;
  const principalMinor = amountMinor - interestMinor;
  if (principalMinor <= BigInt(0) || principalMinor > balance) {
    return {
      error: `Betalningen måste täcka räntan ${formatMinorAsMoney(interestMinor)} kr och får inte överstiga kvarvarande skuld med ränta.`,
    };
  }
  const paymentId = crypto.randomUUID();
  // Neon HTTP batches run in one transaction. Lock first, then recheck the
  // snapshot in a separate statement so a waiting request sees committed payments.
  const [, inserted] = await db.batch([
    db.select({ id: loans.id }).from(loans).where(eq(loans.id, loan.id)).for("update"),
    db.execute(sql`
      WITH inserted AS (
        INSERT INTO loan_payments
          (id, loan_id, source_account_id, paid_on, amount_minor, interest_minor, principal_minor, created_by)
        SELECT ${paymentId}::uuid, ${loan.id}::uuid, ${input.sourceAccountId}::uuid,
          ${input.paidOn}::date, ${amountMinor.toString()}::bigint,
          ${interestMinor.toString()}::bigint, ${principalMinor.toString()}::bigint, ${actor.id}
        WHERE (SELECT count(*) FROM loan_payments WHERE loan_id = ${loan.id}::uuid) = ${payments.length}
        RETURNING id
      ), logged AS (
        INSERT INTO audit_logs (actor_id, event_type, entity_type, entity_id)
        SELECT ${actor.id}, 'finance.loan_payment_recorded', 'loan', ${loan.id}
        FROM inserted
      )
      SELECT id FROM inserted
    `),
  ]);
  if (!inserted.rows.length) {
    return { error: "En annan betalning har registrerats samtidigt. Kontrollera uppgifterna och försök igen." };
  }
  revalidatePath(`/households/${input.householdId}/finance`);
  return { success: `Betalningen har registrerats. Ränta: ${formatMinorAsMoney(interestMinor)} kr.` };
}

export async function simulateLoanAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { user: actor } = await requireSession();
  const parsed = loanSimulationInputSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;
  if (!(await authorized(input.householdId, actor.id))) {
    return { error: "Du saknar åtkomst till hushållets ekonomi." };
  }
  const [loan] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, input.loanId), eq(loans.householdId, input.householdId)))
    .limit(1);
  if (!loan) return { error: "Lånet kunde inte hittas i hushållet." };
  const payments = await db
    .select({ principalMinor: loanPayments.principalMinor })
    .from(loanPayments)
    .where(eq(loanPayments.loanId, loan.id));
  const rates = await db
    .select({
      annualRateBps: loanRates.annualRateBps,
      effectiveOn: loanRates.effectiveOn,
    })
    .from(loanRates)
    .where(eq(loanRates.loanId, loan.id))
    .orderBy(loanRates.effectiveOn);
  const currentRate = rates.at(-1);
  if (!currentRate) return { error: "Lånet saknar registrerad ränta." };
  const balance = loan.startingPrincipalMinor -
    payments.reduce((sum, payment) => sum + payment.principalMinor, BigInt(0));
  if (balance <= BigInt(0)) return { error: "Det återstår ingen skuld att simulera." };
  const remainingMonths = remainingTermMonths(loan.termMonths, loan.startDate, loan.paymentDay, swedishDateNow());
  const currentProjection = projectLoanAtRate({
    principalMinor: balance,
    annualRateBps: currentRate.annualRateBps,
    fromDate: swedishDateNow(),
    paymentDay: loan.paymentDay,
    remainingMonths,
    repaymentMethod: loan.repaymentMethod,
  });
  const projection = projectLoanAtRate({
    principalMinor: balance,
    annualRateBps: parseAnnualRateToBps(input.annualRate)!,
    fromDate: swedishDateNow(),
    paymentDay: loan.paymentDay,
    remainingMonths,
    repaymentMethod: loan.repaymentMethod,
    currentPaymentMinor: currentProjection.recalculated.monthlyPaymentMinor,
  });
  return {
    simulation: {
      recalculated: {
        paymentMinor: projection.recalculated.monthlyPaymentMinor.toString(),
        payoffMonths: projection.recalculated.payoffMonths,
        totalInterestMinor: projection.recalculated.totalInterestMinor.toString(),
      },
      fixedPayment: {
        paymentMinor: projection.fixedPayment.monthlyPaymentMinor.toString(),
        payoffMonths: projection.fixedPayment.payoffMonths,
        totalInterestMinor: projection.fixedPayment.totalInterestMinor.toString(),
        remainingBalanceMinor: projection.fixedPayment.remainingBalanceMinor.toString(),
      },
    },
  };
}
