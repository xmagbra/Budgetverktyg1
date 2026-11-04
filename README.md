# Budgetverktyg

Grundsystem för en privat, hushållsbaserad budgetapplikation. Nuvarande version
innehåller inloggning, hushåll och systemadministration. Ekonomiska funktioner
och öppen registrering är avstängda.

## Neon-projekt

Projektet är redan länkat till Neon-projektet `wandering-union-02557175` i
organisationen MBR, region Frankfurt, på grenen `main`. Neon CLI har hämtat
databasvariabler till `.env.local`, och en lokal `BETTER_AUTH_SECRET` har
genererats. Skapa inte ett nytt Neon-projekt för att komma igång.

Neon MCP är konfigurerad projektspecifikt i `.vscode/mcp.json`. Starta om VS
Code för att ladda MCP-servern; vid första användningen kan VS Code be dig
logga in hos Neon.

## Krav

- Node.js 22 eller senare (testat med Node 24).
- npm.
- PostgreSQL 16+ eller en Neon-databas.

## Lokal utveckling

1. Installera beroenden: `npm install`.
2. Behåll `.env.local` som Neon CLI skapade. Kontrollera att den innehåller
   `DATABASE_URL` och `BETTER_AUTH_SECRET`; lägg till
   `BETTER_AUTH_URL=http://localhost:3000` om den saknas.
3. Granska migrationsfilerna i `drizzle/`. De har genererats men ännu inte
   tillämpats på Neon-databasen.
4. Tillämpa migrationerna: `npm run db:migrate`.
5. Skapa den första systemadministratören enligt nästa avsnitt.
6. Starta appen: `npm run dev`, öppna `http://localhost:3000` och logga in.

Kör sedan kontrollerna med `npm run lint`, `npm run typecheck` och `npm test`.
Inga riktiga hushålls- eller ekonomiska data behövs för att prova grundflödet.

Generera en hemlighet i PowerShell utan att lägga den i kommandoradshistorik:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`.env.local` är ignorerad av Git. Lägg aldrig hemligheter i `NEXT_PUBLIC_*`,
källkod eller loggar.

## Första systemadministratören

När migrationerna är körda, skapa den första administratören med Better Auths
officiella CLI:

```powershell
npx auth@latest create-admin --email "din-adress@example.com" --name "Ditt namn" --role admin
```

CLI:t frågar efter lösenord. Använd ett unikt lösenord på minst 12 tecken. Det
finns inget publikt standardkonto. Skapa administratören först när du själv kan
nå databasen.

## Användare och inbjudningar

Systemadministratören loggar in och öppnar **Administration**. Skapa en
inbjudan och skicka engångslänken privat till mottagaren. Länken gäller i sju
dagar och kan användas en gång. E-postutskick automatiseras inte i denna etapp;
inga e-postleverantörsnycklar behövs. Nya användare väljer själva lösenord via
länken. Inaktivering återkallar åtkomst genom Better Auths ban-funktion;
konton raderas inte.

En medlem kan skapa ett hushåll. Skaparen blir hushållsadministratör och kan
lägga till befintliga användare, ta bort medlemmar eller ta bort hushållet
permanent. Borttagning av hushåll tar även bort dess medlemskap, men inte
användarkonton. Åtgärden kräver bekräftelse och kan utföras av en
hushållsadministratör eller systemadministratör. Medlemskap delar inga
ekonomiska data; sådana data finns ännu inte.

## Kontroller

```powershell
npm run lint
npm run typecheck
npm test
```

Playwright kräver en konfigurerad databas och tillämpat migrationsschema:

```powershell
npm run test:e2e
```

Första gången kan Playwright behöva Chromium: `npx playwright install chromium`.

## Driftsättning

1. Skapa en Neon-databas och kör `npm run db:migrate` mot dess URL.
2. Importera projektet i Vercel och konfigurera `DATABASE_URL`,
   `BETTER_AUTH_SECRET` och `BETTER_AUTH_URL` som server-side variabler.
3. Använd separat Neon-branch/databas och separata hemligheter per miljö.
4. Skapa administratören via den säkra CLI-anslutningen; lägg aldrig lösenordet
   i Vercel build logs.
5. Aktivera MFA för leverantörskonton, begränsa databasroller och kontrollera
   Neon/Vercel backup-, retention- och TLS-inställningar.

Driftsättning sker inte automatiskt. Se [SECURITY.md](./SECURITY.md) för
kvarstående driftåtgärder.

## Dokumentation

- [Arkitektur](./ARCHITECTURE.md)
- [Databas och migrationer](./DATABASE.md)
- [Roadmap](./ROADMAP.md)
- [Säkerhet](./SECURITY.md)
- [Arbetsinstruktioner för agenter](./AGENTS.md)
