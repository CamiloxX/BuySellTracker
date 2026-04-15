# BuySell Tracker — DexAshkan iTunes Nigeria

Scraper + dashboard en Next.js para monitorear el stock y precios de tarjetas iTunes Nigeria del vendedor **DexAshkan** en [buysellvouchers.com](https://www.buysellvouchers.com/es/seller/info/DexAshkan/), con comparación de competidores y alertas a Telegram.

## Arquitectura

```
Vercel Cron (cada 3 días)
       ↓
/api/cron/scrape  ──►  lib/scraper.js (axios + cheerio)
       ↓                      ↓
 Turso (libSQL)        Telegram Bot API
       ↓
   Dashboard (/)  ◄── Next.js App Router + Recharts
```

- **Scraping:** `axios` + `cheerio` (HTML estático, sin JS).
- **DB:** [Turso](https://turso.tech) (SQLite serverless, tier gratuito generoso).
- **Cron:** Vercel Cron (declarado en `vercel.json`).
- **Alertas:** Telegram Bot API.
- **Dashboard:** Next.js 15 + Recharts, desplegado en Vercel.

## Setup paso a paso

### 1. Instala dependencias
```bash
npm install
```

### 2. Crea una DB en Turso
```bash
# Instala CLI (https://docs.turso.tech/cli/installation)
turso auth signup
turso db create buysell-tracker
turso db show buysell-tracker --url      # copia como TURSO_DATABASE_URL
turso db tokens create buysell-tracker   # copia como TURSO_AUTH_TOKEN
```

### 3. Crea tu bot de Telegram
1. Abre [@BotFather](https://t.me/BotFather) y envía `/newbot` → obtén el `TELEGRAM_BOT_TOKEN`.
2. Habla con tu bot al menos una vez.
3. Abre [@userinfobot](https://t.me/userinfobot) para obtener tu `TELEGRAM_CHAT_ID`.

### 4. Configura variables de entorno
Copia `.env.example` a `.env.local`:
```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
CRON_SECRET=una-cadena-larga-aleatoria
SELLER_SLUG=DexAshkan
```

### 5. Inicializa la DB y prueba localmente
```bash
npm run db:init
npm run scrape       # ejecuta un scrape completo + envía a Telegram
npm run dev          # abre http://localhost:3000
```

### 6. Despliega a Vercel
```bash
npm i -g vercel
vercel                # primera vez: conecta el proyecto
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production
vercel env add CRON_SECRET production
vercel env add SELLER_SLUG production
vercel --prod
```

El cron definido en `vercel.json` corre cada 3 días a las 08:00 UTC:
```json
{ "path": "/api/cron/scrape", "schedule": "0 8 */3 * *" }
```

Para cambiar la frecuencia, edita el campo `schedule` (sintaxis cron estándar).

## Qué scrapea

### Productos del vendedor
Para cada tarjeta iTunes Nigeria de DexAshkan captura:
- Título + denominación (p.ej. `15000 NGN`)
- Precio USD actual
- **Stock disponible** (unidades restantes)
- Vendidos totales

### Competidores
Escanea hasta 15 páginas de la categoría `gift-cards-apple` y extrae cualquier card de Nigeria/NGN de otros vendedores, con precio y stock.

## Alertas Telegram

Se envía un mensaje cuando:
- 🔴 Un producto pasa a **agotado**.
- 🟢 Un producto **reabastece** desde 0.
- 📦 El stock **aumenta ≥10 unidades** (reabastecimiento parcial).
- ⚠️ Stock **baja a ≤3** unidades.

Además, cada corrida envía un resumen con todos los precios/stocks actuales.

## Estructura del proyecto

```
.
├── app/
│   ├── api/cron/scrape/route.js   # endpoint que dispara Vercel Cron
│   ├── layout.jsx
│   ├── page.jsx                    # dashboard
│   └── StockChart.jsx              # gráfico histórico (client)
├── lib/
│   ├── db.js                       # cliente libSQL + schema
│   ├── scraper.js                  # axios + cheerio
│   ├── telegram.js                 # envío de alertas
│   └── runScrape.js                # orquesta todo
├── scripts/
│   ├── init-db.mjs
│   └── run-scrape.mjs              # ejecuta scrape desde CLI
├── vercel.json                     # cron schedule
├── package.json
└── .env.example
```

## Correr manualmente en Vercel
```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://tu-app.vercel.app/api/cron/scrape
```

## Limitaciones conocidas

- Los selectores del scraper son heurísticos (regex sobre texto). Si BuySellVouchers cambia su HTML, hay que ajustar `lib/scraper.js`.
- El escaneo de competidores recorre ~15 páginas con 400ms de delay → ~10s por corrida. Para ser más agresivo/cortés, ajusta `maxPages` y los `sleep`.
- El tier gratuito de Vercel limita los cron jobs a 1 corrida diaria como máximo si usas Hobby — el schedule `*/3` días funciona sin problema.
