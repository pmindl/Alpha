---
name: Lightweight API Architecture
description: Pravidla pro vývoj a nasazení malých API (invoice-downloader, processor atd.) na VPS pomocí Coolify. Zabraňuje pádům OOM a 502 Bad Gateway.
---

# Architektura odlehčených aplikací na VPS

Tento postup řeší kritický problém nedostatku paměti (OOM) na malých VPS (např. 8GB RAM). 

## Problém s Next.js pro mikroslužby
Původně byly všechny sub-aplikace (`invoice-downloader`, `invoice-processor`, `gmail-labeler` atd.) vytvářeny jako kompletní **Next.js** projekty. 
Tento přístup způsobil dva problémy:
1. **OOM při buildu:** Spuštění příkazu `npx turbo run build` nebo jen čistého `next build` v monorepo prostředí vyžaduje na jeden proces kolem 1.5GB až 2GB RAM. Paralelní builds (nebo vícero nasazení v Coolify za sebou) okamžitě shodily server s chybou `502 Bad Gateway`.
2. **Plýtvání RAM při běhu:** Next.js framework spustí plnohodnotný server (včetně React enginu, routing systému atd.). Pro obyčejný cron-job endpoint je to extrémně neefektivní. Na každou aplikaci se zbytečně alokují stovky MB RAM. V porovnání s `n8n` to představovalo obří ztrátu výkonu.

## Řešení: Čistý Express.js (Lightweight API)

Pokud je daná sub-aplikace zamýšlena pouze jako Node.js backend/API endpoint (bez UI), nesmíme používat Webpack/Next.js/React.

### Pravidla vývoje nové sub-aplikace

Tato aplikace by měla vypadat velmi spartánsky, ale smí sdílet interní balíčky (např. `@alpha/core`, `@alpha/sdk`, `@alpha/google-auth`).

**1. Úprava `package.json`**
Odstranit veškeré závislosti na `next`, `react`, `react-dom` a dalších dev dependencies jako `tailwindcss`, `vite-plugin-react`.

Nahradit je těmito základy:
```json
"dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
},
"devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "tsx": "^4.7.1",
    "typescript": "^5"
}
```

**2. Správné NPM Scripty**
Tím největším vylepšením je absolutní **zrušení build fáze**. Kód se vůbec nekompiluje generátorem a nespouští z `.next/standalone`. Místo toho se v produkci pouští nativně skrze TypeScript enginu (nástroj `tsx` funguje bleskově a úsporně).

```json
"scripts": {
    "dev": "node ../../scripts/run-with-secrets.js nazev-aplikace tsx src/server.ts",
    "dev:standalone": "tsx src/server.ts",
    "build": "echo 'No build required for Node.js Express server'",
    "start": "node ../../scripts/run-with-secrets.js nazev-aplikace tsx src/server.ts",
    "start:standalone": "tsx src/server.ts"
}
```

**3. Express.js Boilerplate (`src/server.ts`)**
Obyčejný jednoduchý express server, který zvládne obstarat volání z frontend/master webu, popřípadě n8n.
```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Tvé API routy
app.post('/api/action', async (req, res) => {
    // logika
    res.json({ success: true });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Express Server listening on port ${port}`);
});
```

## Konfigurace Deploymentu (Coolify)

Jelikož se aplikace nachází v monorepo (`apps/nazev-aplikace`), musíme správně zacházet s deploymentem, abychom zamezili pádu celého VPS.

**Hlavní parametry v Coolify:**
- **Repository:** `pmindl/Alpha` (Nikoliv vytvořený "standalone" repozitář přes subtree. Aplikace potřebuje najít `packages/` v parent fallbacku repozitáře.)
- **Base directory:** `/` (Aby Nixpacks správně analyzoval složku a našel root `package.json`).
- **Build command:**  Zásadní změna: Nespouštíme `turbo run build`. Necháme zde jen příkaz `npm install`. Jelikož jsme vypsali z `package.json` "build": "echo ...", tak se žádná paměťově náročná kompilace nespustí.
- **Start command:** `npm run start:standalone --workspace=nazev-aplikace`

Tento Express.js přístup (`tsx`) ušetří cca 300 - 500 MB RAM u alokačního profilu každé běžící služby. Startovní čas API klesne na 0.5s z 5-6 sekund a Docker container nemá žádnou kompilaci.
