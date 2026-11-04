import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";

export default async function IndexPage() {
  const session = await getOptionalSession();
  redirect(session ? "/dashboard" : "/login");
}
