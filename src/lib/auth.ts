import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, createAccessControl } from "better-auth/plugins";
import { db } from "@/db";

const adminAc = createAccessControl({
  user: ["create", "list", "set-role", "ban", "impersonate", "delete", "get"],
  session: ["list", "revoke", "delete"],
} as const);

const adminRole = adminAc.newRole({
  user: [],
  session: [],
});

const regularRole = adminAc.newRole({
  user: [],
  session: [],
});

const secret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !secret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const auth = betterAuth({
  appName: "Budgetverktyg",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: secret ?? "development-only-secret-change-before-deploy-00000000",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
  },
  user: {
    deleteUser: { enabled: false },
  },
  plugins: [
    admin({
      ac: adminAc,
      defaultRole: "user",
      adminRoles: ["admin"],
      roles: {
        admin: adminRole,
        user: regularRole,
      },
      bannedUserMessage: "Kontot är inaktiverat. Kontakta systemadministratören.",
    }),
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});
