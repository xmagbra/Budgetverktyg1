import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { requireSession } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen md:flex">
      <AppNavigation
        name={session.user.name}
        email={session.user.email}
        role={session.user.role ?? "user"}
      />
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
