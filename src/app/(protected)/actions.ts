"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, writeAuditLog } from "@/db";
import { auditLogs, householdMemberships, households, user } from "@/db/schema";
import { canManageHousehold } from "@/lib/auth/policy";
import { requireSession } from "@/lib/auth/session";
import {
  emailSchema,
  householdNameSchema,
  uuidSchema,
} from "@/lib/validation";

export type FormState = { error?: string; success?: string };

export async function createHouseholdAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user: actor } = await requireSession();
  const parsed = householdNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const householdId = crypto.randomUUID();
  const household = db.insert(households).values({
    id: householdId,
    name: parsed.data,
    createdBy: actor.id,
  });
  const membership = db.insert(householdMemberships).values({
    householdId,
    userId: actor.id,
    role: "household_admin",
  });
  const audit = db.insert(auditLogs).values({
    actorId: actor.id,
    eventType: "household.created",
    entityType: "household",
    entityId: householdId,
  });
  await db.batch([household, membership, audit]);
  redirect(`/households/${householdId}`);
}

export async function addHouseholdMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user: actor } = await requireSession();
  const householdId = String(formData.get("householdId") ?? "");
  const targetEmail = emailSchema.safeParse(formData.get("email"));
  if (!uuidSchema.safeParse(householdId).success) {
    return { error: "Hushållet kunde inte hittas." };
  }
  if (!targetEmail.success) return { error: "Ange en giltig e-postadress." };

  const [actorMembership] = await db
    .select({ role: householdMemberships.role })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, actor.id),
      ),
    )
    .limit(1);
  if (!canManageHousehold(actor.role, actorMembership?.role)) {
    return { error: "Du saknar behörighet att hantera medlemmar i hushållet." };
  }

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, targetEmail.data.toLowerCase()))
    .limit(1);
  if (!target) return { error: "Ingen användare hittades med den e-postadressen." };

  const [existing] = await db
    .select({ id: householdMemberships.id })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, target.id),
      ),
    )
    .limit(1);
  if (existing) return { error: "Användaren är redan medlem i hushållet." };

  await db.insert(householdMemberships).values({
    householdId,
    userId: target.id,
    role: "member",
  });
  await writeAuditLog({
    actorId: actor.id,
    eventType: "household.member_added",
    entityType: "household",
    entityId: householdId,
    metadata: { targetUserId: target.id },
  });
  return { success: "Medlemmen har lagts till." };
}

export async function removeHouseholdMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user: actor } = await requireSession();
  const householdId = String(formData.get("householdId") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  if (!uuidSchema.safeParse(householdId).success || !targetUserId) {
    return { error: "Medlemskapet kunde inte hittas." };
  }

  const [actorMembership] = await db
    .select({ role: householdMemberships.role })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, actor.id),
      ),
    )
    .limit(1);
  if (!canManageHousehold(actor.role, actorMembership?.role)) {
    return { error: "Du saknar behörighet att hantera medlemmar i hushållet." };
  }

  const [targetMembership] = await db
    .select({ role: householdMemberships.role })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, targetUserId),
      ),
    )
    .limit(1);
  if (!targetMembership) return { error: "Medlemskapet kunde inte hittas." };
  if (targetMembership.role === "household_admin") {
    const otherAdmins = await db
      .select({ id: householdMemberships.id })
      .from(householdMemberships)
      .where(
        and(
          eq(householdMemberships.householdId, householdId),
          eq(householdMemberships.role, "household_admin"),
        ),
      );
    if (otherAdmins.length <= 1) {
      return { error: "Hushållet måste ha minst en administratör." };
    }
  }

  await db
    .delete(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, targetUserId),
      ),
    );
  await writeAuditLog({
    actorId: actor.id,
    eventType: "household.member_removed",
    entityType: "household",
    entityId: householdId,
    metadata: { targetUserId },
  });
  return { success: "Medlemmen har tagits bort från hushållet." };
}

export async function deleteHouseholdAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user: actor } = await requireSession();
  const householdId = String(formData.get("householdId") ?? "");
  if (!uuidSchema.safeParse(householdId).success) {
    return { error: "Hushållet kunde inte hittas." };
  }

  const [household] = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  if (!household) return { error: "Hushållet kunde inte hittas." };

  const [actorMembership] = await db
    .select({ role: householdMemberships.role })
    .from(householdMemberships)
    .where(
      and(
        eq(householdMemberships.householdId, householdId),
        eq(householdMemberships.userId, actor.id),
      ),
    )
    .limit(1);
  if (!canManageHousehold(actor.role, actorMembership?.role)) {
    return { error: "Du saknar behörighet att ta bort hushållet." };
  }

  const audit = db.insert(auditLogs).values({
    actorId: actor.id,
    eventType: "household.deleted",
    entityType: "household",
    entityId: householdId,
  });
  const deletion = db.delete(households).where(eq(households.id, householdId));
  await db.batch([audit, deletion]);
  return { success: "Hushållet har tagits bort." };
}
