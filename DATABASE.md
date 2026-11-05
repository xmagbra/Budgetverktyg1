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
Hushållsmedlemskap kan tas bort. Användarkonton kan inte raderas i
gränssnittet; hushåll kan raderas endast om de saknar ekonomiska uppgifter.

## Etapp 2-tabeller

| Tabell | Syfte |
|---|---|
| `financial_accounts` | Hushållets bank-, spar- och kontantkonton samt ingående saldo och saldodag |
| `finance_categories` | Hushållsspecifika inkomst- och utgiftskategorier |
| `finance_transactions` | Inkomster och utgifter i ören, kopplade till konto och kategori |
| `finance_transfers` | Kontoöverföringar, separerade från inkomst och utgift |
| `loans` | Lånets registrerade startskuld, återstående löptid och amorteringsmetod |
| `loan_rates` | Räntans historik; varje ränta gäller från registreringsdagen |
| `loan_payments` | Faktiska betalningar uppdelade i ränta och amortering |

Ekonomiska poster tillhör ett hushåll. Alla dess medlemmar får hantera
uppgifterna, men medlemskap kontrolleras på serversidan vid varje läsning och
ändring. Hushåll kan inte tas bort när de innehåller ekonomiska poster; poster
har inga raderingsflöden i användargränssnittet.

Alla belopp är SEK och lagras som heltal ören i PostgreSQL `bigint`. Kod för
ekonomiska belopp och ränta använder `BigInt`, aldrig flyttal. Räntor anges i
procent med högst två decimaler. Ränteberäkning använder faktiska kalenderdagar
dividerat med 365 (Actual/365 Fixed), och periodräntan avrundas till närmaste
öre med halvöre upp.

Lån registreras med kvarvarande skuld och återstående löptid från den dag
spårningen börjar. Räntan kan ändras från dagens datum; den tidigare
räntehistoriken bevaras. En betalning räknar upplupen ränta sedan föregående
betalning och minskar skulden med återstående belopp. Simuleringar räknar från
dagens skuld och ändrar inte låne- eller räntehistorik. De visar både en
betalning som behåller återstående slutdatum och en oförändrad betalning som
ger en ny återbetalningstid. Simuleringen antar att den provade räntan gäller
oförändrad framåt. Återstående löptid följer kalenderns betalningsdagar från
registreringen, oberoende av antalet extra eller missade betalningar.
Efter passerat slutdatum används minst en återstående betalning.
Prognosen börjar idag och inkluderar inte obetald ränta från tiden före idag;
faktiska betalningar använder hela räntehistoriken.

Lånebetalningar låser låneraden i en transaktion och kontrollerar att inga
nya betalningar tillkommit sedan beräkningen. Vid en konflikt behöver
användaren kontrollera uppgifterna och försöka igen. Betalning och revisionslogg
skrivs atomärt.

Kontots ingående saldo gäller från angivet datum. Transaktioner, överföringar
och lånebetalningar kan inte registreras före berörda kontons saldodag, så
historiska poster inte räknas in två gånger.

## Migrationer

Schema: `src/db/schema.ts`. Konfiguration: `drizzle.config.ts`.

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
```

Granska migrations-SQL innan körning, särskilt i miljöer med befintliga data.
Projektet gör ingen migration automatiskt vid serverstart. `db:push` används
inte eftersom migrationer ska versionshanteras.

Kör migrationer mot en utvecklingsbranch medan modellen utvecklas. Kontrollera
alltid `DATABASE_URL` i `.env.local` först; migreringen går till den databasen
och branchen som URL:en pekar på. Skapa och granska migrationen innan
tillämpning.

Etapp 2 innehåller inte automatisk bankimport, framtida räntescheman eller
automatiska lånebetalningar. Betalningar registreras manuellt; simuleringar
antar en konstant provränta för återstående löptid.
