import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://build:build@localhost/build";
const client = neon(databaseUrl);

export const db = drizzle({ client, schema });

export function assertDatabaseConfigured() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. See .env.example.");
  }
}

export async function writeAuditLog(input: {
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string>;
}) {
  await db.insert(schema.auditLogs).values({
    ...input,
    metadata: input.metadata ?? {},
  });
}
