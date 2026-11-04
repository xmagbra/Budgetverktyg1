import Link from "next/link";
import { desc } from "drizzle-orm";
import {
  UserInvitationForm,
  UserManagementRow,
} from "@/components/user-management";
import { db } from "@/db";
import { households, user } from "@/db/schema";
import { requireSystemAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  await requireSystemAdmin();
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
    })
    .from(user)
    .orderBy(desc(user.createdAt));
  const allHouseholds = await db
    .select({
      id: households.id,
      name: households.name,
      createdAt: households.createdAt,
    })
    .from(households)
    .orderBy(desc(households.createdAt));

  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">SYSTEM</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Administration</h1>
      <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Bjud in användare</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Skapa en tidsbegränsad engångslänk. Skicka länken till personen via en
          säker kanal; den visas inte igen efter att sidan lämnas.
        </p>
        <UserInvitationForm />
      </section>
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Användare</h2>
        <div className="mt-4 space-y-3">
          {users.map((item) => (
            <UserManagementRow key={item.id} user={item} />
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Hushåll</h2>
        {allHouseholds.length ? (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {allHouseholds.map((household) => (
              <li key={household.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                <Link
                  href={`/households/${household.id}`}
                  className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  {household.name}
                </Link>
                <time className="text-sm text-[var(--muted)]">
                  {new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(household.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Inga hushåll ännu.</p>
        )}
      </section>
      <p className="mt-6 text-sm text-[var(--muted)]">
        Systemadministration omfattar endast användarkonton och hushållsmetadata.
        Inga ekonomiska uppgifter visas här.
      </p>
    </>
  );
}
