import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { assertDatabaseConfigured, db } from "@/db";
import { invitations } from "@/db/schema";
import { hashInvitationToken } from "@/lib/invitations";
import { invitationTokenSchema, uuidSchema } from "@/lib/validation";
import { AcceptInvitationForm } from "./form";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  assertDatabaseConfigured();
  const token = typeof search.token === "string" ? search.token : "";
  const [invitation] =
    uuidSchema.safeParse(id).success &&
    invitationTokenSchema.safeParse(token).success
    ? await db
        .select({ email: invitations.email, name: invitations.name })
        .from(invitations)
        .where(
          and(
            eq(invitations.id, id),
            eq(invitations.tokenHash, hashInvitationToken(token)),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .limit(1)
    : [];

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold tracking-wide text-[var(--accent)]">
          BUDGETVERKTYG
        </Link>
        {invitation ? (
          <>
            <h1 className="mt-8 text-3xl font-semibold">Slutför din inbjudan</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Skapa ett lösenord för {invitation.email}.
            </p>
            <AcceptInvitationForm
              invitationId={id}
              token={token}
              name={invitation.name}
              email={invitation.email}
            />
          </>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-semibold">Länken är inte giltig</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Den kan ha gått ut eller redan använts. Kontakta administratören
              för en ny inbjudan.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
