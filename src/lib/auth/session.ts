import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertDatabaseConfigured } from "@/db";
import { auth } from "@/lib/auth";
import {
  canAccessProtectedPage,
  canManageSystemUsers,
} from "@/lib/auth/policy";

export async function getOptionalSession() {
  const requestHeaders = await headers();
  assertDatabaseConfigured();
  return auth.api.getSession({ headers: requestHeaders });
}

export async function requireSession() {
  const session = await getOptionalSession();
  if (!canAccessProtectedPage(session)) redirect("/login");
  return session;
}

export async function requireSystemAdmin() {
  const session = await requireSession();
  if (!canManageSystemUsers(session.user.role)) redirect("/dashboard");
  return session;
}
