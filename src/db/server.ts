import "server-only";

// Keep the core connection usable by the administrative Auth CLI.
// Application modules use this entry point to prevent client imports.
export { db, assertDatabaseConfigured, writeAuditLog } from "./index";
