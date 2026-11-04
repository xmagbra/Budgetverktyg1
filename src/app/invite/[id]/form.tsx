"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/(protected)/admin/actions";

export function AcceptInvitationForm({
  invitationId,
  token,
  name,
  email,
}: {
  invitationId: string;
  token: string;
  name: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(acceptInvitationAction, {});
  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <label className="block text-sm font-medium">
        Lösenord
        <input
          required
          type="password"
          name="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
          Minst 12 tecken.
        </span>
      </label>
      <label className="block text-sm font-medium">
        Bekräfta lösenord
        <input
          required
          type="password"
          name="passwordConfirmation"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      {state.success ? (
        <div role="status" className="space-y-3">
          <p className="text-sm text-[var(--accent)]">{state.success}</p>
          <Link href="/login" className="inline-block rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">
            Gå till inloggning
          </Link>
        </div>
      ) : (
        <button disabled={pending} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-60">
          {pending ? "Skapar konto…" : "Skapa konto"}
        </button>
      )}
    </form>
  );
}
