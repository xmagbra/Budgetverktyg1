import { describe, expect, it } from "vitest";
import {
  canAccessProtectedPage,
  canManageHousehold,
  canManageSystemUsers,
  canViewHousehold,
} from "./policy";

describe("server authorization policies", () => {
  it("requires a session for protected pages", () => {
    expect(canAccessProtectedPage(null)).toBe(false);
    expect(canAccessProtectedPage(undefined)).toBe(false);
    expect(canAccessProtectedPage({ userId: "authenticated-user" })).toBe(true);
  });

  it("does not grant system administration to household administrators", () => {
    expect(canManageSystemUsers("admin")).toBe(true);
    expect(canManageSystemUsers("user")).toBe(false);
    expect(canManageSystemUsers("household_admin")).toBe(false);
    expect(canManageSystemUsers(undefined)).toBe(false);
  });

  it("restricts household views to its members or system administrators", () => {
    expect(canViewHousehold("user", "member")).toBe(true);
    expect(canViewHousehold("user", "household_admin")).toBe(true);
    expect(canViewHousehold("user", undefined)).toBe(false);
    expect(canViewHousehold("admin", undefined)).toBe(true);
  });

  it("allows household management only for household or system administrators", () => {
    expect(canManageHousehold("user", "member")).toBe(false);
    expect(canManageHousehold("user", "household_admin")).toBe(true);
    expect(canManageHousehold("admin", undefined)).toBe(true);
    expect(canManageHousehold(undefined, undefined)).toBe(false);
  });
});
