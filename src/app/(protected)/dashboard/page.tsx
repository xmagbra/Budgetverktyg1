import Link from "next/link";

export default function DashboardPage() {
  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">DIN ÖVERSIKT</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Välkommen till Budgetverktyg</h1>
      <section
        aria-labelledby="finance-ready"
        className="mt-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 md:p-10"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--background)] text-xl" aria-hidden="true">
          kr
        </div>
        <h2 id="finance-ready" className="mt-6 text-xl font-semibold">
          Hushållsekonomi
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
          Konton, kategorier, transaktioner, överföringar och lån hanteras inne i
          hushållet. Öppna ett hushåll för att komma igång.
        </p>
        <Link
          href="/households"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
        >
          Visa hushåll
        </Link>
      </section>
    </>
  );
}
