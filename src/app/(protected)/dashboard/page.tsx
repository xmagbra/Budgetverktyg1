export default function DashboardPage() {
  return (
    <>
      <p className="text-sm font-semibold text-[var(--accent)]">DIN ÖVERSIKT</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Välkommen till Budgetverktyg</h1>
      <section
        aria-labelledby="coming-soon"
        className="mt-8 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 md:p-10"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--background)] text-xl" aria-hidden="true">
          ◷
        </div>
        <h2 id="coming-soon" className="mt-6 text-xl font-semibold">
          Ekonomiska funktioner är under utveckling
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
          Grundsystemet för inloggning och hushåll är på plats. När nästa etapp är
          klar kan du börja registrera konton och transaktioner. Inga ekonomiska
          uppgifter samlas in ännu.
        </p>
      </section>
    </>
  );
}
