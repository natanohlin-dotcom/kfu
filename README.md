# KFU – arbetsyta för kapitalförvaltningsutskottet

Next.js 16 + OpenNext på Cloudflare Workers med D1. Plan, beslut och faser: [PLAN.md](PLAN.md).

## Kom igång lokalt

```bash
npm install
cp .dev.vars.example .dev.vars          # fyll i AUTH_SECRET och ADMIN_KEYS (MARKET_PROVIDER=demo = påhittade kurser)
npx wrangler d1 migrations apply kfu-db --local
npm run dev                             # http://localhost:3000 → /admin
```

Skapa en användare (tillfälligt lösenord, byts vid första inloggningen):

```bash
node scripts/admin-key.mjs "Förnamn Efternamn" användarnamn admin
```

Lägg raden i `ADMIN_KEYS` (kommaseparerat) i `.dev.vars` lokalt, eller med `npx wrangler secret put ADMIN_KEYS` i produktion.

## Kontroller före push

```bash
npm run typecheck && npm run lint && npm test
npm run preview                         # bygger med OpenNext och kör i workerd (som produktion)
```
