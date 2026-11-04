import { requireSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const { user } = await requireSession();

  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">KONTO</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Inställningar</h1>
      <section className="mt-8 max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Profil</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Namn</dt>
            <dd className="mt-1 font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">E-postadress</dt>
            <dd className="mt-1 font-medium">{user.email}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Profiländringar och lösenordsbyte läggs till i en senare version.
        </p>
      </section>
    </>
  );
}
