import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, sum } from "drizzle-orm";
import {
  FinanceCategoryForm,
  FinanceTransactionForm,
  FinanceTransferForm,
  FinancialAccountForm,
  LoanForm,
  LoanManagementForms,
} from "@/components/finance-forms";
import { db } from "@/db/server";
import {
  financeCategories,
  financeTransactions,
  financeTransfers,
  financialAccounts,
  households,
  loanPayments,
  loanRates,
  loans,
} from "@/db/schema";
import { isHouseholdMember } from "@/lib/finance-access";
import {
  formatMinorAsMoney,
  projectLoanAtRate,
  remainingTermMonths,
} from "@/lib/finance";
import { requireSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation";

function swedishDateNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

function accountTypeName(type: "checking" | "savings" | "cash") {
  if (type === "checking") return "Bankkonto";
  if (type === "savings") return "Sparkonto";
  return "Kontanter";
}

function formatRate(annualRateBps: number) {
  const whole = Math.floor(annualRateBps / 100);
  const fraction = (annualRateBps % 100).toString().padStart(2, "0");
  return `${whole},${fraction}%`;
}

export default async function HouseholdFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: householdId } = await params;
  const { user: currentUser } = await requireSession();
  if (!uuidSchema.safeParse(householdId).success) notFound();

  const [household] = await db
    .select({ id: households.id, name: households.name })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  if (!household || !(await isHouseholdMember(currentUser.id, householdId))) {
    notFound();
  }

  const today = swedishDateNow();
  const [accounts, categories, transactions, transfers, householdLoans, payments, rates] =
    await Promise.all([
      db
        .select()
        .from(financialAccounts)
        .where(eq(financialAccounts.householdId, householdId))
        .orderBy(asc(financialAccounts.name)),
      db
        .select()
        .from(financeCategories)
        .where(eq(financeCategories.householdId, householdId))
        .orderBy(asc(financeCategories.type), asc(financeCategories.name)),
      db
        .select()
        .from(financeTransactions)
        .where(eq(financeTransactions.householdId, householdId))
        .orderBy(desc(financeTransactions.occurredOn), desc(financeTransactions.createdAt))
        .limit(50),
      db
        .select()
        .from(financeTransfers)
        .where(eq(financeTransfers.householdId, householdId))
        .orderBy(desc(financeTransfers.occurredOn), desc(financeTransfers.createdAt))
        .limit(50),
      db
        .select()
        .from(loans)
        .where(eq(loans.householdId, householdId))
        .orderBy(asc(loans.name)),
      db
        .select()
        .from(loanPayments)
        .innerJoin(loans, eq(loanPayments.loanId, loans.id))
        .where(eq(loans.householdId, householdId))
        .orderBy(desc(loanPayments.paidOn)),
      db
        .select()
        .from(loanRates)
        .innerJoin(loans, eq(loanRates.loanId, loans.id))
        .where(eq(loans.householdId, householdId))
        .orderBy(asc(loanRates.effectiveOn)),
    ]);

  const balances = new Map(accounts.map((account) => [account.id, account.openingBalanceMinor]));
  const openingDatesByAccount = new Map(accounts.map((account) => [account.id, account.openingBalanceOn]));
  const [incomeTotals, expenseTotals, transferOutTotals, transferInTotals] =
    await Promise.all([
      db
        .select({
          accountId: financeTransactions.accountId,
          amountMinor: sum(financeTransactions.amountMinor),
        })
        .from(financeTransactions)
        .innerJoin(financialAccounts, eq(financeTransactions.accountId, financialAccounts.id))
        .where(and(
          eq(financeTransactions.householdId, householdId),
          eq(financeTransactions.type, "income"),
          gte(financeTransactions.occurredOn, financialAccounts.openingBalanceOn),
        ))
        .groupBy(financeTransactions.accountId),
      db
        .select({
          accountId: financeTransactions.accountId,
          amountMinor: sum(financeTransactions.amountMinor),
        })
        .from(financeTransactions)
        .innerJoin(financialAccounts, eq(financeTransactions.accountId, financialAccounts.id))
        .where(and(
          eq(financeTransactions.householdId, householdId),
          eq(financeTransactions.type, "expense"),
          gte(financeTransactions.occurredOn, financialAccounts.openingBalanceOn),
        ))
        .groupBy(financeTransactions.accountId),
      db
        .select({
          accountId: financeTransfers.sourceAccountId,
          amountMinor: sum(financeTransfers.amountMinor),
        })
        .from(financeTransfers)
        .innerJoin(financialAccounts, eq(financeTransfers.sourceAccountId, financialAccounts.id))
        .where(and(
          eq(financeTransfers.householdId, householdId),
          gte(financeTransfers.occurredOn, financialAccounts.openingBalanceOn),
        ))
        .groupBy(financeTransfers.sourceAccountId),
      db
        .select({
          accountId: financeTransfers.destinationAccountId,
          amountMinor: sum(financeTransfers.amountMinor),
        })
        .from(financeTransfers)
        .innerJoin(financialAccounts, eq(financeTransfers.destinationAccountId, financialAccounts.id))
        .where(and(
          eq(financeTransfers.householdId, householdId),
          gte(financeTransfers.occurredOn, financialAccounts.openingBalanceOn),
        ))
        .groupBy(financeTransfers.destinationAccountId),
    ]);
  for (const total of incomeTotals) {
    balances.set(total.accountId, (balances.get(total.accountId) ?? BigInt(0)) + BigInt(total.amountMinor ?? "0"));
  }
  for (const total of expenseTotals) {
    balances.set(total.accountId, (balances.get(total.accountId) ?? BigInt(0)) - BigInt(total.amountMinor ?? "0"));
  }
  for (const total of transferOutTotals) {
    balances.set(total.accountId, (balances.get(total.accountId) ?? BigInt(0)) - BigInt(total.amountMinor ?? "0"));
  }
  for (const total of transferInTotals) {
    balances.set(total.accountId, (balances.get(total.accountId) ?? BigInt(0)) + BigInt(total.amountMinor ?? "0"));
  }
  for (const { loan_payments: payment } of payments) {
    const openingDate = openingDatesByAccount.get(payment.sourceAccountId);
    if (openingDate && payment.paidOn >= openingDate) {
      balances.set(
        payment.sourceAccountId,
        (balances.get(payment.sourceAccountId) ?? BigInt(0)) - payment.amountMinor,
      );
    }
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const ratesByLoan = new Map<string, typeof rates>();
  const paymentsByLoan = new Map<string, typeof payments>();
  for (const joinedRate of rates) {
    const existing = ratesByLoan.get(joinedRate.loan_rates.loanId) ?? [];
    ratesByLoan.set(joinedRate.loan_rates.loanId, [...existing, joinedRate]);
  }
  for (const joinedPayment of payments) {
    const existing = paymentsByLoan.get(joinedPayment.loan_payments.loanId) ?? [];
    paymentsByLoan.set(joinedPayment.loan_payments.loanId, [...existing, joinedPayment]);
  }

  return (
    <>
      <Link
        href={`/households/${householdId}`}
        className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
      >
        ← Tillbaka till {household.name}
      </Link>
      <p className="mt-6 text-sm font-semibold text-[var(--accent)]">HUSHÅLLSEKONOMI</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{household.name}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Belopp anges i SEK och sparas i hela ören. Alla hushållsmedlemmar kan
        registrera och hantera dessa uppgifter. Lånets saldo utgår från skulden
        när det registrerades och de betalningar som registrerats här.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Konton</h2>
        {accounts.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <li key={account.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
                <p className="text-sm text-[var(--muted)]">{accountTypeName(account.type)}</p>
                <h3 className="mt-1 font-semibold">{account.name}</h3>
                <p className="mt-3 text-2xl font-semibold">
                  {formatMinorAsMoney(balances.get(account.id) ?? BigInt(0))} kr
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Skapa ett konto för att komma igång.</p>
        )}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <FinancialAccountForm householdId={householdId} today={today} />
        <FinanceCategoryForm householdId={householdId} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Registrering</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Överföringar och låneamorteringar hanteras separat från vanliga inkomster och utgifter.
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <FinanceTransactionForm
            householdId={householdId}
            today={today}
            accounts={accounts.map(({ id, name }) => ({ id, name }))}
            categories={categories.map(({ id, name, type }) => ({ id, name, type }))}
          />
          <FinanceTransferForm
            householdId={householdId}
            today={today}
            accounts={accounts.map(({ id, name }) => ({ id, name }))}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Senaste transaktioner</h2>
        {transactions.length ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="p-4 font-medium">Datum</th>
                  <th className="p-4 font-medium">Beskrivning</th>
                  <th className="p-4 font-medium">Konto / kategori</th>
                  <th className="p-4 text-right font-medium">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {transactions.map((transaction) => {
                  const category = categoriesById.get(transaction.categoryId);
                  return (
                    <tr key={transaction.id}>
                      <td className="p-4">{transaction.occurredOn}</td>
                      <td className="p-4">{transaction.description}</td>
                      <td className="p-4">
                        {accountsById.get(transaction.accountId)?.name ?? "Arkiverat konto"}
                        {category ? ` · ${category.name}` : ""}
                      </td>
                      <td className={`p-4 text-right font-medium ${transaction.type === "income" ? "text-[var(--accent)]" : ""}`}>
                        {transaction.type === "expense" ? "−" : "+"}
                        {formatMinorAsMoney(transaction.amountMinor)} kr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Inga transaktioner registrerade ännu.</p>
        )}
        {transfers.length > 0 && (
          <div className="mt-5">
            <h3 className="font-semibold">Senaste överföringar</h3>
            <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {transfers.map((transfer) => (
                <li key={transfer.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                  <span>{transfer.occurredOn} · {transfer.description} · {accountsById.get(transfer.sourceAccountId)?.name} → {accountsById.get(transfer.destinationAccountId)?.name}</span>
                  <span className="font-medium">{formatMinorAsMoney(transfer.amountMinor)} kr</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Lån</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ränta räknas med faktiska dagar / 365 och avrundas till ören per betalning.
              Beräknade betalningar är uppskattningar och kan avvika från långivarens villkor.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-5">
          {householdLoans.map((loan) => {
            const loanRateRows = ratesByLoan.get(loan.id) ?? [];
            const loanPaymentRows = paymentsByLoan.get(loan.id) ?? [];
            const currentRate = loanRateRows.at(-1)?.loan_rates;
            const principalPaid = loanPaymentRows.reduce(
              (sum, payment) => sum + payment.loan_payments.principalMinor,
              BigInt(0),
            );
            const balance = loan.startingPrincipalMinor - principalPaid;
            const currentProjection = currentRate && balance > BigInt(0)
              ? projectLoanAtRate({
                  principalMinor: balance,
                  annualRateBps: currentRate.annualRateBps,
                  fromDate: today,
                  paymentDay: loan.paymentDay,
                  remainingMonths: remainingTermMonths(loan.termMonths, loan.startDate, loan.paymentDay, today),
                  repaymentMethod: loan.repaymentMethod,
                }).recalculated
              : undefined;
            return (
              <article key={loan.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{loan.name}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {loan.repaymentMethod === "annuity" ? "Annuitetslån" : "Rak amortering"}
                      {" · "}{loan.termMonths} månader från registrering
                      {" · "}betalningsdag {loan.paymentDay}
                    </p>
                    <p className="mt-2 text-sm">
                      Ränta: {currentRate ? formatRate(currentRate.annualRateBps) : "saknas"}
                    </p>
                    {currentProjection && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Beräknad första betalning vid nuvarande ränta: {formatMinorAsMoney(currentProjection.monthlyPaymentMinor)} kr
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--muted)]">Kvarvarande skuld</p>
                    <p className="text-2xl font-semibold">{formatMinorAsMoney(balance)} kr</p>
                  </div>
                </div>
                {loanRateRows.length > 0 && (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-medium">Räntehistorik</summary>
                    <ul className="mt-2 space-y-1 text-[var(--muted)]">
                      {loanRateRows.map(({ loan_rates: rate }) => (
                        <li key={rate.id}>
                          {rate.effectiveOn}: {formatRate(rate.annualRateBps)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {loanPaymentRows.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium">Registrerade betalningar ({loanPaymentRows.length})</summary>
                    <ul className="mt-2 space-y-1 text-[var(--muted)]">
                      {loanPaymentRows.map(({ loan_payments: payment }) => (
                        <li key={payment.id}>
                          {payment.paidOn}: {formatMinorAsMoney(payment.amountMinor)} kr
                          {" · "}ränta {formatMinorAsMoney(payment.interestMinor)} kr
                          {" · "}amortering {formatMinorAsMoney(payment.principalMinor)} kr
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {balance > BigInt(0) && (
                  <LoanManagementForms
                    householdId={householdId}
                    loanId={loan.id}
                    accounts={accounts.map(({ id, name }) => ({ id, name }))}
                    today={today}
                  />
                )}
              </article>
            );
          })}
          {!householdLoans.length && (
            <p className="text-sm text-[var(--muted)]">Inga lån registrerade ännu.</p>
          )}
        </div>
        <div className="mt-5">
          <LoanForm householdId={householdId} />
        </div>
      </section>
    </>
  );
}
