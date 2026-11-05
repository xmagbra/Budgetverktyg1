"use client";

import { useActionState, useState } from "react";
import {
  changeLoanRateAction,
  createFinanceCategoryAction,
  createFinanceTransactionAction,
  createFinanceTransferAction,
  createFinancialAccountAction,
  createLoanAction,
  recordLoanPaymentAction,
  simulateLoanAction,
  type FinanceActionState,
} from "@/app/(protected)/households/[id]/finance/actions";
import { formatMinorAsMoney } from "@/lib/finance";

type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: "income" | "expense" };

function Feedback({ state }: { state: FinanceActionState }) {
  if (state.error) {
    return <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>;
  }
  if (state.success) {
    return <p role="status" className="mt-3 text-sm text-[var(--accent)]">{state.success}</p>;
  }
  return null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3";
const buttonClass = "mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60";

export function FinancialAccountForm({
  householdId,
  today,
}: {
  householdId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(createFinancialAccountAction, {});
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-semibold">Lägg till konto</h3>
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="Kontonamn">
        <input required name="name" maxLength={80} className={fieldClass} />
      </Field>
      <Field label="Kontotyp">
        <select name="type" className={fieldClass}>
          <option value="checking">Lönekonto / bankkonto</option>
          <option value="savings">Sparkonto</option>
          <option value="cash">Kontanter</option>
        </select>
      </Field>
      <Field label="Ingående saldo (SEK)">
        <input required name="openingBalance" inputMode="decimal" placeholder="0,00" className={fieldClass} />
      </Field>
      <Field label="Datum för ingående saldo">
        <input required type="date" name="openingBalanceOn" max={today} defaultValue={today} className={fieldClass} />
      </Field>
      <Feedback state={state} />
      <button disabled={pending} className={buttonClass}>{pending ? "Sparar…" : "Skapa konto"}</button>
    </form>
  );
}

export function FinanceCategoryForm({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(createFinanceCategoryAction, {});
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-semibold">Lägg till kategori</h3>
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="Kategorinamn">
        <input required name="name" maxLength={80} className={fieldClass} />
      </Field>
      <Field label="Typ">
        <select name="type" className={fieldClass}>
          <option value="expense">Utgift</option>
          <option value="income">Inkomst</option>
        </select>
      </Field>
      <Feedback state={state} />
      <button disabled={pending} className={buttonClass}>{pending ? "Sparar…" : "Skapa kategori"}</button>
    </form>
  );
}

export function FinanceTransactionForm({
  householdId,
  accounts,
  categories,
  today,
}: {
  householdId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createFinanceTransactionAction, {});
  const [type, setType] = useState<"income" | "expense">("expense");
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-semibold">Registrera inkomst eller utgift</h3>
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="Typ">
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value === "income" ? "income" : "expense")}
          className={fieldClass}
        >
          <option value="expense">Utgift</option>
          <option value="income">Inkomst</option>
        </select>
      </Field>
      <Field label="Belopp (SEK)">
        <input required name="amount" inputMode="decimal" placeholder="0,00" className={fieldClass} />
      </Field>
      <Field label="Konto">
        <select required name="accountId" className={fieldClass} defaultValue="">
          <option value="" disabled>Välj konto</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </Field>
      <Field label="Kategori">
        <select key={type} required name="categoryId" className={fieldClass} defaultValue="">
          <option value="" disabled>Välj kategori</option>
          {categories.filter((category) => category.type === type).map((category) => (
            <option key={category.id} value={category.id}>
              {category.type === "income" ? "Inkomst" : "Utgift"} · {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Datum">
        <input required type="date" name="occurredOn" defaultValue={today} className={fieldClass} />
      </Field>
      <Field label="Beskrivning">
        <input required name="description" maxLength={200} className={fieldClass} />
      </Field>
      <Feedback state={state} />
      <button disabled={pending || !accounts.length || !categories.length} className={buttonClass}>
        {pending ? "Sparar…" : "Registrera"}
      </button>
    </form>
  );
}

export function FinanceTransferForm({
  householdId,
  accounts,
  today,
}: {
  householdId: string;
  accounts: AccountOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createFinanceTransferAction, {});
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-semibold">Överföring mellan konton</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">Överföringar räknas inte som inkomst eller utgift.</p>
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="Från konto">
        <select required name="sourceAccountId" className={fieldClass} defaultValue="">
          <option value="" disabled>Välj konto</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </Field>
      <Field label="Till konto">
        <select required name="destinationAccountId" className={fieldClass} defaultValue="">
          <option value="" disabled>Välj konto</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </Field>
      <Field label="Belopp (SEK)">
        <input required name="amount" inputMode="decimal" placeholder="0,00" className={fieldClass} />
      </Field>
      <Field label="Datum">
        <input required type="date" name="occurredOn" defaultValue={today} className={fieldClass} />
      </Field>
      <Field label="Beskrivning">
        <input required name="description" maxLength={200} className={fieldClass} />
      </Field>
      <Feedback state={state} />
      <button disabled={pending || accounts.length < 2} className={buttonClass}>
        {pending ? "Sparar…" : "Registrera överföring"}
      </button>
    </form>
  );
}

export function LoanForm({ householdId }: {
  householdId: string;
}) {
  const [state, action, pending] = useActionState(createLoanAction, {});
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-semibold">Lägg till lån</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">Ange dagens kvarvarande skuld. Räntan gäller från registreringsdagen.</p>
      <input type="hidden" name="householdId" value={householdId} />
      <Field label="Lånenamn">
        <input required name="name" maxLength={100} className={fieldClass} />
      </Field>
      <Field label="Kvarvarande skuld (SEK)">
        <input required name="principal" inputMode="decimal" placeholder="0,00" className={fieldClass} />
      </Field>
      <Field label="Årsränta (%)">
        <input required name="annualRate" inputMode="decimal" placeholder="4,25" className={fieldClass} />
      </Field>
      <Field label="Återstående löptid (månader)">
        <input required type="number" name="termMonths" min="1" max="1200" defaultValue="120" className={fieldClass} />
      </Field>
      <Field label="Betalningsdag varje månad (1–28)">
        <input required type="number" name="paymentDay" min="1" max="28" defaultValue="28" className={fieldClass} />
      </Field>
      <Field label="Amorteringsmetod">
        <select name="repaymentMethod" className={fieldClass}>
          <option value="annuity">Annuitetslån</option>
          <option value="linear">Rak amortering</option>
        </select>
      </Field>
      <Feedback state={state} />
      <button disabled={pending} className={buttonClass}>{pending ? "Sparar…" : "Skapa lån"}</button>
    </form>
  );
}

export function LoanManagementForms({
  householdId,
  loanId,
  accounts,
  today,
}: {
  householdId: string;
  loanId: string;
  accounts: AccountOption[];
  today: string;
}) {
  const [rateState, rateAction, ratePending] = useActionState(changeLoanRateAction, {});
  const [paymentState, paymentAction, paymentPending] = useActionState(recordLoanPaymentAction, {});
  const [simulationState, simulationAction, simulationPending] = useActionState(simulateLoanAction, {});

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <form action={rateAction} className="rounded-xl border border-[var(--line)] p-4">
        <h4 className="font-semibold">Ändra dagens ränta</h4>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="loanId" value={loanId} />
        <Field label="Ny årsränta (%)">
          <input required name="annualRate" inputMode="decimal" placeholder="4,25" className={fieldClass} />
        </Field>
        <Feedback state={rateState} />
        <button disabled={ratePending} className={buttonClass}>{ratePending ? "Sparar…" : "Uppdatera ränta"}</button>
      </form>

      <form action={paymentAction} className="rounded-xl border border-[var(--line)] p-4">
        <h4 className="font-semibold">Registrera betalning</h4>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="loanId" value={loanId} />
        <Field label="Betalningskonto">
          <select required name="sourceAccountId" className={fieldClass} defaultValue="">
            <option value="" disabled>Välj konto</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </Field>
        <Field label="Total betald summa (SEK)">
          <input required name="amount" inputMode="decimal" placeholder="0,00" className={fieldClass} />
        </Field>
        <Field label="Betalningsdatum">
          <input required type="date" name="paidOn" defaultValue={today} className={fieldClass} />
        </Field>
        <Feedback state={paymentState} />
        <button disabled={paymentPending || !accounts.length} className={buttonClass}>
          {paymentPending ? "Sparar…" : "Registrera betalning"}
        </button>
      </form>

      <form action={simulationAction} className="rounded-xl border border-[var(--line)] p-4">
        <h4 className="font-semibold">Simulera ränta</h4>
        <p className="mt-2 text-sm text-[var(--muted)]">Prova en ränta från idag. Prognosen inkluderar inte obetald ränta före idag. Detta ändrar inte lånet.</p>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="loanId" value={loanId} />
        <Field label="Simulerad årsränta (%)">
          <input required name="annualRate" inputMode="decimal" placeholder="5,00" className={fieldClass} />
        </Field>
        <Feedback state={simulationState} />
        <button disabled={simulationPending} className={buttonClass}>
          {simulationPending ? "Räknar…" : "Visa simulering"}
        </button>
        {simulationState.simulation && (
          <div className="mt-4 space-y-3 text-sm" role="status">
            <p className="font-semibold">Behåll slutdatumet</p>
            <p>
              Månadsbetalning: {formatMinorAsMoney(BigInt(simulationState.simulation.recalculated.paymentMinor))} kr
              {" · "}räntekostnad: {formatMinorAsMoney(BigInt(simulationState.simulation.recalculated.totalInterestMinor))} kr
            </p>
            <p className="font-semibold">Behåll nuvarande betalningsbelopp</p>
            <p>
              Betalning: {formatMinorAsMoney(BigInt(simulationState.simulation.fixedPayment.paymentMinor))} kr
              {" · "}löptid: {simulationState.simulation.fixedPayment.payoffMonths ?? "Betalar inte av"} mån
              {" · "}räntekostnad: {formatMinorAsMoney(BigInt(simulationState.simulation.fixedPayment.totalInterestMinor))} kr
            </p>
            {simulationState.simulation.fixedPayment.payoffMonths === null && (
              <p>Kvar efter 100 år: {formatMinorAsMoney(BigInt(simulationState.simulation.fixedPayment.remainingBalanceMinor))} kr</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
