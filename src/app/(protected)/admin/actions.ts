"use server";

import { and, count, eq, gt, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireSystemAdmin } from "@/lib/auth/session";
import { db, writeAuditLog } from "@/db";
import { invitations, session, user } from "@/db/schema";
import { createInvitationToken, hashInvitationToken } from "@/lib/invitations";
import {
  invitationTokenSchema,
  invitationSchema,
  passwordSchema,
  uuidSchema,
} from "@/lib/validation";
import type { FormState } from "@/app/(protected)/actions";

export async function createInvitationAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user: actor } = await requireSystemAdmin();
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const email = parsed.data.email.toLowerCase();

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existingUser) return { error: "Det finns redan ett konto med den e-postadressen." };

  const now = new Date();
  const [existingInvitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .limit(1);
  if (existingInvitation) return { error: "Det finns redan en aktiv inbjudan till adressen." };

  const token = createInvitationToken();
  const invitationId = crypto.randomUUID();
  await db.insert(invitations).values({
    id: invitationId,
    email,
    name: parsed.data.name,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
    createdBy: actor.id,
  });
  await writeAuditLog({
    actorId: actor.id,
    eventType: "user.invitation_created",
    entityType: "invitation",
    entityId: invitationId,
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return {
    success: `${baseUrl}/invite/${invitationId}?token=${encodeURIComponent(token)}`,
  };
}

export async function setUserRoleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSystemAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !["user", "admin"].includes(role)) {
    return { error: "Ogiltig användare eller roll." };
  }

  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!target) return { error: "Användaren kunde inte hittas." };
  if (target.role === "admin" && role !== "admin") {
    const [adminCount] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.role, "admin"));
    if ((adminCount?.value ?? 0) <= 1) {
      return { error: "Den sista systemadministratören kan inte tas bort." };
    }
  }

  await db.update(user).set({ role }).where(eq(user.id, userId));
  await writeAuditLog({
    actorId: actor.user.id,
    eventType: "user.role_changed",
    entityType: "user",
    entityId: userId,
    metadata: { role },
  });
  return { success: "Användarrollen har uppdaterats." };
}

export async function setUserDisabledAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireSystemAdmin();
  const userId = String(formData.get("userId") ?? "");
  const disabled = String(formData.get("disabled") ?? "") === "true";
  if (!userId || userId === actor.user.id && disabled) {
    return { error: "Du kan inte inaktivera ditt eget konto." };
  }

  const [target] = await db
    .select({ role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!target) return { error: "Användaren kunde inte hittas." };
  if (disabled && target.role === "admin") {
    const [adminCount] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.role, "admin"));
    if ((adminCount?.value ?? 0) <= 1) {
      return { error: "Den sista systemadministratören kan inte inaktiveras." };
    }
  }

  if (disabled && !target.banned) {
    const ban = db
      .update(user)
      .set({
        banned: true,
        banReason: "Inaktiverat av systemadministratör",
        banExpires: null,
      })
      .where(eq(user.id, userId));
    const revokeSessions = db.delete(session).where(eq(session.userId, userId));
    await db.batch([ban, revokeSessions]);
  } else if (!disabled && target.banned) {
    await db
      .update(user)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(user.id, userId));
  }
  await writeAuditLog({
    actorId: actor.user.id,
    eventType: disabled ? "user.disabled" : "user.enabled",
    entityType: "user",
    entityId: userId,
  });
  return { success: disabled ? "Kontot har inaktiverats." : "Kontot har aktiverats." };
}

export async function acceptInvitationAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const invitationId = String(formData.get("invitationId") ?? "");
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (
    !uuidSchema.safeParse(invitationId).success ||
    !invitationTokenSchema.safeParse(token).success
  ) {
    return { error: "Inbjudningslänken är ogiltig." };
  }

  const credentials = invitationSchema.safeParse({ name, email });
  const validPassword = passwordSchema.safeParse(password);
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (!credentials.success || !validPassword.success) {
    return {
      error:
        validPassword.error?.issues[0]?.message ??
        credentials.error?.issues[0]?.message ??
        "Kontrollera uppgifterna.",
    };
  }
  if (password !== confirmation) {
    return { error: "Lösenorden matchar inte." };
  }

  const tokenHash = hashInvitationToken(token);
  const [invitation] = await db
    .select({ email: invitations.email, name: invitations.name })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!invitation || invitation.email !== credentials.data.email.toLowerCase()) {
    return { error: "Inbjudan saknas, har gått ut eller redan använts." };
  }

  const result = await auth.api.createUser({
    body: {
      email: invitation.email,
      name: invitation.name,
      password: validPassword.data,
      role: "user",
    },
  });
  if (!result || "error" in result) {
    return { error: "Kontot kunde inte skapas. Kontakta administratören." };
  }

  const accepted = await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.tokenHash, tokenHash),
        isNull(invitations.acceptedAt),
      ),
    )
    .returning({ id: invitations.id });
  if (!accepted.length) {
    return { error: "Inbjudan kunde inte slutföras. Kontakta administratören." };
  }
  const [createdUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, invitation.email))
    .limit(1);
  if (createdUser) {
    await writeAuditLog({
      actorId: createdUser.id,
      eventType: "user.invitation_accepted",
      entityType: "user",
      entityId: createdUser.id,
    });
  }

  return { success: "Kontot är skapat. Du kan nu logga in." };
}
