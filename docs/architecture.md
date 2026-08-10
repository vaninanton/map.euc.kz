# Architecture

## Overview

**map.euc.kz** is a single-page PWA (React 19 + Mapbox GL JS 3) served as static files from Cloudflare Pages, backed by Supabase (PostgreSQL + RLS + Realtime + Storage + Deno Edge Functions). The system is read-heavy: almost all data is read anonymously through the RLS-protected anon key; writes are limited to administrators (Supabase Auth + the `map_admin_users` table) and to Edge Functions (service role).

```
┌───────────────────────────────────────────────────────────────┐
│ Browser (SPA, Cloudflare Pages, map.euc.kz)                   │
│ React 19 + Mapbox GL JS 3 + Tailwind 4 + Service Worker (PWA) │
│  ├── EucMap — map orchestrator (20+ hooks)                    │
│  ├── /events, /radar, /help — screens layered over the map    │
│  └── /admin — lazy-loaded admin panel (Supabase Auth)         │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS (REST + Realtime WebSocket + Storage)
        ┌───────▼──────────────────────────────┐
        │ Supabase                             │
        │  PostgreSQL (13 tables + RLS + RPC)  │
        │  Storage (4 photo/avatar buckets)    │
        │  Edge Functions: telegram-location-bot, ai-assist │
        └───────┬──────────────────────────────┘
                │ Bot API (webhook + outbound messages)
        ┌───────▼──────────┐
        │ Telegram         │  geolocations, inline search, announcements, RSVP
        └──────────────────┘
```

Cloudflare Pages Functions (`functions/`) sit in front of the static bundle and serve two crawler-facing concerns — per-entity OG tags and `sitemap.xml` — reading Supabase directly. See [deployment.md](deployment.md).

## System domains

1. **Map** — points (`map_points`), routes (`map_routes`), bike lanes (a static velojol.kz dataset in `src/data/almaty.json`), live Telegram geolocations. Details: [frontend.md](frontend.md).
2. **User submissions** — the anonymous «Добавить точку» form → `map_points_submissions` → moderation in the admin panel.
3. **Events** — `map_events` + dates (`map_event_dates`) + RSVP participants (`map_event_participants`), public feed at `/events`. Details: [events-news.md](events-news.md).
4. **News** — `map_news`, admin-only plus Telegram broadcast.
5. **Telegram bot** — receiving live geolocations, inline search over points/routes, sending/editing/deleting announcements, the «Участвую» button. Details: [telegram-bot.md](telegram-bot.md).
6. **Admin panel** — `/admin`, CRUD over everything above. Details: [admin.md](admin.md).

## Map data flow

```
useMapData.ts
  ├─ fetchMapPoints()      → mapPointsToFeatureCollection()    → pointsGeo
  ├─ fetchMapRoutes()      → mapRoutesToFeatureCollection()    → routesGeo
  ├─ velojolToFeatureCollection(almaty.json)                   → bikeLanesGeo
  └─ fetchTelegramLocations()  (RPC get_latest_telegram_locations)
       ├─ telegramLocationsToUsersFeatureCollection()          → telegramUsersGeo
       └─ telegramLocationsToRecentTracksFeatureCollection()   → telegramTracksGeo

All requests go through Promise.allSettled (one failure does not block the others).
Each request is wrapped in withTimeoutAndRetry(): 10 s timeout, 2 retries, exponential backoff.

useLayers.ts → lib/mapLayers.ts → GeoJSON sources + paint layers in Mapbox

Realtime: useTelegramRealtime.ts → postgres_changes (telegram_locations, telegram_profiles)
  → 300 ms debounce → refreshTelegramUsers() → source.setData()  (map updates in < 500 ms)
```

## Key architectural patterns

### 1. Feature-state instead of React re-renders

Map hover/select are implemented with Mapbox `feature-state` and paint expressions — zero React re-renders:

```js
map.setFeatureState({ source, id }, { selected: true })
// paint: ["case", ["feature-state", "selected"], selectedColor, defaultColor]
```

Dimming of unselected features lives in `utils/selectionOpacity.ts`.

### 2. Failure resilience

- `Promise.allSettled` — the map still loads when one source fails.
- `withTimeoutAndRetry` in `lib/supabase.ts` — retries only on transient errors (timeout, network, 429, 5xx).
- A missing Supabase configuration does not crash the app: a console warning and a map without data.

### 3. One source of truth for constants

All layer/source string IDs, colors and labels live only in `src/constants/` (`LAYER_IDS`, `SOURCE_IDS`, `COLORS`, `FEATURE_TYPE_LABELS`, plus `mapLayerRegistry.ts` and `layerVisibility.ts`). Duplicating those strings elsewhere in the code is forbidden.

### 4. Code layer separation

```
components/  UI, no business logic
hooks/       state, effects, data loading
lib/         clients and configuration (supabase, mapLayers, env, analytics)
utils/       pure functions without React/Mapbox — all covered by tests
constants/   IDs, colors, labels, layer registry
types/       shared types (GeoJSON, Supabase rows, Velojol)
admin/       isolated lazy-loaded admin panel with its own API layer (adminApi)
```

### 5. Realtime only where it pays off

Live subscriptions cover only `telegram_locations`/`telegram_profiles`. Points, routes and events are batch-fetched on load — they change rarely and eventual consistency is good enough.

### 6. Security

- Only the publishable (anon) key reaches the browser; every restriction is enforced by RLS.
- The service-role key lives only inside Edge Functions.
- The Telegram bot token never reaches the database, Storage or the browser: avatar URLs are sanitized (`/file/bot<TOKEN>/` is stripped and the file is cached in Storage).

## Repository layout

```
src/                  frontend (see frontend.md, admin.md)
functions/            Cloudflare Pages Functions: OG tags (m/[type]/[id].ts), sitemap.xml
supabase/
├── migrations/       28 SQL migrations — the only way to change the schema
├── functions/telegram-location-bot/   Deno edge function (index, _handlers, _pure + tests)
├── functions/ai-assist/               Deno edge function for the admin AI helper
├── seed.sql          curated local DB seed (tracked, PII-free: points + routes)
└── config.toml       local stack + function declarations (verify_jwt = false)
public/               PWA: sw.js, manifest, icons/splash screens, robots.txt, _redirects, _headers
scripts/              fetch-velojol-bike-lanes.js, set-supabase-secrets.sh
tests/e2e/            Playwright tests with full Mapbox/Supabase mocks
tests/config/         deployConfig.test.ts — env parity between CI and .env.example
docs/                 this documentation
.github/workflows/    deploy.yml, test.yml, backup.yml (see deployment.md)
```

There is no exported `schema.sql`: the migrations plus [database.md](database.md) are the canonical schema reference.

## Deployment in one paragraph

Push to `main` → GitHub Actions: `supabase db push` + edge function deploys, in parallel with a Vite build (`base=/`) → `wrangler pages deploy` → Cloudflare Pages → Telegram notification. Daily database and Storage backups go to Selectel S3. Details: [deployment.md](deployment.md).
