import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  AddHouseholdMemberForm,
  DeleteHouseholdForm,
  RemoveHouseholdMemberForm,
} from "@/components/household-forms";
import { db } from "@/db";
import { householdMemberships, households, user } from "@/db/schema";
import { canManageHousehold, canViewHousehold } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation";

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user: currentUser } = await requireSession();
  if (!uuidSchema.safeParse(id).success) notFound();
  const [household] = await db
    .select({ id: households.id, name: households.name })
    .from(households)
    .where(eq(households.id, id))
    .limit(1);
  if (!household) notFound();

  const [currentMembership] = await db
    .select({ role: householdMemberships.role })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, id),
        eq(householdMemberships.userId, currentUser.id),
      ),
    )
    .limit(1);
  if (!canViewHousehold(currentUser.role, currentMembership?.role)) notFound();

  const members = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: householdMemberships.role,
    })
    .from(householdMemberships)
    .innerJoin(user, eq(householdMemberships.userId, user.id))
    .where(eq(householdMemberships.householdId, id));

  const canManage = canManageHousehold(currentUser.role, currentMembership?.role);

  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">HUSHÅLL</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{household.name}</h1>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Medlemmar</h2>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{member.email}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {member.role === "household_admin" ? "Hushållsadministratör" : "Medlem"}
                  </p>
                </div>
                {canManage && member.userId !== currentUser.id && (
                  <RemoveHouseholdMemberForm
                    householdId={id}
                    userId={member.userId}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
        {canManage && <AddHouseholdMemberForm householdId={id} />}
      </section>
      {canManage && (
        <DeleteHouseholdForm householdId={id} householdName={household.name} />
      )}
    </>
  );
}
