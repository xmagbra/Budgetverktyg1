import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getOptionalSession()) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold tracking-wide text-[var(--accent)]">
          BUDGETVERKTYG
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Välkommen tillbaka</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Logga in med kontot du fått av administratören.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
