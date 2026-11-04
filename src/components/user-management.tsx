"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createInvitationAction,
  setUserDisabledAction,
  setUserRoleAction,
} from "@/app/(protected)/admin/actions";
import type { FormState } from "@/app/(protected)/actions";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>;
  if (state.success && !state.success.startsWith("http")) {
    return <p role="status" className="mt-3 text-sm text-[var(--accent)]">{state.success}</p>;
  }
  return null;
}

function useRefreshOnSuccess(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.success && !state.success.startsWith("http")) router.refresh();
  }, [router, state.success]);
}

export function UserInvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, {});

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">
        Namn
        <input required name="name" maxLength={100} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3" />
      </label>
      <label className="text-sm font-medium">
        E-postadress
        <input required type="email" name="email" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3" />
      </label>
      <div className="sm:col-span-2">
        <Feedback state={state} />
        {state.success?.startsWith("http") && (
          <div className="mt-3 rounded-xl bg-[var(--background)] p-4">
            <p className="text-sm font-medium">Engångslänk – kopiera och skicka säkert</p>
            <input
              readOnly
              aria-label="Inbjudningslänk"
              value={state.success}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Giltig i 7 dagar. Den här länken visas endast nu.
            </p>
          </div>
        )}
        <button disabled={pending} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Skapar inbjudan…" : "Skapa inbjudan"}
        </button>
      </div>
    </form>
  );
}

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean | null;
};

export function UserManagementRow({ user }: { user: UserItem }) {
  const [roleState, roleAction, rolePending] = useActionState(setUserRoleAction, {});
  const [disabledState, disabledAction, disabledPending] = useActionState(setUserDisabledAction, {});
  useRefreshOnSuccess(roleState);
  useRefreshOnSuccess(disabledState);
  const disabled = Boolean(user.banned);

  return (
    <article className="rounded-xl border border-[var(--line)] p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {disabled ? "Inaktiverat" : "Aktivt"} · {user.role === "admin" ? "Systemadministratör" : "Användare"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <label className="sr-only" htmlFor={`role-${user.id}`}>Roll för {user.name}</label>
            <select
              id={`role-${user.id}`}
              name="role"
              defaultValue={user.role === "admin" ? "admin" : "user"}
              className="rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="user">Användare</option>
              <option value="admin">Systemadmin</option>
            </select>
            <button disabled={rolePending} className="text-sm font-medium text-[var(--accent)] disabled:opacity-60">
              Spara
            </button>
          </form>
          <form action={disabledAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="disabled" value={String(!disabled)} />
            <button disabled={disabledPending} className="text-sm font-medium text-red-700 underline-offset-4 hover:underline disabled:opacity-60 dark:text-red-300">
              {disabledPending ? "Sparar…" : disabled ? "Aktivera" : "Inaktivera"}
            </button>
          </form>
        </div>
      </div>
      <Feedback state={roleState} />
      <Feedback state={disabledState} />
    </article>
  );
}
