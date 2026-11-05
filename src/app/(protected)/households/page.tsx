import Link from "next/link";
import { eq } from "drizzle-orm";
import { CreateHouseholdForm } from "@/components/household-forms";
import { db } from "@/db";
import { householdMemberships, households } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

export default async function HouseholdsPage() {
  const { user } = await requireSession();
  const memberships = await db
    .select({
      id: households.id,
      name: households.name,
      role: householdMemberships.role,
    })
    .from(householdMemberships)
    .innerJoin(households, eq(householdMemberships.householdId, households.id))
    .where(eq(householdMemberships.userId, user.id));

  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">DELADE SAMMANSTÄLLNINGAR</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hushåll</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Endast hushåll du tillhör visas här. Ekonomiska uppgifter delas med
        medlemmarna i respektive hushåll.
      </p>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Dina hushåll</h2>
          {memberships.length ? (
            <ul className="mt-4 divide-y divide-[var(--line)]">
              {memberships.map((household) => (
                <li key={household.id} className="py-4 first:pt-0 last:pb-0">
                  <Link
                    className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                    href={`/households/${household.id}`}
                  >
                    {household.name}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {household.role === "household_admin" ? "Hushållsadministratör" : "Medlem"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Du tillhör ännu inget hushåll.
            </p>
          )}
        </div>
        <CreateHouseholdForm />
      </section>
    </>
  );
}
