"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await authClient.signIn.email({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      callbackURL: "/dashboard",
    });
    setPending(false);
    if (result.error) {
      setError("Inloggningen misslyckades. Kontrollera uppgifterna och försök igen.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <form
      action={(formData) => void submit(formData)}
      className="mt-8 space-y-5"
      aria-describedby={error ? "login-error" : undefined}
    >
      <label className="block text-sm font-medium">
        E-postadress
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
      </label>
      <label className="block text-sm font-medium">
        Lösenord
        <input
          required
          type="password"
          name="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 py-3"
        />
      </label>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
