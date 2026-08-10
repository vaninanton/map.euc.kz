# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PWA map for EUC (electric unicycle) riders in Almaty — live at **map.euc.kz**. Meeting points, power sockets, routes, bike lanes, live geolocations from Telegram chats, community events and news.

**Full documentation lives in [docs/](docs/README.md)**: architecture, frontend, DB schema and RLS, Telegram bot, events/news, admin panel, testing, deployment. Read the relevant file before changing a subsystem; update docs/ in the same commit as the behavior change. Agent rules are mirrored in [AGENTS.md](AGENTS.md) — keep both in sync when invariants change.

## Stack

- **React 19** + **TypeScript 6** (strict) + **Vite 8** (rolldown) + **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Mapbox GL JS 3** — map; **react-router-dom 7** — SPA routing; **Font Awesome 7** — icons; **typograf** — text typography
- **Supabase** — PostgreSQL + RLS + Realtime + Storage + Deno Edge Functions
- **Cloudflare Pages** + Pages Functions (server-side rendering only for meta tags and `sitemap.xml`)
- **Vitest 4** + **RTL 16** + **jsdom** — unit tests; **Playwright** — e2e; **deno test** — edge functions
- **Husky 9** — pre-commit hook; **ESLint 10** (flat config, `eslint.config.js`) + **Prettier**

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173; host: true — reachable over LAN)
npm run build        # vite build only (no type check)
npm run build:check  # tsc -b && vite build — full check before pushing
npm run lint         # ESLint (typescript-eslint strictTypeChecked + React hooks)
npm test             # Vitest, single run (NODE_OPTIONS=--no-experimental-webstorage)
npm run test:e2e     # Playwright (pretest:e2e → build:e2e with dummy env vars)
npm run test:e2e:ui  # Playwright UI mode
npm run test:functions  # deno test --allow-net supabase/functions/
npm run format       # Prettier --write
npm run format:check # Prettier --check (gate in CI and pre-commit)
npm run preview      # Preview production build locally
npm run secrets:sync # scripts/set-supabase-secrets.sh — push edge-function secrets
```

Run a single test:

```bash
npx vitest run src/utils/hashNav.test.ts
npx playwright test tests/e2e/map.e2e.ts
```

**Pre-commit hook** (`.husky/pre-commit`) runs automatically:
`lint → format:check → npx tsc -b --noEmit → test → test:functions (if deno is installed) → build → test:e2e`.
The hook prepends `/opt/homebrew/bin` to `PATH`. Never bypass it with `--no-verify`.

Type-check with `tsc -b`: `tsconfig.json` is a solution config holding only `references` (app / node / playwright / functions).

## Environment

Copy `.env.example` → `.env.local`:

```
VITE_MAPBOX_TOKEN=             # Mapbox public token
VITE_SUPABASE_URL=             # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Anon key (RLS-protected)
VITE_YANDEX_METRIKA_ID=        # Optional analytics
VITE_TELEGRAM_GEO_TTL_MINUTES=60
VITE_TELEGRAM_TRACK_TAIL_MINUTES=30
VITE_TELEGRAM_MAX_ACCURACY_METERS=100
```

Non-Vite secrets (`supabase secrets` only, never shipped to the browser): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BACKFILL_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
Pages Functions read `SUPABASE_URL` / `SUPABASE_ANON_KEY` from the Cloudflare project settings, not from GitHub.

When adding a `VITE_*` variable, sync it in five places: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md`, and the `build:e2e` script in `package.json` (otherwise the e2e production build breaks). `tests/config/deployConfig.test.ts` guards this.

Suggest commands for values from `.env.local`:

- sensitive → `gh secret set NAME --body "$NAME"`
- non-sensitive → `gh variable set NAME --body "$NAME"`

## Language

UI strings, user-facing messages, code comments, `CHANGELOG.md` and commit descriptions are written in **Russian**; identifiers in English. Developer documentation is English: `docs/`, `CLAUDE.md`, `AGENTS.md` and `.claude/skills/`. `README.md` stays Russian — it is the public face of the repository. When editing an existing file, write in that file's language.

## Code Style

- **Prettier**: 4-space tabs, 120-char line width, single quotes, no semicolons, trailing commas. YAML uses 2 spaces.
- **TypeScript**: strict, `noUnusedLocals`, `noUnusedParameters`. Avoid `any`; if unavoidable, add an explicit `eslint-disable` with justification.
- **ESLint**: flat config (`eslint.config.js`), `typescript-eslint/configs.strictTypeChecked` + React hooks rules.
- Imports: external libraries first, then internal by path, `type` imports last. Alias `@/` → `src/` (known to Vite/Vitest; **not** to the esbuild bundler behind Pages Functions — use relative paths there).
- Naming: PascalCase for components/types; camelCase for functions/hooks/variables; UPPER_SNAKE for global constants.
- Function components only, named exports: `export function ComponentName()`.
- Props go in a separate `ComponentNameProps` interface — never inlined into `FC<...>`.
- Disabling hook rules: `// eslint-disable-next-line react-hooks/... -- краткое обоснование`.
- In effects with subscriptions, keep the live callback in a ref so the effect does not resubscribe on every render.

### Styles & UI

- Tailwind classes only. Global styles live in `src/index.css`.
- UI colors come from the Tailwind palette (neutral, white) or `UI_ACCENT`. Map layer colors come from `COLORS` in `src/constants/index.ts`.
- Inline `style` only for dynamic values (color by feature type, popup positioning).
- Map and overlays: `fixed`/`absolute` with `inset-0`. Safe area (`safe-area-padding`, `control-inset-*`) is applied globally in `src/index.css` to `.mapboxgl-ctrl-*`, `.mapboxgl-popup`.
- Responsive via `sm:` breakpoints. Buttons: `type="button"`, `aria-label` where needed, decorative icons `aria-hidden`.
- Every `<button>` and `<a>` must carry `cursor-pointer` (no exceptions); disabled ones use `cursor-not-allowed`.

## Architecture

### Directory Structure

```
src/
├── App.tsx        # router: public routes + lazy-loaded /admin
├── main.tsx       # bootstrap, service worker registration
├── app/           # MapShell.tsx (shell for public screens), NotFound.tsx
├── components/    # UI only — no business logic
│   ├── ui/            # primitives: Badge, FilterChips, SearchInput, ToggleSwitch
│   └── icons/         # custom icons (IconTelegram)
├── hooks/         # state, effects, data loading
├── lib/           # env.ts, supabase.ts, mapLayers.ts, analytics.ts
├── utils/         # pure functions, no React/Mapbox (all covered by tests)
├── constants/     # index.ts (LAYER_IDS, SOURCE_IDS, COLORS, MAP_CENTER, labels),
│                  # mapLayerRegistry.ts (layer descriptors), layerVisibility.ts
├── types/         # geojson.ts, supabase.ts, velojol.ts — re-exported via index.ts
├── data/          # almaty.json — static bike-lane GeoJSON (Velojol)
├── test/          # setup.ts for Vitest + jsdom
└── admin/         # lazy-loaded at /admin; Supabase Auth (password or passkey) + map_admin_users
    ├── pages/         # DashboardPage, PointsPage/PointEditPage, RoutesPage/RouteEditPage,
    │                  # EventsPage/EventEditPage, NewsPage/NewsEditPage, SubmissionsPage,
    │                  # TelegramChatsPage, GeoPage, SettingsPage, AdminLoginPage
    ├── components/    # PointForm, EventForm, PhotoManager, AiAssistPanel, EventAnnounceModal,
    │                  # AdminGeoMap, AdminRoutePolylineMap, ConfirmDialog, ...
    ├── hooks/         # useAdminAuth, useCoordinateHistory, useUndoRedoHotkeys, useAdminListLoader
    ├── lib/adminApi/  # CRUD: points, routes, photos, submissions, events, eventAnnouncements,
    │                  # news, newsAnnouncements, telegramChats, geo, dashboard, aiAssist,
    │                  # announceClient; types, parsers, query, constants
    ├── lib/passkeys.ts # WebAuthn sign-in for the admin panel
    ├── utils/         # adminTime, formatAdminDate, routeDistance, aiAssistPrompt
    └── route-editor/  # routeGeometry.ts, routeValidation.ts (route vertex geometry & validation)
functions/         # Cloudflare Pages Functions (not to be confused with supabase/functions)
├── _lib/          # ogMeta.ts (meta tags), entities.ts (hourly entity dump), sitemap.ts
├── m/[type]/[id].ts  # dynamic OG tags for deep links
└── sitemap.xml.ts    # sitemap built from the same dump
supabase/
├── migrations/    # PostgreSQL migrations (tables + RLS + indexes + RPC), 28 files today
├── functions/     # telegram-location-bot (bot webhook), ai-assist (OpenAI helper for admin)
├── config.toml    # local stack config
└── seed.sql       # curated local DB seed, tracked and PII-free (points + routes only)
scripts/           # fetch-velojol-bike-lanes.js (bike lanes), set-supabase-secrets.sh
tests/
├── e2e/           # Playwright specs + fixtures.ts (Mapbox/Supabase mocks)
└── config/        # deployConfig.test.ts — env parity between CI and .env.example
public/            # sw.js, _redirects, _headers, robots.txt, manifest.webmanifest, icons
```

### Data Flow

```
useMapData.ts
  ├─ fetchMapPoints()      → mapPointsToFeatureCollection()    → pointsGeo
  ├─ fetchMapRoutes()      → mapRoutesToFeatureCollection()    → routesGeo
  ├─ import('@/data/almaty.json') → velojolToFeatureCollection() → bikeLanesGeo
  └─ fetchTelegramLocations()
       ├─ telegramLocationsToUsersFeatureCollection()          → telegramUsersGeo
       └─ telegramLocationsToRecentTracksFeatureCollection()   → telegramTracksGeo

All requests go through Promise.allSettled (one failure does not block the rest).
Each request is wrapped in withTimeoutAndRetry() — 10s timeout, 2 retries, exponential backoff.

useLayers.ts
  └─ lib/mapLayers.ts → adds/updates GeoJSON sources + paint layers on the Mapbox instance

Telegram realtime:
  useTelegramRealtime.ts → postgres_changes → 300ms debounce → fetchTelegramLocations() → source.setData()
  Out-of-order refreshes are discarded by the telegramRefreshSeqRef counter.
```

### Main Component (`EucMap.tsx`)

Orchestrates hooks in dependency order:

1. `useMapbox(containerRef)` — creates the Mapbox instance (once)
2. `useMapData` — loads data, manages realtime
3. `useLayers` — adds layers, manages visibility (`useLayerVisibilityStore`)
4. `useMapClick`, `useMapHover` — attach listeners, update feature-state
5. `useMapSelectionSync` — syncs URL ↔ selected feature
6. `useMapPopup` — drives the Mapbox popup
7. `useGeolocateControl`, `useUserGeolocation`, `useDeviceCompassHeading` — geolocation

Renders: `LayerControls`/`LayerPanel`, `FeatureSidebar`, `PopupContent`, `AddPointPanel`, `MapOverlayButtons`, `MapNotificationModals`, `PwaPrompts`, `BottomTabBar`, `LiveActivityBar`.

### Feature State (no DOM re-renders)

Hover/select are implemented with Mapbox feature-state — zero React re-renders:

```javascript
map.setFeatureState({ source, id }, { selected: true })
// Paint: ["case", ["feature-state", "selected"], selectedColor, defaultColor]
```

### URL Deep Links

Public routes (`src/App.tsx`): `/`, `/radar`, `/events`, `/events/:eventId`, `/help`, `/m/:type/:id`; anything else renders `NotFound`.

- `/m/:type/:id` format: `/m/point/11`, `/m/route/5`, `/m/socket/3`, `/m/bikelane/alm1`, `/m/telegramuser/123` — map feature types only (`HashFeatureType = FeatureType` in `src/utils/hashNav.ts`).
- **Events use their own route `/events/:id`** — not `/m/event/:id`. Build them only via `buildEventDetailPath` from `src/utils/eventLinks.ts`; `event` is not part of `HashFeatureType`, so `buildMapDeepLinkPath` / `/m/...` for an event yields a broken link (the `/m/:type/:id` route fails to recognize the type and opens an empty map). This applies to edge functions (Telegram bot) too: the `events` segment is stable (`EVENTS_PATH_PREFIX`) and is written as a literal.
- When adding a new entity type with its own page, add a matching `build*Path`/`parse*Pathname` pair plus a route in `src/App.tsx`; do not blindly reuse `/m/...`.
- Legacy hash `#point=11` redirects to the path form automatically.
- Build links as `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(type, id)}` — `BASE_URL` stays the single knob in case base ever becomes non-empty again.

### Constants (`src/constants/`)

Single source of truth — never duplicate string IDs in code:

- `LAYER_IDS`, `SOURCE_IDS`, `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`
- `COLORS` — per-feature-type colors for paint expressions; `UI_ACCENT` — interface accents
- `FEATURE_TYPE_LABELS`, `POINT_FLAG_LABELS`, `EVENT_TYPE_LABELS` — Russian labels
- `MAPBOX_STYLES` (`streets`, `satellite`), type `BaseMapStyle`, type `LayerKey`
- `MAP_CENTER` (`[76.904848, 43.226807]`), `MAP_ZOOM_DEFAULT` (12), `MAP_ZOOM_FOCUS` (15)
- `mapLayerRegistry.ts` — declarative layer descriptors; `layerVisibility.ts` — defaults and visibility persistence

Register a new layer in all of the above at once, otherwise it will not be clickable or toggleable.

### GeoJSON & Types (`src/types/`)

- `FeatureType = 'point' | 'socket' | 'route' | 'bikeLane' | 'telegramUser'`
- `FeatureProperties` — union of `PointProperties | SocketProperties | RouteProperties | BikeLaneProperties | TelegramUserProperties`
- Coordinates: `[lon, lat]` or `[lon, lat, elevation]` (type `Position`)
- `PointFeature`, `RouteFeature`, `BikeLaneFeature`, `LineStringFeature` — typed wrappers

### Mapbox

- Initialized in `useMapbox(containerRef)`. One instance; after `setStyle(...)` layers are recreated on `style.load`.
- Before adding layers: `if (map.getStyle() === undefined) return`
- Popups: `createRoot` + a React component; call `root.unmount()` on close
- Token: `import.meta.env.VITE_MAPBOX_TOKEN`. Telemetry is disabled via `transformRequest` (empty response for `events.mapbox.com`)
- Map controls only via `map.addControl(...)` — no text on the button, no custom classes/styles. Positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`.
- Map padding for sidebars/panels goes through `useMapPadding` only; calling `setPadding` elsewhere races with layer rendering.

### Supabase Backend

- **Tables**: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions`, `telegram_locations`, `telegram_profiles`, `map_admin_users`, `map_events`, `map_event_dates`, `map_event_participants`, `map_news`, `telegram_chats`, `telegram_outbound_messages`
- **RPC**: `get_latest_telegram_locations` (latest position per rider), `get_admin_dashboard_stats` (SECURITY DEFINER, admins only — the whole admin dashboard summary in one call)
- **`telegram_outbound_messages`** — the single table of outbound bot messages (formerly `map_event_announcements`, renamed in migration `20260627120000`). Polymorphic link: `event_date_id` (event announcement) OR `news_id` (project news); a CHECK guarantees exactly one of them. The `(telegram_chat_id, telegram_message_id)` → sender mapping powers event RSVP callbacks as well as message edits/deletions. `cancelled_at`/`pinned_at` are event-specific.
- **Storage**: buckets `map-point-photos/`, `telegram-avatars/`, `map-event-photos/`, `map-news-photos/` (public URLs, no bot tokens)
- **RLS**: public read (except disabled/draft rows); writes require auth or an Edge Function. Every new table ships with its policies.
- **Resilience**: `withTimeoutAndRetry()` in `lib/supabase.ts`; with a missing URL/key the app falls back to the Cache API and logs a console warning instead of throwing at startup
- **Migrations**: files in `supabase/migrations/`, applied only via `supabase db push` (or CI) — **never** through MCP `apply_migration`/`execute_sql`, which writes an auto-generated timestamp into `schema_migrations` that diverges from the file name and breaks deploys. If the history diverges, fix it with `supabase migration repair` (it fixes bookkeeping, not the schema) and verify with `supabase migration list`. MCP `apply_migration` is acceptable only for one-off checks on a preview branch.
- There is no exported `schema.sql` in the repo: migrations plus [docs/database.md](docs/database.md) are the canonical schema reference.

### Telegram Bot (Edge Function)

`supabase/functions/telegram-location-bot/` — Deno runtime. Accepts the webhook `POST`, validates the secret token, stores geolocation into `telegram_locations`, caches avatars in `telegram_profiles` + Storage, broadcasts event/news announcements and handles RSVP callbacks. Avatar URLs are sanitized (the bot token is stripped before persisting).

Pure logic lives in `_pure.ts` / `_handlers.ts` with Deno tests alongside; `index.ts` holds only the HTTP wiring. New bot logic starts as a pure function plus a test.

### AI Assist (Edge Function)

`supabase/functions/ai-assist/` — improves point/route titles and descriptions via the OpenAI Responses API + `web_search` (see [docs/admin.md](docs/admin.md), section «ИИ-помощник»). The prompt builder in `_pure.ts` is a copy of `src/admin/utils/aiAssistPrompt.ts` — change both together. Secrets: `OPENAI_API_KEY`, `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`).

### Admin Section (`/admin`)

Lazy-loaded; access requires Supabase Auth (password or passkey/WebAuthn via `admin/lib/passkeys.ts`) plus a row in `map_admin_users`.

- **adminApi** (`src/admin/lib/adminApi/index.ts` is the only import surface): points, routes, photos, submissions, events + eventAnnouncements, news + newsAnnouncements, telegramChats, geo (`fetchTelegramLocations`, `buildRiderTracks`), dashboard (`getDashboardStats`), aiAssist (`improveWithAi`)
- **route-editor**: route vertex geometry and validation
- Coordinate undo/redo: `useCoordinateHistory` + `useUndoRedoHotkeys`
- List pages use `useAdminListLoader` (loading, search, empty/error states)
- The "Открыть на сайте" button on edit pages: `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}`
- Yandex.Metrika is fully disabled under `/admin/*`

### Deployment

- **Cloudflare Pages** (`map.euc.kz`, project `map-euc`) — static SPA, Vite `base = /`; SPA fallback comes from `public/_redirects`, cache headers from `public/_headers`
- **Pages Functions** (`functions/`):
    - `m/[type]/[id].ts` rewrites OG tags for `/m/point|socket|route|bikelane/:id` via `HTMLRewriter` (crawlers do not execute JS); no meta is built for `/m/telegramuser/…` — personal data
    - `sitemap.xml.ts` serves the sitemap (static sections + points, routes, bike lanes, events); it is linked from `public/robots.txt`
    - Both functions share one **hourly dump** of points/routes fetched from the Supabase REST API (`_lib/entities.ts`); misses are cached for 5 minutes and an entity absent from the dump is fetched individually
    - `_routes.json` is generated by wrangler. `SUPABASE_URL`/`SUPABASE_ANON_KEY` live in the Pages project settings, not in GitHub. Imports from `src/` must be relative: the `@/` alias is known to Vite but not to esbuild
- **CI/CD**:
    - `.github/workflows/test.yml` — PR gate: lint → format:check → `tsc -b --noEmit` → vitest → Deno tests → Playwright
    - `.github/workflows/deploy.yml` (push to `main`) — job `supabase` (`db push` + deploying both edge functions with `--no-verify-jwt --use-api`) and job `deploy` (`npm run build` without tsc → `wrangler pages deploy dist --project-name=map-euc --branch=main`) run in parallel, followed by a Telegram notification
    - `.github/workflows/backup.yml` — database backups
- **Locally**: Valet proxies `map.euc.test` → `localhost:5173` (`vite.config.ts` allowlists `map.euc.test`, `test.euc.kz`)

### PWA

- Service worker `public/sw.js` — app shell cache + stale-while-revalidate for the Supabase API, offline fallback. Build version is injected via the `__APP_VERSION__` define (`GITHUB_SHA` or a timestamp).
- Icons/splash screens: `npm run generate:pwa-icons` / `npm run generate:pwa-startup`

### Analytics (Yandex.Metrika)

All analytics is centralized in `src/lib/analytics.ts`. Never call `ym()` from `react-metrika` directly in components.

- **Events go through helpers only**: `trackGoal(goal, params?)` and `trackPageView(url)` from `@/lib/analytics`. Both are no-ops without a counter (`VITE_YANDEX_METRIKA_ID`) and swallow errors so analytics never affects UX.
- **Goal names are a closed `MetrikaGoal` union**. Add new goals there with a comment; goal name strings live only in that type.
- **SPA navigation** is tracked by the `useMetrikaPageViews` hook (`hit` on path change; the first render is skipped since init already reports it). Mounted in `YandexMetrika.tsx`.
- **Metrika is fully off under `/admin/*`**: `<MetrikaCounter>` is not rendered (no webvisor over the admin panel) and no pageviews are sent. The check is `isAdminPath(pathname)`.
- `pwa_launch_standalone` is the only signal of an installed PWA on iOS (`isStandaloneLaunch()` via `display-mode: standalone` + `navigator.standalone`), because `appinstalled` never fires there.
- Write tests for new analytics: mock `react-metrika`/`@/lib/analytics` with `vi.hoisted`; for the env-dependent `metrikaCounterId` use `vi.stubEnv` + `vi.resetModules` + dynamic import.

## Workflow

- Layers/sources/colors only through the constants in `src/constants/`.
- Public functions/hooks/utils/edge functions get a short JSDoc stating purpose and key effects.
- The Vitest config is embedded in `vite.config.ts` (environment: jsdom, globals: true, setupFiles: `src/test/setup.ts`; `supabase/functions/**` is excluded — those run under `deno test`).
- **Tests are mandatory for any new functionality** (component, hook, util, pure bot function) — write `*.test.ts(x)` next to the file; do not close a task without tests.
- A new frontend query to Supabase requires a matching mock in `tests/e2e/fixtures.ts`, otherwise e2e fails.
- Notable changes get a line in `CHANGELOG.md` (`Added/Changed/Fixed` under a date). Commits follow Conventional Commits.

## Danger Zones

- `src/lib/mapLayers.ts` — a bad paint expression means an invisible layer with no console error
- `supabase/migrations/` (RLS) — a bad policy means leaked or unreachable data
- `src/hooks/useMapData.ts` — realtime update races (`telegramRefreshSeqRef`)
- `supabase/functions/telegram-location-bot/` — bot token leak risk (avatar URLs, logs)
- `public/sw.js` — a caching mistake strands users on a stale version
- `functions/_lib/entities.ts` — the hourly dump: a bug here breaks OG previews and `sitemap.xml` for every crawler at once

## Skills (`.claude/skills/`)

| Skill                  | Use it for                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `commit`               | preparing a commit: checks, test coverage, docs/ freshness              |
| `git-feature-workflow` | branch → commit → push → PR → merge into `main`                         |
| `supabase-backup`      | dumping/restoring the production database                               |
| `supabase-clone-prod`  | refresh the local stack: schema from migrations + data seeded from prod |
| `update-bike-paths`    | rebuild `src/data/almaty.json` from velojol.kz                          |
| `update-deps`          | npm dependency updates (minor/patch automatic, major with analysis)     |
