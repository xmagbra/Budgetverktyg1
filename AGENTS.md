<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Budgetverktyg — arbetsregler

- Läs `README.md`, `ARCHITECTURE.md`, `DATABASE.md` och `SECURITY.md` före större
  ändringar.
- Använd TypeScript, befintliga mönster och serverbaserad åtkomstkontroll.
- All databasåtkomst och Better Auth-hemligheter är server-only.
- Behåll öppen registrering avstängd. Skapa inte publika testkonton.
- Radera inte användare/hushåll eller kör destruktiva migrationer utan
  uttryckligt godkännande.
- Implementera inte senare roadmap-etapper utan uttryckligt godkännande.
- Ekonomiska beräkningar får inte använda flyttal.
- Validera indata med Zod och kontrollera session/behörighet i varje
  server action eller route handler.
- Kör `npm run lint`, `npm run typecheck` och `npm test` efter ändringar;
  Playwright kräver konfigurerad databas.
