"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addHouseholdMemberAction,
  createHouseholdAction,
  deleteHouseholdAction,
  removeHouseholdMemberAction,
  type FormState,
} from "@/app/(protected)/actions";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 text-sm text-[var(--accent)]">{state.success}</p>;
  return null;
}

export function CreateHouseholdForm() {
  const [state, action, pending] = useActionState(createHouseholdAction, {});

  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">Skapa hushåll</h2>
      <label className="mt-4 block text-sm font-medium">
        Hushållets namn
        <input
          required
          name="name"
          maxLength={100}
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Skapar…" : "Skapa hushåll"}
      </button>
    </form>
  );
}

export function AddHouseholdMemberForm({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(addHouseholdMemberAction, {});
  return (
    <form action={action} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">Lägg till medlem</h2>
      <input type="hidden" name="householdId" value={householdId} />
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Personen måste redan ha ett konto. Nya användare bjuds in via systemadministrationen.
      </p>
      <label className="mt-4 block text-sm font-medium">
        E-postadress
        <input
          required
          type="email"
          name="email"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Lägger till…" : "Lägg till medlem"}
      </button>
    </form>
  );
}

export function RemoveHouseholdMemberForm({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}) {
  const [state, action, pending] = useActionState(removeHouseholdMemberAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        disabled={pending}
        className="text-sm font-medium text-red-700 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-300"
      >
        {pending ? "Tar bort…" : "Ta bort"}
      </button>
      {state.error && <p role="alert" className="mt-2 max-w-48 text-xs text-red-700 dark:text-red-300">{state.error}</p>}
    </form>
  );
}

export function DeleteHouseholdForm({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const [state, action, pending] = useActionState(deleteHouseholdAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.replace("/households");
  }, [router, state.success]);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Ta bort hushållet "${householdName}" permanent? Alla medlemskap i hushållet tas också bort. Användarkonton påverkas inte.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="mt-8 rounded-2xl border border-red-300 bg-[var(--surface)] p-6 dark:border-red-900"
    >
      <h2 className="text-lg font-semibold">Ta bort hushåll</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Hushållet och dess medlemskap tas bort permanent. Användarkonton påverkas inte.
      </p>
      <input type="hidden" name="householdId" value={householdId} />
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-4 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-red-800"
      >
        {pending ? "Tar bort…" : "Ta bort hushåll"}
      </button>
    </form>
  );
}
