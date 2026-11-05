import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/server";
import { householdMemberships } from "@/db/schema";

export async function isHouseholdMember(userId: string, householdId: string) {
  const [membership] = await db
    .select({ id: householdMemberships.id })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.userId, userId),
        eq(householdMemberships.householdId, householdId),
      ),
    )
    .limit(1);
  return Boolean(membership);
}
