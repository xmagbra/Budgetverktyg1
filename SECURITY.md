# Säkerhet

## Implementerat

- Better Auth lösenordshashning och serverhanterade sessioner.
- Sessioner verifieras mot databasen vid varje kontroll så att inaktiverade
  konton och återkallade sessioner inte fortsätter via långlivad cookie-cache.
- Öppen registrering avstängd; konton skapas via engångsinbjudan.
- System- och hushållsroller kontrolleras på serversidan.
- Hushållsvyer och medlemsändringar kontrollerar medlemskap, inte bara URL-ID.
- Inbjudningstoken har hög entropi, lagras hashad, löper ut efter sju dagar och
  accepteras en gång.
- Användare kan inaktiveras men inte raderas. Sista system-/hushållsadmin
  skyddas i applikationsflöden.
- Databas- och auth-hemligheter är server-only och `.env*` ignoreras av Git.
- Relevanta konto- och hushållsadministrationshändelser loggas utan lösenord,
  sessionsvärden eller inbjudningstoken.
- Ingen känslig ekonomisk information loggas; ingen ekonomisk data finns ännu.

## Krävs innan produktion

- Skapa stark `BETTER_AUTH_SECRET` och TLS-baserad produktions-URL.
- Konfigurera Neon med TLS, minsta möjliga databasbehörighet, backup/PITR,
  retention och separat branch per miljö.
- Begränsa Vercel teamåtkomst, skydda production deployments och förvara
  miljövariabler endast server-side.
- Konfigurera e-postleverantör för automatisk inbjudan/verifiering om det ska
  införas; dagens inbjudningslänkar skickas manuellt.
- Lägg till rate limiting och övervakning för inloggning/inbjudningsflöden.
- Genomför säkerhetsgranskning och verifiera policy/rättsliga krav innan
  produktionsdata används.

## Kända avgränsningar

- Ingen automatisk e-posttransport eller rate limiting i etapp 1.
- Last-admin-kontroller är applikationskontroller; samtidiga adminändringar bör
  senare skyddas med transaktion/låsning och testas mot PostgreSQL.
- Inbjudan skapar kontot innan acceptansstatus skrivs. Vid avbrott mellan dessa
  operationer kan administratören behöva utfärda en ny inbjudan efter att
  kontot kontrollerats.
- Skapa inte riktiga användardata eller publicera tjänsten innan ovanstående
  driftsteg är genomförda.
