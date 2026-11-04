import { toNextJsHandler } from "better-auth/next-js";
import { assertDatabaseConfigured } from "@/db";
import { auth } from "@/lib/auth";

const handler = (request: Request) => {
  assertDatabaseConfigured();
  return toNextJsHandler(auth).GET(request);
};

export { handler as GET };
export async function POST(request: Request) {
  assertDatabaseConfigured();
  return toNextJsHandler(auth).POST(request);
}
