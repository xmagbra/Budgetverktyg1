# Databas

## Etapp 1-tabeller

| Tabell | Syfte |
|---|---|
| `user` | Better Auth-identitet, verifieringsstatus och systemroll |
| `session` | Sessions-token med utgångstid och klientmetadata |
| `account` | Better Auths lösenordskonto och framtida provider-konton |
| `verification` | Better Auths verifieringsflöden |
| `households` | Hushållsnamn, skapare och tidsstämplar |
| `household_memberships` | Användare, hushåll och separat hushållsroll |
| `invitations` | E-post, namn, tokenhash, utgångstid och acceptansstatus |
| `audit_logs` | Aktör, händelsetyp och mål för administrativa säkerhetshändelser |

Systemroller är `user` och `admin`. Hushållsroller är `member` och
`household_admin`. En unik sammansatt indexering hindrar dubbla medlemskap.
Hushållsmedlemskap kan tas bort; användarkonton och hushåll har ingen
permanent raderingsfunktion i gränssnittet.

## Migrationer

Schema: `src/db/schema.ts`. Konfiguration: `drizzle.config.ts`.

```powershell
npm run db:generate
npm run db:migrate
```

Granska migrations-SQL innan körning, särskilt i miljöer med befintliga data.
Projektet gör ingen migration automatiskt vid serverstart. `db:push` används
inte eftersom migrationer ska versionshanteras.

## Nästa etapp

Ekonomiska tabeller ingår inte. Innan de skapas ska etapp 2 granska
ägarskap/delning, konton, valutor, exakta belopp, överföringar och låneflöden.
