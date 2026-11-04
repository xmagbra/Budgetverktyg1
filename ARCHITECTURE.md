# Arkitektur

## Översikt

En sammanhållen Next.js App Router-applikation kör UI och serverbaserad
affärslogik. Klienten får aldrig en databasanslutning eller serverhemlighet.

- `src/app`: App Router-sidor, route handlers och server actions.
- `src/components`: UI-komponenter och formulär.
- `src/db`: Drizzle-schema och server-only Neon-anslutning.
- `src/lib/auth`: Better Auth-konfiguration, session guards och policyer.
- `audit_logs`: server-side logg över relevanta konto- och hushållshändelser,
  utan lösenord, sessionstoken eller inbjudningstoken.
- `drizzle`: versionshanterade PostgreSQL-migrationer.
- `tests/e2e`: Playwright-flöden.

## Auth och behörigheter

Better Auth hanterar lösenord, sessioner, cookies och systemroller. Öppen
registrering är avstängd. Admin-pluginens `admin`-roll är systemrollen; den
separata medlemskapsrollen är `household_admin` eller `member`.

Skyddade sidor använder serverbaserade session guards. Server actions hämtar
också sessionen och verifierar rätt roll och hushållsmedlemskap innan de läser
eller skriver. ID i URL/formulär räcker inte för åtkomst. Systemadministration
hanterar användarkonton och hushållsmetadata, inte hushållets privata ekonomi.

## Inbjudningar

Inbjudningslänkar använder 256-bitars slumpvärden; databasen lagrar endast en
SHA-256-hash. Länken upphör efter sju dagar och markeras använd efter att
kontot skapats. E-post skickas inte automatiskt; administratören distribuerar
länken privat.

## Databas

Drizzle använder Neon HTTP-driver för korta, serverless-frågor. Migrationsfiler
genereras från schema och granskas innan de körs. Ändringar appliceras inte
automatiskt vid appstart.

## UI

Svenska är standardspråk. Layouten anpassas för mobil och desktop, färger följer
systemets ljust/mörkt-läge och interaktiva kontroller har synlig fokusmarkering.
Ofärdiga ekonomiska funktioner visas inte som aktiva verktyg.

## Avgränsningar

Inga bankkopplingar, ekonomiska tabeller, transaktioner, analysfunktioner,
e-posttransport eller extern AI finns i etapp 1.
