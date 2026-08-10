# Frontend (SPA)

React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS 4 + Mapbox GL JS 3 + react-router-dom 7.

## Routes

Entry point: `src/main.tsx` (service worker registration → `createRoot`) → `src/App.tsx`
(`<BrowserRouter basename={import.meta.env.BASE_URL}>`).

| Path               | What opens                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- |
| `/`                | The map (`MapShell` → lazy `EucMap`)                                               |
| `/m/:type/:id`     | Deep link to a map feature: `point`, `route`, `socket`, `bikelane`, `telegramuser` |
| `/events`          | Event feed over the map (`EventsScreen`)                                           |
| `/events/:eventId` | Event details (`EventDetailScreen`) — **not** `/m/event/...`!                      |
| `/radar`           | Live rider radar (`RadarModal`)                                                    |
| `/help`            | Project information (`ProjectInfoModal`)                                           |
| `/admin/*`         | Lazy-loaded admin panel (see [admin.md](admin.md))                                 |
| `*`                | `NotFound` → redirect to `/`                                                       |

Every "screen" route (`/events`, `/radar`, `/help`, `/m/...`) renders the same `MapShell`/`EucMap` — screens are layered over the live map. Outside `Routes`, globally: `YandexMetrika`, `PwaPrompts`; `MapShell` is wrapped in `Suspense` + `AppErrorBoundary`.

### Deep links and the legacy hash

- `buildMapDeepLinkPath(type, id)` / `parseMapDeepLinkPathname()` — `src/utils/hashNav.ts`. The type is constrained by the `HashFeatureType` union.
- An event uses a **separate** route: `buildEventDetailPath(id)` from `src/utils/eventLinks.ts` (`event` is not part of `HashFeatureType`; `/m/event/5` opens an empty map).
- The old `#point=11` format is redirected to the path form automatically (`useMapSelectionSync`, `replaceState`).
- Absolute links must be built as `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}` — `base = /` today, but `BASE_URL` remains the single knob should the prefix ever change.
- A new entity with its own page ⇒ a paired `build*Path`/`parse*Pathname` plus a route in `App.tsx`; do not blindly reuse `/m/...`.

## EucMap — the orchestrator

`src/components/EucMap.tsx` composes hooks in dependency order:

1. `useMapbox(containerRef)` — the single Mapbox instance; streets/satellite style (persisted to localStorage); `flyTo`/`flyToBounds` with a synchronous `setPadding` (a workaround for the Mapbox 3.x "undefined reading paint" bug).
2. `useLayers` = `useMapData` (loading) + `useLayerVisibilityStore` (visibility, localStorage key `map-euc-layer-visibility`).
3. `useTelegramAvatars` — loads avatars as canvas-backed Mapbox icons (`tg-avatar-<userId>`, circular, 48px@2x).
4. `useEvents` — events plus the unread counter.
5. `useMapFeatureSelection` / `useSelectedFeatureState` — feature selection, feature-state, camera focus.
6. `useDraftPointFlow` — the add-a-point mode.
7. `useMapClick` (12px touch hit-padding for lines), `useMapHover` (RAF throttling, tooltips, "N min ago" for stale riders).
8. `useMapSelectionSync` — URL ↔ selected feature (plus legacy hash migration).
9. `useMapPadding` — map insets for the sidebars (desktop: 320/360 px, mobile: 45vh/80vh).
10. `useGeolocateControl` — the stock `mapboxgl.GeolocateControl` plus analytics goals.

It renders: `LiveActivityBar`, `MapNotificationModals`, `LayerControls`, `BottomTabBar`, `AddPointPanel`, `MapFeatureInfoModal`, `RouteListSidebar`, `PointListSidebar`, `ProjectInfoModal`, `EventsScreen`, `EventDetailScreen`, `RadarModal`.

## Hook inventory (`src/hooks/`)

| Hook                          | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useMapbox`                   | Mapbox instance lifecycle, style switching, flyTo/flyToBounds                                        |
| `useMapData`                  | Parallel loading of every GeoJSON layer; two-phase Telegram (latest → full tracks); realtime refresh |
| `useLayers`                   | Facade: addLayersToMap / applyVisibility / toggleLayer                                               |
| `useLayerVisibilityStore`     | Layer visibility, persisted to localStorage                                                          |
| `useTelegramRealtime`         | postgres_changes subscription → 300 ms debounce → refresh                                            |
| `useMapClick` / `useMapHover` | Click/hover: queryRenderedFeatures, feature-state, cursor, tooltip                                   |
| `useMapSelectionSync`         | URL path ↔ selected feature; migrates `#point=11` → `/m/point/11`                                    |
| `useMapFeatureSelection`      | openFeature/clearSelection, camera focus, refreshing Telegram features from the index                |
| `useSelectedFeatureState`     | Sets and clears the `selected` feature-state, surviving `style.load`                                 |
| `useMapPopup`                 | Mapbox popup with React content through `createRoot` (unmounted on close)                            |
| `useMapPadding`               | setPadding for the open panels                                                                       |
| `useFeatureIndexes`           | Map indexes id → Feature (points use a double key, `point:`/`socket:`)                               |
| `useDraftPointFlow`           | Adding a point: coordinates, submit into `map_points_submissions`, error/success states              |
| `useGeolocateControl`         | The geolocation control plus the `geolocation_success`/`geolocation_denied` goals                    |
| `useUserGeolocation`          | watchPosition without Mapbox (used by the radar)                                                     |
| `useDeviceCompassHeading`     | Device compass (iOS `requestPermission`), enabled lazily                                             |
| `useTelegramAvatars`          | Avatars → named Mapbox icons                                                                         |
| `useCopyShare`                | Copies the link + a 2.5 s toast + the `share_app_link` goal                                          |
| `useEvents`                   | fetchEvents + unreadCount + markAsRead (localStorage)                                                |
| `useMetrikaPageViews`         | SPA pageview on path change; skips the first render and `/admin/*`                                   |

## Constants (`src/constants/`)

- `index.ts` — the single source of truth: `MAP_CENTER` (`[76.904848, 43.226807]`), `MAP_ZOOM_DEFAULT` (12), `MAP_ZOOM_FOCUS` (15), `MAPBOX_STYLES` (streets — a custom style — and satellite), `LAYER_IDS` (7 layers prefixed `euc-`), `SOURCE_IDS` (5 sources), `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`, `COLORS` (point `#2563eb`, socket `#eab308`, route `#f25824`, telegramUser `#8b5cf6`, erlan `#a855f7`, …), `UI_ACCENT`, the Russian labels `FEATURE_TYPE_LABELS` / `POINT_FLAG_LABELS` / `EVENT_TYPE_LABELS`, and the `LayerKey` type.
- `mapLayerRegistry.ts` — `LAYER_KEY_TO_MAP_LAYER_IDS` (one LayerKey may control several Mapbox layers, e.g. telegramUsers → users + tracks) and `applyVisibilityToMapLayers()`.
- `layerVisibility.ts` — the `LayerVisibility` interface and its defaults.

## `src/lib/`

- `env.ts` — reading and normalizing the Vite variables: `getViteSupabaseConfig()`, `getTelegramGeoTtlMinutes()` (60), `getTelegramMaxAccuracyMeters()` (100), `getTelegramTrackTailMinutes()` (30).
- `supabase.ts` — the client (anon key), `withTimeoutAndRetry` (10 s, 2 retries, 250/500 ms backoff, transient errors only), `fetchMapPoints/fetchMapRoutes/fetchTelegramLocations/fetchEvents`, `createMapPointDraft`, row normalization into the `types/supabase.ts` types, and avatar_url sanitization.
- `mapLayers.ts` — `addLayersToMap()` (order: routes → bikeLanes → tg-tracks → tg-users → points → sockets), paint expressions driven by feature-state, and the SVG socket icon (`ensurePlugImage`).
- `analytics.ts` — all Metrika code is centralized here: `trackGoal(goal, params?)`, `trackPageView(url)` (no-ops without a counter, errors swallowed), the closed `MetrikaGoal` union (`feature_open`, `share_app_link`, `share_external_map`, `share_telegram`, `pwa_install`, `pwa_launch_standalone`, `geolocation_success`, `geolocation_denied`), `isAdminPath()` (Metrika is fully off under `/admin/*`), and `isStandaloneLaunch()`.

## `src/utils/` (pure functions, all with tests)

| Group         | Files                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geo math      | `geoMath.ts` (haversineKm, bearingDegrees, radar scales), `bounds.ts` (feature bbox/center)                                                                                                                                                    |
| GeoJSON       | `supabaseToGeojson.ts` (rows → FeatureCollection, including Telegram tracks), `velojolToGeojson.ts` (the bike lane dataset → FeatureCollection), `mapFeatureGuards.ts` (type guards)                                                           |
| Routes        | `routeStats.ts` (distance/ascent/grades), `routeFilters.ts`, `routeVertexElevationStats.ts`, `fetchMissingRouteElevations.ts`, `simplifyRouteCollinear.ts`                                                                                     |
| Navigation    | `hashNav.ts` (deep links + legacy hash), `eventLinks.ts` (`/events/:id`)                                                                                                                                                                       |
| Sharing       | `shareLinks.ts` (Yandex, 2GIS, Guru, ORS, Telegram, the app link, copyToClipboard)                                                                                                                                                             |
| Events        | `eventSchedule.ts` (occurrences, «Сегодня в 19:00», summarizeEvent), `eventsForPoint.ts`, `eventsReadStore.ts` (the unread badge, localStorage `map-euc-events-last-read`), `eventAnnounce.ts` (announcement preview)                          |
| News          | `newsAnnounce.ts` (live messages, chats not yet covered, title preview)                                                                                                                                                                        |
| Telegram      | `telegramRiders.ts` (`getActiveRiders` — TTL filter for active riders)                                                                                                                                                                         |
| Miscellaneous | `pointFilters.ts`, `selectionOpacity.ts`, `mapPopup.ts`, `numberParsers.ts`, `platformShortcuts.ts`, `resetAppCache.ts` (localStorage + Cache API + SW unregister + reload), `typograf.ts` (Russian typography, applied via `applyTypography`) |

## Key components (`src/components/`)

| Component                                                                                   | Role                                                                                                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `LayerControls` / `LayerPanel`                                                              | Layer toggles and the streets/satellite base map                                                                                  |
| `BottomTabBar`                                                                              | Bottom navigation: add a point, radar, events (unread badge), help, lists                                                         |
| `MapFeatureInfoModal` / `FeatureSidebar`                                                    | Details of the selected feature: photos, route stats, ShareBlock, events at that point                                            |
| `PointListSidebar` / `RouteListSidebar` / `ListSidebarShell`                                | Filterable lists; a click selects the feature on the map                                                                          |
| `AddPointPanel`                                                                             | The point/socket submission form → `map_points_submissions`                                                                       |
| `LiveActivityBar`                                                                           | «Катают: N» — active riders; a click opens the sidebar for one rider, fitBounds when they are close together, otherwise the radar |
| `RadarModal`                                                                                | A 320×320 polar canvas radar (1/3/10 km rings): distance, bearing, nearest meeting point                                          |
| `EventsScreen` / `EventDetailScreen` / `EventCard` / `PointEventsBlock` / `EventShareBlock` | Events (see events-news.md)                                                                                                       |
| `ShareBlock` / `CopyButton` / `ShareIconButton`                                             | Sharing buttons (the app, external maps, Telegram)                                                                                |
| `MapNotificationModals`                                                                     | Load/geolocation errors, spinner, submission success, the cache reset button                                                      |
| `PwaPrompts`                                                                                | PWA installation: Android `beforeinstallprompt`, iOS instructions                                                                 |
| `PopupContent`                                                                              | The React content of the Mapbox popup                                                                                             |
| `AppErrorBoundary`                                                                          | The global error boundary with a cache reset button                                                                               |
| `YandexMetrika`                                                                             | Metrika initialization + `useMetrikaPageViews`; not rendered under `/admin/*`                                                     |

Reusable primitives live in `src/components/ui/` (`Badge`, `FilterChips`, `SearchInput`, `ToggleSwitch`) and custom icons in `src/components/icons/`.

## Bike lanes (`src/data/almaty.json`)

The only map layer without Supabase: a static dump of Almaty bike lanes from **velojol.kz**, committed to the repository and loaded through a dynamic `import()` in `useMapData`.

- **Updating** — `node scripts/fetch-velojol-bike-lanes.js`: downloads `velojol.kz/city/almaty`, extracts the `window.bikelanesData` array out of the HTML (the site has no data endpoint), filters, cleans and **fully rewrites** the file. Details and pitfalls live in the `.claude/skills/update-bike-paths/SKILL.md` skill.
- **What ends up in the file**: only `city: almaty` and only cycling infrastructure — bus lanes (`is_bus_lane`, about half of the velojol dataset) are dropped, along with the individually hidden lanes listed in `HIDDEN_IDS` inside the script. Fields: `id`, `name`, `laneType`/`laneTypeLabel`, `distance` (km), `description`, `quality`/`qualityLabel` (surface rating, absent when unspecified), `coordinates`.
- **Names are fixed at build time**: velojol has a single `title` field with no language variants, so the script translates Kazakh names through the `NAME_ALIASES` dictionary and normalizes the format to «улица X» / «проспект X». Fragments of one lane are merged via `MERGE_GROUPS` (the first fragment's id becomes the merged id). Both functions are covered by tests in `scripts/fetch-velojol-bike-lanes.test.js`.
- **The record schema** is `src/types/velojol.ts`; the GeoJSON conversion is `src/utils/velojolToGeojson.ts` (the numeric id becomes a string for `promoteId` and the `/m/bikelane/:id` deep link).
- **In the card** (`PopupContent`) a bike lane shows a «‹lane type› · покрытие: ‹rating›» line and the length from velojol; ascent/descent is not shown — velojol geometry has no elevations.
- The file is in `.prettierignore` (coordinate pairs are formatted by the script one pair per line, otherwise the diff spans tens of thousands of lines).

## PWA / Service Worker

`public/sw.js`, cache version `map-euc-${__APP_VERSION__}` (`GITHUB_SHA` at build time):

- **static** — app shell + `assets/`, `icons/`, `.css/.js/.svg/.png` — cache-first;
- **runtime** — navigation requests — network-first, falling back to the cache of visited URLs and then to the app shell from the static cache (so an offline navigation to an unvisited URL opens the SPA instead of a browser error), capped at 120 entries;
- **tiles** — Mapbox tiles and sprites — cache-first, capped at 500 entries;
- the Supabase API (`/rest`, `/realtime`, `/auth`, `/storage`) is **not** cached;
- Mapbox telemetry is blocked in `transformRequest` (`events.mapbox.com` → an empty response);
- stale cache versions are cleaned up when a new SW activates.

**Do not add `/index.html` to the app shell.** Cloudflare Pages normalizes HTML addresses and answers `/index.html` with a 308 redirect to `/`; a redirected response returned for a navigation request kills the page with a `TypeError`. The app shell is cached under the root path (`BASE_PATH`), and the offline fallback reads it from there.

Registration: `sw.js?v=${__APP_VERSION__}` in `main.tsx`; in dev the SW is not registered (and is unregistered if left over) — otherwise cache-first would serve stale `/src/*` modules until the dev server restarts. Manifest: fullscreen/standalone, `start_url: /?homescreen=1`, theme `#0f172a`. Icons and splash screens: `npm run generate:pwa-icons` / `generate:pwa-startup`.

The `pwa_launch_standalone` goal is the only signal of an installed PWA on iOS (`appinstalled` never fires there).
