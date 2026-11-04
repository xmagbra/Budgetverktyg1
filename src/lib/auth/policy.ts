export type HouseholdRole = "household_admin" | "member";

export function canAccessProtectedPage<T>(session: T | null | undefined): session is T {
  return session !== null && session !== undefined;
}

export function canManageSystemUsers(systemRole: string | null | undefined) {
  return systemRole === "admin";
}

export function canManageHousehold(
  systemRole: string | null | undefined,
  membershipRole: HouseholdRole | null | undefined,
) {
  return systemRole === "admin" || membershipRole === "household_admin";
}

export function canViewHousehold(
  systemRole: string | null | undefined,
  membershipRole: HouseholdRole | null | undefined,
) {
  return systemRole === "admin" || membershipRole !== undefined && membershipRole !== null;
}
