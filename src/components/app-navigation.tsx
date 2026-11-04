"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

const links = [
  { href: "/dashboard", label: "Översikt" },
  { href: "/households", label: "Hushåll" },
  { href: "/settings", label: "Inställningar" },
];

export function AppNavigation({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function signOut() {
    setPending(true);
    setError("");
    const result = await authClient.signOut();
    setPending(false);
    if (result.error) {
      setError("Utloggningen misslyckades. Försök igen.");
      return;
    }
    router.replace("/login");
  }

  return (
    <aside className="border-b border-[var(--line)] bg-[var(--surface)] p-5 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r md:p-6">
      <Link href="/dashboard" className="text-sm font-bold tracking-widest text-[var(--accent)]">
        BUDGETVERKTYG
      </Link>
      <nav aria-label="Huvudmeny" className="mt-7 flex gap-2 overflow-x-auto md:flex-col">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            {link.label}
          </Link>
        ))}
        {role === "admin" && (
          <Link
            href="/admin"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            Administration
          </Link>
        )}
      </nav>
      <div className="mt-8 border-t border-[var(--line)] pt-5 md:mt-auto">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{email}</p>
        <button
          disabled={pending}
          onClick={() => void signOut()}
          className="mt-4 text-sm font-medium text-[var(--accent)] disabled:opacity-60"
        >
          {pending ? "Loggar ut…" : "Logga ut"}
        </button>
        {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      </div>
    </aside>
  );
}
