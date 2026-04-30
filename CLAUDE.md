# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map for electric unicyclists (EUC riders) in Almaty, Kazakhstan — live at **map.euc.kz**. Key features: Mapbox GL map with thematic layers (meeting spots, charging sockets, routes, bike lanes), real-time Telegram geolocation tracking, user point submissions with moderation, and PWA support.

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # tsc -b && vite build (type-check + bundle)
npm run lint         # ESLint with TypeScript strict rules
npm run test         # Vitest unit tests (run once)
npm run preview      # Preview production build locally
```

Run a single test file:
```bash
npx vitest run src/utils/hashNav.test.ts
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:
```
VITE_MAPBOX_TOKEN=             # Mapbox public token
VITE_SUPABASE_URL=             # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Anon key (RLS-protected)
VITE_YANDEX_METRIKA_ID=        # Optional analytics
VITE_TELEGRAM_GEO_TTL_MINUTES=60
VITE_TELEGRAM_TRACK_TAIL_MINUTES=30
VITE_TELEGRAM_MAX_ACCURACY_METERS=100
```

## Code Style

- **Prettier**: 4-space tabs, 120-char line width, single quotes, no semicolons, trailing commas
- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters` — no unused variables allowed
- **ESLint**: flat config (v10), TypeScript strict + React hooks rules enforced

## Architecture

### Layer Structure

```
src/
├── components/    # UI rendering only — no business logic
├── hooks/         # State management, side effects, data fetching
├── lib/           # Initialization wrappers (Supabase client, Mapbox layer definitions)
├── utils/         # Pure functions, no React/Mapbox dependencies (all tested)
├── constants/     # LAYER_IDS, SOURCE_IDS, COLORS, MAP_CENTER
├── types/         # TypeScript types: GeoJSON features, DB row shapes, Velojol
└── data/          # Static Velojol bike lane GeoJSON
supabase/
├── migrations/    # PostgreSQL migrations (8 tables)
├── functions/     # Deno Edge Functions (Telegram webhook bot)
└── schema.sql     # Full DB schema export
```

### Data Flow

1. `hooks/useLayers.ts` — coordinates all Supabase fetches via `Promise.allSettled` (resilient)
2. `utils/supabaseToGeojson.ts` — transforms DB rows → Mapbox-ready GeoJSON FeatureCollections
3. `lib/mapLayers.ts` — defines layer paint/layout expressions, upserts sources+layers to Mapbox
4. Click/hover handlers (`useMapClick`, `useMapHover`) update Mapbox **feature-state** (`hover`, `selected`) — no DOM re-renders
5. URL hash (`#point-123`, `#route-456`) syncs with selected feature via `useHashSelectionSync`

### Main Component (`EucMap.tsx`)

Orchestrates 10+ hooks; owns the `<div ref={containerRef}>` Mapbox mount point. Composes:
- `LayerControls` — toggle layer visibility (persisted to localStorage via `useLayerVisibilityStore`)
- `FeatureSidebar` / `PopupContent` — selected feature details + photo gallery
- `AddPointPanel` — draft point submission form (`useDraftPointFlow` hook)
- `RiderGeoModal` — Telegram users list with distances + avg speeds

### Supabase Backend

- **Tables**: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions` (moderation queue), `telegram_locations`, `telegram_profiles`
- **Storage**: `map-point-photos/` and `telegram-avatars/` buckets (public URLs, no bot tokens)
- **RLS**: All tables publicly readable (except disabled/draft items); writes require auth or Edge Function
- **Resilience**: `withTimeoutAndRetry()` in `lib/supabase.ts` — 10s timeout, up to 2 retries, exponential backoff, transient error detection

### Telegram Bot (Edge Function)

`supabase/functions/telegram-location-bot/index.ts` — Deno runtime. Receives Telegram webhook `POST`, extracts location + user, saves to `telegram_locations`, fetches and caches avatar in `telegram_profiles` + Storage. Avatar URLs are sanitized (bot tokens stripped before storage).

### Deployment

- **GitHub Pages** at `map.euc.kz` — static SPA
- **CI/CD**: `.github/workflows/deploy.yml` on push to `main`; build with `GITHUB_PAGES=true` (sets Vite `base` to `/map.euc/`)
- Telegram notification on deploy success/failure

### PWA

- Service worker at `public/sw.js` — app shell + static asset caching, stale-while-revalidate for Supabase API calls, offline fallback
- `PwaPrompts.tsx` handles install prompts
- Icons/splash screens generated via `npm run generate:pwa-icons`
