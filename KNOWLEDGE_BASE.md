# map.euc.kz — Comprehensive Knowledge Base

**Last Updated:** 2026-06-12  
**Repository:** https://github.com/tonybantry/map.euc  
**Live Site:** https://map.euc.kz  
**Status:** Production, actively maintained

---

## PROJECT OVERVIEW

An interactive PWA (Progressive Web App) serving the EUC (Electric Unicycle) community in Almaty, Kazakhstan. The map displays:

- **Meeting points & sockets** — places to gather, charge devices
- **Curated routes** — preloaded EUC-friendly paths
- **Bike lanes** — Almaty's velodoroughfare network (Velojol dataset)
- **Live Telegram geolocation** — real-time markers + recent tracks of riders sharing location in Telegram chats
- **Admin panel** — moderation of user-submitted points, CRUD for routes

**Core Vision:** Enable EUC riders to plan trips, find charging, discover routes, and see where community members are riding in real-time.

**Target Platform:** Mobile-first (native iOS/Android install via PWA), desktop-friendly.

---

## ARCHITECTURE

### System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser (SPA)                              │
│  React 19 + Mapbox GL JS + TailwindCSS                          │
│  ├── EucMap (main)      — map container, orchestrates hooks     │
│  ├── LayerControls      — toggle layer visibility              │
│  ├── AddPointPanel      — submit user points                   │
│  ├── FeatureSidebar     — display selected feature details     │
│  └── RadarModal         — live Telegram tracking               │
└────────────────┬────────────────────────────────────────────────┘
                 │ (HTTPS + Realtime subscriptions)
        ┌────────▼──────────┐
        │    Supabase       │
        │  ┌──────────────┐ │
        │  │ PostgreSQL   │ │  ◄─ 7 tables (map_points, routes, etc.)
        │  │ + RLS        │ │
        │  └──────────────┘ │
        │  ┌──────────────┐ │
        │  │ Storage      │ │  ◄─ Point photos, Telegram avatars
        │  └──────────────┘ │
        │  ┌──────────────┐ │
        │  │Edge Function │ │  ◄─ Telegram webhook handler
        │  │(Deno)        │ │
        │  └──────────────┘ │
        └───────┬───────────┘
                │
        ┌───────▼──────────┐
        │ Telegram Bot API │  ◄─ location updates, avatar fetch
        └──────────────────┘
```

### Logical Layer Architecture

```
Frontend (React Components)
         ↓
React Hooks Layer (Data fetching, Mapbox integration)
         ↓
Type-safe Utilities (supabaseToGeojson, geoMath, etc.)
         ↓
Library Layer (Supabase client, Mapbox layer definitions)
         ↓
External APIs (Mapbox GL, Supabase, Telegram)
```

### Component Composition

1. **EucMap** (orchestrator)
   - Houses map container ref
   - Composes 10+ hooks
   - Manages selection, draft point flow, radar mode
   - Renders UI panels (controls, sidebar, modals)

2. **useLayers** (data + visibility coordinator)
   - Fetches GeoJSON from database
   - Manages layer visibility state (localStorage)
   - Provides `addLayersToMap()` and `applyVisibility()` callbacks

3. **useMapbox** (Mapbox instance)
   - Creates and manages Map instance
   - Handles style switching (streets ↔ satellite)
   - Configures controls (attribution, geolocation)

4. **useMapData** (data orchestration)
   - Parallel fetches via `Promise.allSettled` (resilient)
   - Normalizes Supabase rows to GeoJSON
   - Realtime subscription to Telegram locations
   - Feature indexing for fast lookups

5. **useMapClick / useMapHover** (interaction)
   - Feature selection via click
   - Feature state updates (hover, selected)

6. **useTelegramRealtime** (Supabase Realtime listener)
   - Listens to changes on `telegram_locations` and `telegram_profiles`
   - Triggers refresh on insert/update/delete

### Data Flow Diagram

```
User opens map
    ↓
EucMap mounts
    ├─ useMapbox() → Mapbox instance initialized
    ├─ useMapData() → Parallel fetches:
    │  ├─ fetchMapPoints() → map_points table + photos
    │  ├─ fetchMapRoutes() → map_routes table
    │  ├─ fetchTelegramLocations() → telegram_locations + telegram_profiles
    │  └─ Import static almaty.json (bike lanes)
    │
    ├─ Normalize rows to GeoJSON in memory
    ├─ useLayers() → reads from useMapData, applies visibility
    ├─ useLayers.addLayersToMap() → upsert sources + layers to Mapbox
    ├─ useTelegramRealtime() → Subscribe to postgres_changes
    └─ useLayers.applyVisibility() → set layer visibility

User clicks feature
    ├─ useMapClick() → feature-state set to selected
    ├─ useMapSelectionSync() → URL path updated (/m/point/123)
    ├─ useMapFeatureSelection() → fetch feature from index
    └─ UI rerenders with FeatureSidebar showing details

Telegram bot receives location update
    ├─ Edge Function saves to telegram_locations
    ├─ Supabase Realtime broadcasts insert event
    ├─ useTelegramRealtime() callback triggered
    ├─ useMapData.refreshTelegramUsers() executes
    ├─ GeoJSON updated in state
    └─ useMapboxLayers updates Mapbox source

User toggles layer visibility
    ├─ LocalStorage updated
    ├─ useLayerVisibilityStore notifies subscribers
    ├─ useLayers.applyVisibility() called
    └─ Mapbox layer visibility property set
```

---

## RUNTIME FLOW

### Initialization Sequence

```
index.html
    ↓
main.tsx
    ├─ React 19 createRoot()
    ├─ registerServiceWorker() — registers /sw.js with version query
    ├─ <StrictMode> wrapper
    └─ <App /> (BrowserRouter)

<App />
    ├─ Routes: / → MapShell, /admin → AdminShell, /m/:type/:id → MapShell
    ├─ MapShell → Suspense + ErrorBoundary → <EucMap /> (lazy loaded)
    ├─ <YandexMetrika /> — optional analytics
    └─ <PwaPrompts /> — iOS/Android install prompts

EucMap
    ├─ containerRef created (for Mapbox mount)
    ├─ useMapbox() → Mapbox instance created
    │  └─ Emits 'load' event when style loads
    ├─ useMapData() → fetches all data in parallel
    │  └─ Emits 'loading' → 'ready' or 'error'
    ├─ useLayers() → adds sources + layers to Mapbox
    │  └─ Applies stored visibility from localStorage
    ├─ useTelegramRealtime() → subscribes to changes
    │  └─ Refreshes Telegram GeoJSON on insert/update
    └─ All hooks ready, UI interactive
```

### Lifecycle Hooks Execution Order

When **EucMap** mounts:

1. **useMapbox()** — creates Mapbox instance (once, retained across renders)
2. **useMapData()** — loads data from Supabase (once, refetch on manual trigger)
3. **useLayers()** — reads visibility state from localStorage
4. **useMapClick()** — attaches click listener to Mapbox
5. **useMapHover()** — attaches mousemove listener to Mapbox
6. **useMapSelectionSync()** — syncs URL path `/m/{type}/{id}` ↔ selected feature
7. **useTelegramRealtime()** — subscribes to Supabase Realtime
8. **useSelectedFeatureState()** — manages feature-state (hover/selected)
9. **useGeolocateControl()** — adds browser geolocation control

When **useMapData** completes:

- GeoJSON state updated
- `addLayersToMap()` is called (in a `useEffect` dependency of loading state)
- Mapbox sources + layers created

When **visibility** changes:

- `applyVisibility()` called
- Mapbox layer paint/layout properties updated

---

## FRONTEND

### Component Tree

```
App
├── BrowserRouter
│   ├── Routes
│   │   ├── / → MapShell
│   │   │   └── EucMap
│   │   │       ├── <div ref={containerRef}> (Mapbox mount point)
│   │   │       ├── LayerControls (overlay)
│   │   │       ├── MapOverlayButtons (geoloc, share, etc.)
│   │   │       ├── FeatureSidebar (feature details, photos)
│   │   │       ├── AddPointPanel (submission form)
│   │   │       ├── MapFeatureInfoModal (selected feature modal)
│   │   │       ├── MapNotificationModals (errors, submission status)
│   │   │       ├── RadarModal (Telegram live tracking)
│   │   │       └── ProjectInfoModal (about dialog)
│   │   ├── /admin → AdminShell
│   │   │   ├── AdminLayout
│   │   │   └── Routes
│   │   │       ├── /admin/submissions → SubmissionsPage
│   │   │       ├── /admin/points → PointsPage + PointEditPage
│   │   │       ├── /admin/routes → RoutesPage + RouteEditPage
│   │   │       ├── /admin/geo → GeoPage (admin map tools)
│   │   │       └── /admin/login → AdminLoginPage
│   │   └── /m/:type/:id → MapShell (deep link)
│   ├── YandexMetrika (analytics provider)
│   └── PwaPrompts (PWA install)
```

### Key Components

#### EucMap.tsx

**Role:** Orchestrator, hosts the Mapbox container, manages state.

**Responsibilities:**
- Mount point for Mapbox (`containerRef`)
- Composition of hooks
- Selection & draft point flow
- Radar mode toggle
- Sidebar close
- Cache reset button

**Props:** None (uses router hooks for deep links)

**Key State:**
- `isResettingCache` — clearing IndexedDB, Service Worker caches
- `isProjectInfoOpen` — about dialog
- `isDesktop` — media query (min-width: 768px)
- `draftMarkerRef` — live marker while placing point

#### LayerControls.tsx

**Role:** Toggle layer visibility in sidebar.

**Responsibilities:**
- Display layer checkboxes (points, sockets, routes, bikeLanes, telegram)
- Persist to localStorage via `useLayerVisibilityStore`
- Visual indicator of layer count/types

#### FeatureSidebar.tsx

**Role:** Display details of selected feature (point, route, Telegram user).

**Responsibilities:**
- Show title, description, coordinates
- Photo gallery (with Supabase Storage URLs)
- For Telegram users: avatar, speed, last update
- Share button, close button

#### AddPointPanel.tsx

**Role:** Form to submit new points/sockets.

**Responsibilities:**
- Click-to-place coordinates on map
- Type selection (point vs. socket)
- Title, description, meeting flag
- Loading/error states during submission
- Post-submission confirmation

#### PwaPrompts.tsx

**Role:** Detect and prompt PWA installation.

**Responsibilities:**
- Android: beforeinstallprompt event
- iOS: show banner (can't directly prompt)
- Display Add to Home Screen instructions for iOS

---

## BACKEND

### Supabase Infrastructure

**Project URL:** `${VITE_SUPABASE_URL}` (e.g., `https://xxx.supabase.co`)  
**Anon Key:** `${VITE_SUPABASE_PUBLISHABLE_KEY}` (RLS-protected)  
**Service Role:** Used only in Edge Functions (never exposed to browser)

### Tables

#### map_points

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | Auto-generated |
| created_at | timestamptz | Default: now() |
| title | text | Required; 3–99 chars |
| coordinates | double precision[2] | [lon, lat]; validated |
| type | point_types enum | 'point' \| 'socket' |
| description | text | Optional |
| flag_is_meeting | boolean | "Meeting spot" |
| flag_has_socket | boolean | "Charging available" |
| flag_erlan | boolean | "Erlandia only" (internal joke) |
| flag_disabled | boolean | Hidden from public view |

**RLS:** Readable by anon (where `flag_disabled = false`); writable by service role only.  
**Indexes:** (flag_disabled, created_at), (coordinates)

#### map_routes

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | Auto-generated |
| created_at | timestamptz | |
| title | text | Required; 3–99 chars |
| coordinates | jsonb | Array of [lon, lat] or [lon, lat, elevation] |
| via_coordinates | jsonb | Intermediate waypoints (default: []) |
| description | text | Optional |
| flag_disabled | boolean | Hidden |
| flag_erlan | boolean | "Erlandia only" |

**RLS:** Readable by anon (where `flag_disabled = false`); writable by service role.  
**Relationship:** None to map_points (independent).

#### map_points_submissions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| created_at | timestamptz | |
| processed_at | timestamptz | Set when approved/rejected |
| type | point_types enum | 'point' \| 'socket' |
| title | text | |
| description | text | |
| coordinates | jsonb | [lon, lat] |
| flag_is_meeting | boolean | |
| status | submission_status enum | 'pending' \| 'approved' \| 'rejected' |

**RLS:** Insert by anon or authenticated users; admin can read/update.

#### map_point_photos

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| map_point_id | bigint (FK) | Points can have many photos |
| bucket_name | text | 'map-point-photos' |
| storage_path | text | Relative path in bucket |
| alt_text | text | Accessibility |
| sort_order | integer | Gallery order |

**RLS:** Readable by anon; writable by admin only.

#### map_admin_users

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid (PK) | Supabase Auth user.id |
| created_at | timestamptz | |

**RLS:** Only admins can read/insert (via policy checking authenticated admin role).

#### telegram_locations

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| created_at | timestamptz | |
| chat_id | bigint | Telegram chat ID |
| chat_title | text | Chat name (cached) |
| telegram_user_id | bigint | Telegram user ID |
| username | text | From telegram_profiles or message |
| first_name | text | |
| last_name | text | |
| longitude | double precision | |
| latitude | double precision | |
| location_accuracy_meters | integer | GPS accuracy; filtered by VITE_TELEGRAM_MAX_ACCURACY |
| raw_update | jsonb | Full Telegram update (anon: hidden) |

**RLS:** Readable by anon (select only safe columns: no raw_update); insertable only by Edge Function.  
**TTL:** Filtered in frontend based on `VITE_TELEGRAM_GEO_TTL_MINUTES`.

#### telegram_profiles

| Column | Type | Notes |
|--------|------|-------|
| telegram_user_id | bigint (PK) | |
| username | text | @username or null |
| first_name | text | |
| last_name | text | |
| avatar_url | text | Safe public Storage URL (no bot token) |
| updated_at | timestamptz | Last refresh |

**RLS:** Readable by anon; updated by Edge Function.

### Storage Buckets

#### map-point-photos

- **Access:** Public read (unauthenticated), admin-only write (RLS policy)
- **Naming:** `{point_id}/{uuid}.{ext}` (e.g., `42/abc123.jpg`)
- **Served:** Via Supabase public URL builder: `${supabaseUrl}/storage/v1/object/public/map-point-photos/...`

#### telegram-avatars

- **Access:** Public read, Edge Function-only write
- **Naming:** `{telegram_user_id}.{ext}` (e.g., `12345.jpg`)
- **Purpose:** Cache avatars fetched from Telegram API (with bot token stripped)

### Row Level Security (RLS)

**Policy Pattern:**

```sql
CREATE POLICY "public_read_map_points" ON public.map_points
  FOR SELECT USING (flag_disabled = false OR auth.uid() IN (SELECT user_id FROM map_admin_users));

CREATE POLICY "admin_write_map_points" ON public.map_points
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM map_admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM map_admin_users));
```

**Result:** Data readable by anonymous users (with filters); writes restricted to authenticated admins.

---

## REALTIME SYSTEMS

### Supabase Realtime Subscriptions

**Channel:** `useTelegramRealtime()` hook subscribes to:

```javascript
supabaseClient.channel('telegram-live-points')
  .on('postgres_changes', {
    event: '*', // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'telegram_locations'
  }, scheduleRefresh)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'telegram_profiles'
  }, scheduleRefresh)
  .subscribe()
```

**Triggered Actions:**

- **INSERT on telegram_locations** → `useMapData.refreshTelegramUsers()` queued
- **UPDATE on telegram_profiles** → same refresh

**Race Condition Protection:** `telegramRefreshSeqRef` counter ensures stale requests don't overwrite newer data.

### Telegram Webhook (Edge Function)

**URL:** `https://<project-ref>.supabase.co/functions/v1/telegram-location-bot`

**Flow:**

```
Telegram API sends POST update to webhook
    ↓
Edge Function parses Telegram Update
    ├─ Extract message with location
    ├─ Extract chat_id, telegram_user_id, user details
    ├─ Validate secret_token (Telegram signature)
    └─ Fetch or refresh user avatar
        ├─ getUserProfilePhotos() API call
        ├─ getFile() API call (fetch file_path)
        ├─ Download image from Telegram CDN
        └─ Upload sanitized (token-free) URL to Storage
            └─ Save avatar_url to telegram_profiles

INSERT into telegram_locations
    ├─ new row: {created_at, chat_id, telegram_user_id, longitude, latitude, ...}
    └─ Supabase Realtime broadcasts INSERT event

Frontend receives Realtime broadcast
    └─ refreshTelegramUsers() executes, map updates in <500ms
```

**Security:**

1. **Secret Token:** Telegram sends `X-Telegram-Bot-Api-Secret-Token` header; function validates it
2. **Bot Token Stripping:** Avatar URLs parsed; `/file/bot<TOKEN>/...` pattern removed before storage
3. **RLS:** raw_update column hidden from anon users

### Avatar Backfill

**Purpose:** Refresh avatars for existing `telegram_profiles` (e.g., after security fixes).

**Endpoint:** `POST /functions/v1/telegram-location-bot/backfill`

**Authentication:** Header `x-telegram-backfill-secret: ${TELEGRAM_BACKFILL_SECRET}`

**Protection:** Rate-limited to `DEFAULT_BACKFILL_MAX_PROFILES_PER_RUN` (500 by default) per call.

---

## GEOLOCATION / MAP SYSTEMS

### Mapbox GL Integration

**Initialization:** `useMapbox()` hook

```typescript
const mapInstance = new mapboxgl.Map({
  container: containerRef.current,
  style: MAPBOX_STYLES[baseStyle], // 'streets' or 'satellite'
  center: MAP_CENTER, // [76.904848, 43.226807] (Almaty)
  zoom: MAP_ZOOM_DEFAULT, // ~11
  logoPosition: 'bottom-right',
  attributionControl: false, // custom attribution added
  transformRequest: (url) => {
    // Block Mapbox telemetry (events.mapbox.com)
    if (url?.includes('events.mapbox.com')) {
      return { url: 'data:application/json;base64,e30=' };
    }
    return { url };
  }
});
```

**Custom Attribution:** `'velojol.kz'` added via `mapboxgl.AttributionControl`.

### Layer Structure

**File:** `src/lib/mapLayers.ts`

**Layers (z-order):**

1. Routes (LineString, blue)
2. Bike lanes (LineString, dashed green)
3. Telegram recent tracks (LineString, semi-transparent)
4. Points & sockets (Circle, colored by type)
5. Telegram users (Circle + symbol, with avatar)

**Source Type:** GeoJSON (promoteId: 'id' for feature-state mapping)

**Feature State Effects:**

- **hover:** radius +1, width +1, opacity 1
- **selected:** radius +2, width +2, opacity 1, other features dimmed to 0.7

### Coordinate Systems

- **Mapbox GL:** [longitude, latitude] (WGS84, standard GeoJSON)
- **Database:** Same format
- **Telegram API:** Separate `longitude`/`latitude` fields (normalized on insert)

### Geolocation Control

**File:** `useGeolocateControl.ts`

**Feature:**

- Browser geolocation (Geolocation API)
- Shows accuracy circle on map
- Fly-to on button click
- Error handling (timeout, permission denied)

**Type:** Custom Mapbox control

### Elevation Data

**Routes:** Coordinates can be [lon, lat, elevation] (3-tuple).

**Usage:** Shown in route stats (min/max elevation, total climb).

**Source:** Static Velojol dataset + manually added routes.

---

## DATA MODELS

### Type System

**File:** `src/types/`

#### GeoJSON Types (supabase.ts)

```typescript
type MapPointRow = {
  id: string
  type: 'point' | 'socket'
  title: string
  description?: string
  coordinates: [number, number] // [lon, lat]
  flag_is_meeting?: boolean
  flag_has_socket?: boolean
  flag_erlan?: boolean
  photos: MapPointPhotoRow[]
}

type MapRouteRow = {
  id: string
  title: string
  coordinates: Array<[number, number] | [number, number, number]>
  via_coordinates: Array<[number, number]>
  description?: string
  flag_erlan?: boolean
}

type TelegramLocationRow = {
  id: string
  created_at: string
  chat_id: number
  telegram_user_id: number
  username?: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  longitude: number
  latitude: number
  location_accuracy_meters?: number
}
```

#### GeoJSON Features (geojson.ts)

```typescript
type PointFeature = Feature<
  Point,
  {
    id: string
    name: string
    type: 'point' | 'socket' | 'telegramUser'
    isMeeting?: boolean
    hasSocket?: boolean
    avatarUrl?: string
    // ... other properties
  }
>

type RouteFeature = Feature<
  LineString,
  {
    id: string
    name: string
    type: 'route'
    // ...
  }
>
```

#### Feature Guard Functions

**File:** `utils/mapFeatureGuards.ts`

Discriminator functions:

```typescript
export function isPointFeature(feature: Feature): feature is PointFeature
export function isRouteFeature(feature: Feature): feature is RouteFeature
export function isTelegramUserFeature(feature: Feature): feature is TelegramUserFeature
export function isBikeLaneFeature(feature: Feature): feature is BikeLaneFeature
```

**Pattern:** Checks `properties.type` field for runtime safety.

---

## API SURFACE

### Supabase API Calls (lib/supabase.ts)

All wrapped with `withTimeoutAndRetry` (10s timeout, 2 retries, exponential backoff).

#### fetchMapPoints()

```typescript
→ Promise<MapPointRow[]>
SELECT id, type, title, description, coordinates, 
       flag_is_meeting, flag_has_socket, flag_erlan,
       map_point_photos(...)
FROM map_points
WHERE flag_disabled = false
```

**Includes:** Nested photo data via foreign key join.

#### fetchMapRoutes()

```typescript
→ Promise<MapRouteRow[]>
SELECT id, title, description, coordinates, via_coordinates, flag_erlan
FROM map_routes
WHERE flag_disabled = false
```

#### fetchTelegramLocations()

```typescript
→ Promise<TelegramLocationRow[]>
```

**Pagination:** Fetches in batches of 1000 (infinite loop until < 1000 returned).

**Filters:**
- `created_at >= now() - ${VITE_TELEGRAM_GEO_TTL_MINUTES} minutes`
- `location_accuracy_meters <= ${VITE_TELEGRAM_MAX_ACCURACY_METERS}` (or null)

**Returns:** Merged rows (locations + profile data from separate query).

#### createMapPointDraft(input: MapPointDraftInput)

```typescript
→ Promise<void>
INSERT INTO map_points_submissions (type, title, description, coordinates, flag_is_meeting, status)
VALUES (...)
```

**Inserted with status = 'pending'** → admin approval required.

### Mapbox GL API (useMapbox.ts)

#### flyTo(coordinates: [number, number], options?: object)

Animated pan/zoom to coordinate.

#### flyToBounds(bounds: LngLatBounds, options?: object)

Animated zoom to fit bounds with padding.

#### map.setLayoutProperty(layerId, 'visibility', 'visible' | 'none')

Toggle layer visibility.

#### map.setFeatureState({source, id}, {hover: true, selected: true})

Update feature state for paint expressions.

---

## STATE MANAGEMENT

### React State: useLayerVisibilityStore

**File:** `hooks/useLayerVisibilityStore.ts`

**State:** plain `useState` + `useCallback` (без Zustand)

```typescript
{
  visibility: {
    points: boolean
    sockets: boolean
    routes: boolean
    bikeLanes: boolean
    telegramUsers: boolean
  }
}
```

**Methods:**

- `toggleLayer(layerKey: LayerKey)` — toggle on/off
- `setLayerVisibility(layerKey, visible: boolean)`

**Persistence:** localStorage key `map-euc-layer-visibility`

**Subscribers:** `useLayers()` hook depends on this, triggers `applyVisibility()` when changed.

### React State: useMapData

**State:**

```typescript
{
  pointsGeo: FeatureCollection | null
  routesGeo: FeatureCollection | null
  bikeLanesGeo: FeatureCollection | null
  telegramUsersGeo: FeatureCollection | null
  loading: boolean
  errorMessage: string | null
  emptyMessage: string | null
}
```

**Fetches:** Parallel via `Promise.allSettled` (partial failures allowed).

**Refresh Trigger:** `refreshTelegramUsers()` callback (subscribed to Supabase Realtime).

**Feature Indexing:** `useFeatureIndexes()` hook caches a Map<id, Feature> for fast lookups.

### React State: useMapFeatureSelection

**State:**

```typescript
{
  selectedFeature: Feature | null
  selectedFeatureState: { hover: boolean, selected: boolean }
  displaySelectedFeature: boolean
}
```

**Methods:**

- `openFeature(featureId: string)` — fetch from index, set selected state, fly-to bounds
- `clearSelection()` — reset selection

### React State: useDraftPointFlow

**State:**

```typescript
{
  isAddingPoint: boolean
  draftCoordinates: [number, number] | null
  isSubmittingDraft: boolean
  draftSubmitError: string | null
  draftSubmitSuccess: boolean
}
```

**Methods:**

- `setDraftCoordinates([lon, lat])` — set placement
- `handleSubmitDraft(title, description, type)` → `createMapPointDraft()` API call

---

## AUTHENTICATION

### Admin Panel (Supabase Auth)

**Flow:**

1. User navigates to `/admin`
2. `AdminAuthGate` hook checks Supabase session
3. If no session → redirect to `/admin/login` (email/password form)
4. If session exists but not in `map_admin_users` → show "Forbidden"
5. If session + authorized → render `AdminShell` (CRUD pages)

**Auth Persistence:** Session stored in `localStorage` by Supabase JS SDK.

**RLS Integration:** Writes to `map_points`, `map_routes` require `auth.uid() IN (SELECT user_id FROM map_admin_users)`.

### Public (Anonymous)

- No authentication required for reading map data
- Anonymous users can submit points (→ moderation queue)
- RLS policies hide disabled/draft items automatically

---

## STORAGE

### Supabase Storage Integration

#### Upload Photos (Admin)

**Endpoint:** `supabase.storage.from('map-point-photos').upload(path, file)`

**RLS:** Admin-only write policy.

**Path Structure:** `{point_id}/{uuid}.{ext}` (flat, not nested directories).

#### Fetch Public URLs

```typescript
const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
```

**Result:** `https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}`

#### Telegram Avatar Caching

1. Edge Function downloads avatar from Telegram CDN (`https://api.telegram.org/file/...`)
2. Strips bot token from URL path
3. Uploads to `telegram-avatars/{telegram_user_id}.jpg`
4. Stores public URL in `telegram_profiles.avatar_url`

**Safety:** No bot token in final URL, reversible via backfill.

---

## INFRASTRUCTURE & CI/CD

### Hosting

**Frontend:** GitHub Pages (static SPA)  
**Domain:** `map.euc.kz` (via CNAME)  
**Base Path:** `/map.euc/` (configured in `vite.config.ts` via `GITHUB_PAGES=true` env)

**SPA Handling:** `404.html` = copy of `index.html` (handled by Vite plugin `spaFallback404Plugin`)

### CI/CD Pipeline

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `main` branch (or manual workflow_dispatch)

**Jobs:**

1. **supabase** (runs first)
   - Install Supabase CLI
   - Link to project via `SUPABASE_PROJECT_REF` env var
   - Run migrations: `supabase db push`
   - Deploy Edge Function: `supabase functions deploy telegram-location-bot`

2. **deploy** (depends on supabase)
   - Install Node, dependencies
   - Build: `npm run build` (with VITE_* env vars)
   - Upload `dist/` to GitHub Pages
   - Send Telegram notification on success/failure

### Secrets & Variables

**GitHub Secrets (encrypted):**
- `SUPABASE_ACCESS_TOKEN` — for Supabase CLI auth
- `SUPABASE_DB_PASSWORD` — PostgreSQL password
- `TELEGRAM_BOT_TOKEN` — Bot API token (for deploy notifications)
- `TELEGRAM_CHAT_ID` — Chat to notify

**GitHub Variables (public):**
- `SUPABASE_PROJECT_REF` — e.g., `abcdef123456`
- `VITE_MAPBOX_TOKEN` — Mapbox public token
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key
- `VITE_YANDEX_METRIKA_ID` — Analytics (optional)
- `VITE_TELEGRAM_GEO_TTL_MINUTES` — 60
- `VITE_TELEGRAM_TRACK_TAIL_MINUTES` — 30
- `VITE_TELEGRAM_MAX_ACCURACY_METERS` — 100

### Supabase Secrets (for Edge Functions)

Set via `supabase secrets set`:

- `TELEGRAM_BOT_TOKEN` — Telegram bot API token
- `TELEGRAM_WEBHOOK_SECRET` — Random secret for webhook signature validation
- `TELEGRAM_BACKFILL_SECRET` — Different secret for backfill endpoint
- `TELEGRAM_BACKFILL_MAX_PROFILES` — Max per run (default: 500)

---

## BUILD & DEPLOYMENT

### Build Process

```bash
npm run build
# Runs:
# 1. tsc -b (TypeScript compilation, strict mode)
# 2. vite build (ESM bundling, code splitting for mapbox-gl)
# Result: dist/ with index.html, assets/, 404.html
```

**Pre-commit hook** (Husky, `.husky/pre-commit`): `lint → tsc --noEmit → test → build` — запускается автоматически перед каждым коммитом.

**Optimization:**
- Code splitting: `mapbox-gl` in separate chunk (600KB limit)
- Tree-shaking: ESM modules
- CSS: TailwindCSS JIT (inline only used classes)
- Images: None imported in JS (static assets only)

### Vite Config

**Custom Plugins:**

1. **baseUrlMetaPlugin** — replaces `%BASE_URL%` in `index.html` OG meta tags
2. **spaFallback404Plugin** — copies `index.html` → `404.html` on build

**Base Path:** `/map.euc/` (when `GITHUB_PAGES=true`)

### Service Worker (PWA)

**File:** `public/sw.js`

**Caches:**

1. **STATIC_ASSET_CACHE** — app shell (index.html, manifest, favicon, CSS, JS)
   - Cache-first for static assets
   - Add at install time

2. **RUNTIME_CACHE** — pages, API responses
   - Network-first, fallback to cache
   - Max 120 entries, FIFO eviction
   - Fallback to home if offline

3. **TILE_CACHE** — Mapbox tiles (immutable by URL)
   - Cache-first
   - Max 500 entries

**Supabase API** — Network-first (let it fail offline, don't cache auth/dynamic data)

**Mapbox Telemetry** — Blocked at request time (transformRequest in Mapbox config)

---

## ENVIRONMENT VARIABLES

### Frontend (Vite, .env.local)

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| VITE_MAPBOX_TOKEN | string | required | Mapbox public token |
| VITE_SUPABASE_URL | string | required | Supabase project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | string | required | Anon key (RLS-protected) |
| VITE_YANDEX_METRIKA_ID | string | empty | Optional analytics |
| VITE_TELEGRAM_GEO_TTL_MINUTES | number | 60 | How long to show Telegram locations |
| VITE_TELEGRAM_TRACK_TAIL_MINUTES | number | 30 | Recent track history window |
| VITE_TELEGRAM_MAX_ACCURACY_METERS | number | 100 | Filter inaccurate GPS points |

### Edge Function (Supabase Secrets)

| Secret | Type | Purpose |
|--------|------|---------|
| TELEGRAM_BOT_TOKEN | string | Bot API token for avatar fetch |
| TELEGRAM_WEBHOOK_SECRET | string | Signature validation for webhook |
| TELEGRAM_BACKFILL_SECRET | string | Protected backfill endpoint |
| TELEGRAM_BACKFILL_MAX_PROFILES | number | Rate limit per backfill run |

### Build / Deployment

| Variable | Purpose |
|----------|---------|
| GITHUB_PAGES | Set to 'true' to build with base=/map.euc/ |
| GITHUB_SHA | Git commit SHA (embedded in app version) |

---

## DEPENDENCIES

### Core Frontend

- **react@19.2.6** — UI framework
- **react-dom@19.2.6** — Rendering
- **react-router-dom@7.15.1** — Client-side routing
- **mapbox-gl@3.23.1** — Map rendering (largest bundle)
- **@supabase/supabase-js@2.105.4** — Backend client + Realtime

### UI & Icons

- **tailwindcss@4.3.0** — Utility CSS framework
- **@tailwindcss/vite@4.3.0** — Vite integration
- **@fortawesome/react-fontawesome@3.3.1** — Icon wrapper
- **@fortawesome/free-solid-svg-icons@7.2.0** — Solid icon set
- **@fortawesome/free-brands-svg-icons@7.2.0** — Brand icons

### Utilities

- **typograf@7.7.0** — Russian text typography (adds proper spaces, dashes, quotes)
- **react-metrika@1.0.0** — Yandex.Metrika analytics

### Dev Dependencies

- **typescript@6.0.3** — Type checking
- **vite@8.0.13** — Bundler
- **@vitejs/plugin-react@6.0.2** — Fast refresh
- **eslint@10.3.0** — Linting
- **typescript-eslint@8.59.3** — TS linting rules
- **eslint-plugin-react-hooks@7.1.1** — React Hooks rules
- **vitest@4.1.6** — Unit test runner
- **@playwright/test@1.60.0** — E2E testing
- **pwa-asset-generator@8.1.4** — Generate PWA icons from favicon
- **supabase@2.98.2** — CLI for migrations

### Bundle Impact

Analyzed:

- **mapbox-gl** — ~600KB (separate chunk)
- **@supabase/supabase-js** — ~150KB
- **react + react-dom** — ~100KB
- **react-router-dom** — ~50KB
- **tailwindcss JIT** — ~10KB (only used)
- **Total (gzipped)** — ~150KB

---

## IMPORTANT FILES

### Entry Points

- **src/main.tsx** — App bootstrap, service worker registration
- **src/App.tsx** — Router configuration
- **src/MapShell.tsx** — Map page (lazy-loaded)
- **src/admin/AdminShell.tsx** — Admin dashboard
- **index.html** — HTML template with OG meta tags, PWA manifest link

### Core Hooks (State & Data)

- **src/hooks/useMapbox.ts** — Mapbox instance lifecycle
- **src/hooks/useMapData.ts** — Data fetching orchestration
- **src/hooks/useLayers.ts** — Layer management facade
- **src/hooks/useTelegramRealtime.ts** — Realtime subscriptions
- **src/hooks/useMapClick.ts** — Click event handling
- **src/hooks/useMapHover.ts** — Hover effects
- **src/hooks/useMapSelectionSync.ts** — URL path `/m/{type}/{id}` ↔ selected feature
- **src/hooks/useDraftPointFlow.ts** — Point submission flow
- **src/hooks/useLayerVisibilityStore.ts** — Visibility state (localStorage + useState)
- **src/admin/hooks/useAdminAuth.ts** — Auth status for admin panel

### Libraries & Utilities

- **src/lib/supabase.ts** — Supabase client, data fetching functions
- **src/lib/mapLayers.ts** — Mapbox layer definitions & paint expressions
- **src/lib/env.ts** — Environment variable readers with defaults
- **src/utils/supabaseToGeojson.ts** — Row → GeoJSON normalization
- **src/utils/mapFeatureGuards.ts** — Type discriminators
- **src/utils/hashNav.ts** — URL deep link parsing и построение путей `/m/{type}/{id}`
- **src/utils/geoMath.ts** — Haversine, bearing, etc.
- **src/utils/shareLinks.ts** — Generate share URLs

### Types

- **src/types/geojson.ts** — GeoJSON feature types
- **src/types/supabase.ts** — Table row types
- **src/types/velojol.ts** — Bike lane dataset types
- **src/types/index.ts** — Exports

### Constants

- **src/constants/index.ts** — Layer IDs, source IDs, colors, MAP_CENTER (единственный источник)
- **src/constants/mapLayerRegistry.ts** — `LAYER_KEY_TO_MAP_LAYER_IDS`, `applyVisibilityToMapLayers`
- **src/constants/layerVisibility.ts** — Initial visibility state

### Admin Pages

- **src/admin/pages/SubmissionsPage.tsx** — Moderation queue
- **src/admin/pages/PointsPage.tsx** — CRUD points
- **src/admin/pages/RoutesPage.tsx** — CRUD routes
- **src/admin/pages/GeoPage.tsx** — Admin map with editing tools

### Backend

- **supabase/migrations/** — Database schema migrations
- **supabase/functions/telegram-location-bot/index.ts** — Telegram webhook handler
- **supabase/schema.sql** — Full schema export
- **supabase/schema.sql** — Full schema export (seed.sql отсутствует)

### Config

- **.env.example** — Environment template
- **vite.config.ts** — Vite bundler config + SPA fallback plugin
- **tsconfig.json** — TypeScript configuration (strict mode)
- **eslint.config.js** — ESLint rules
- **.prettierrc** — Code formatting (4-space tabs, 120 chars, single quotes)
- **playwright.config.ts** — E2E test config

### CI/CD

- **.github/workflows/deploy.yml** — Build, migrate, deploy
- **.github/workflows/test.yml** — Lint, unit tests, E2E, build

### PWA

- **public/manifest.webmanifest** — App manifest (name, icons, colors)
- **public/sw.js** — Service worker (caching strategy)
- **public/favicon.svg** — Icon source
- **public/icons/** — Generated PWA icons (see `npm run generate:pwa-icons`)

### Data

- **src/data/almaty.json** — Static bike lanes (Velojol dataset)

---

## ENTRY POINTS

### Frontend

1. **Browser navigates to `https://map.euc.kz`**
   - Loads `index.html` (served by GitHub Pages)
   - HTML links to `src/main.tsx` as ES module

2. **main.tsx**
   - Registers service worker (version-tagged)
   - Creates React root
   - Renders `<App />`

3. **App.tsx**
   - `<BrowserRouter basename={import.meta.env.BASE_URL}>`
   - Routes `/` → MapShell, `/admin` → AdminShell
   - Mounts `<YandexMetrika />`, `<PwaPrompts />`

4. **MapShell.tsx**
   - Lazy loads `EucMap` component
   - Suspense boundary with loading state
   - ErrorBoundary wrapper

5. **EucMap.tsx**
   - Orchestrates hooks
   - Renders Mapbox container + UI panels

### Backend

1. **Telegram bot sends webhook POST**
   - URL: `https://<project-ref>.supabase.co/functions/v1/telegram-location-bot`
   - Body: Telegram Update JSON
   - Header: `X-Telegram-Bot-Api-Secret-Token`

2. **Edge Function (Deno runtime)**
   - Parses update
   - Validates signature
   - Fetches avatar (if new user)
   - INSERTs into `telegram_locations`
   - Supabase Realtime broadcasts change

3. **Frontend receives Realtime event**
   - `useTelegramRealtime` callback fires
   - `refreshTelegramUsers()` executes
   - GeoJSON updated, Mapbox source refreshed

---

## EVENT FLOWS

### User Clicks on Map Point

```
EucMap.useMapClick listener fires
    ├─ Mapbox `click` event on points layer
    ├─ Extract feature ID from event
    ├─ useMapFeatureSelection.openFeature(id)
    │   ├─ Fetch feature from useFeatureIndexes
    │   ├─ Set selectedFeature state
    │   ├─ Set feature-state selected=true
    │   ├─ flyToBounds (zoom to feature)
    │   └─ displaySelectedFeature = true
    ├─ useMapSelectionSync updates URL path (/m/point/123)
    ├─ FeatureSidebar renders
    └─ Mapbox paint expressions update (selected dim = 0.7)
```

### User Submits New Point

```
AddPointPanel.handleSubmitDraft() called
    ├─ Validate: title, type, coordinates
    ├─ createMapPointDraft() API call
    │   └─ INSERT into map_points_submissions (status='pending')
    ├─ Loading state
    │   └─ Spinner in UI
    ├─ Success: draftSubmitSuccess = true
    │   ├─ Show confirmation modal
    │   ├─ Clear draft coordinates
    │   ├─ Reset form
    │   └─ Close AddPointPanel after delay
    └─ Error: draftSubmitError = message
        └─ Show error modal
```

### Admin Approves Submission

```
Admin navigates to /admin/submissions
    ├─ SubmissionsPage loads pending submissions
    ├─ Admin clicks "Approve" button
    │   └─ API call: UPDATE map_points_submissions SET status='approved'
    ├─ Admin fills in required fields:
    │   ├─ Move coordinates to map_points table
    │   ├─ Create map_points row
    │   └─ Copy photo if provided
    ├─ UPDATE map_points_submissions SET processed_at=now()
    └─ List refreshes, submission disappears
```

### Telegram User Sends Location

```
Telegram user in chat clicks "Share My Location"
    ├─ Telegram sends webhook to Edge Function
    │   └─ POST /functions/v1/telegram-location-bot
    │       ├─ Validate X-Telegram-Bot-Api-Secret-Token
    │       ├─ Extract location, user, chat info
    │       ├─ Fetch user avatar (if not cached)
    │       │   ├─ api.telegram.org/botX/getUserProfilePhotos
    │       │   ├─ Download image from Telegram CDN
    │       │   ├─ Remove bot token from URL
    │       │   └─ Upload to telegram-avatars bucket
    │       ├─ Upsert telegram_profiles row
    │       └─ INSERT into telegram_locations
    ├─ Supabase Realtime broadcasts INSERT
    ├─ Frontend useTelegramRealtime callback fires
    │   └─ refreshTelegramUsers() executes
    ├─ useMapData updates telegramUsersGeo state
    │   ├─ Normalize rows to GeoJSON
    │   ├─ Build user markers + recent track LineStrings
    │   └─ setState(telegramUsersGeo)
    ├─ useLayers.addLayersToMap triggers
    │   └─ Mapbox source updates with new data
    └─ Map updates visually in <500ms
```

---

## KNOWN RISKS

### Data Risks

1. **Avatar Caching:** Telegram bot token embedded in URLs from Telegram API
   - **Mitigation:** Function sanitizes before storage, RLS hides raw_update
   - **Residual Risk:** Old URLs in cache; backfill endpoint available

2. **GPS Accuracy:** Inaccurate user locations stored indefinitely
   - **Mitigation:** Filter on fetch (VITE_TELEGRAM_MAX_ACCURACY_METERS), TTL in frontend
   - **Residual Risk:** Very old inaccurate points remain in DB

3. **User Privacy:** Telegram location history visible to all site visitors
   - **Mitigation:** TTL filter (default 60 min), username/name optional display
   - **Residual Risk:** Malicious admin could expose raw_update column

### Performance Risks

1. **Large Feature Collections:** >10K Telegram locations
   - **Symptom:** Slow GeoJSON parsing, Mapbox rendering stalls
   - **Mitigation:** TTL filter, max accuracy, pagination (1000 per fetch)
   - **Residual Risk:** No client-side pagination; all features rendered

2. **Realtime Hammer:** Rapid updates on telegram_locations
   - **Symptom:** Ref counter race condition, stale data
   - **Mitigation:** `telegramRefreshSeqRef` counter + early exit
   - **Residual Risk:** High-frequency updates can batch race

3. **Map Layer Updates:** useEffect dependency on large GeoJSON triggers recompute
   - **Symptom:** Jank during Telegram location refresh
   - **Mitigation:** Memoization of GeoJSON objects (shallow)
   - **Residual Risk:** No deep memoization; full recompute on every refresh

### Security Risks

1. **RLS Misconfiguration:** Anon users could read admin photos before RLS applied
   - **Status:** Fixed in migrations
   - **Residual Risk:** New tables without explicit RLS policies

2. **XSS via User Input:** Point titles/descriptions not sanitized
   - **Mitigation:** React auto-escapes; no dangerouslySetInnerHTML
   - **Residual Risk:** None identified, safe by default

3. **Telegram Bot Token Leak:** Edge Function secrets exposed to logs
   - **Mitigation:** Supabase secrets (not in env vars)
   - **Residual Risk:** Low; only accessible to service role

4. **CORS Bypasses:** Mapbox telemetry requests blocked via transformRequest
   - **Status:** Implemented
   - **Residual Risk:** Other external requests (e.g., Telegram API) not blocked

### Operational Risks

1. **Service Worker Stale Cache:** Users on old app version after deploy
   - **Mitigation:** Version query string on SW registration, cleanup of old caches
   - **Residual Risk:** First page load shows old HTML; requires hard refresh

2. **Mapbox Rate Limits:** Tile requests not throttled
   - **Status:** No observed issue
   - **Residual Risk:** If user zooms aggressively, could hit limits

3. **Supabase Auth Session:** Long-lived JWT in localStorage
   - **Mitigation:** Supabase SDK handles refresh tokens
   - **Residual Risk:** Logout on other tab not reflected immediately

---

## TECHNICAL DEBT

1. **Admin API Client Fragmentation:** Multiple admin API modules (`points.ts`, `routes.ts`, `submissions.ts`) with duplicated query logic
   - **Recommendation:** Consolidate into `adminApi/query.ts` with reusable builders

2. **Service Worker Caching Strategy:** Simple FIFO eviction, no LRU
   - **Recommendation:** Implement LRU for tiles, keep frequently accessed files

3. **Telegram Track Segmentation:** Hardcoded 1 km breakpoint for splitting tracks
   - **Recommendation:** Configurable, time-based or speed-based segmentation

4. **Feature Indexing:** useFeatureIndexes rebuilds full Map on every data change
   - **Recommendation:** Incremental updates (only diff features)

5. **Error Handling:** Generic error messages, minimal debugging context
   - **Recommendation:** Structured logging with request IDs, replay capability

6. **Supabase Client:** Single global instance, no connection pooling
   - **Recommendation:** Edge Function to aggregate requests (reduce concurrent connections)

7. **Mobile Responsiveness:** Sidebar width hardcoded, no orientation-change handling
   - **Recommendation:** CSS Grid layout, media queries

8. **Admin Photos:** No image validation (size, MIME type)
   - **Recommendation:** Client-side validation, server-side enforcement

---

## PERFORMANCE NOTES

### Metrics to Monitor

- **Core Web Vitals:** LCP, FID, CLS (via Yandex.Metrika)
- **Mapbox Load Time:** Style load, tile load
- **Data Fetch Duration:** Time to first interactive
- **Realtime Latency:** Telegram location → map update
- **Bundle Size:** ~250KB (gzipped main + chunks)

### Optimizations Already Applied

1. **Code Splitting:** mapbox-gl in separate chunk (lazy-loaded if not needed)
2. **TailwindCSS JIT:** Only used classes included
3. **Lazy Component Loading:** Admin pages only loaded on route hit
4. **Service Worker:** Aggressive caching of static assets
5. **Image Optimization:** SVG favicon, PNG icons, no large raster images
6. **Parallel Data Fetching:** `Promise.allSettled` for robustness

### Possible Improvements

1. **Mapbox Vector Tiles:** Replace GeoJSON sources with vector tiles (for 50K+ features)
2. **Clustering:** Render point clusters at low zoom levels
3. **Virtual Scrolling:** Admin tables (hundreds of routes)
4. **RequestIdleCallback:** Defer non-critical updates
5. **Preload Critical Fonts:** If any web fonts added

---

## SECURITY NOTES

### Authentication & Authorization

- **Public Access:** Map data readable by anyone
- **Admin Access:** Supabase Auth (email/password) + map_admin_users RLS
- **Edge Function:** Validates Telegram webhook signature + bearer token for backfill

### Data Protection

- **In Transit:** HTTPS (GitHub Pages, Supabase CDN)
- **At Rest:** PostgreSQL + Supabase encryption (optional)
- **RLS:** Prevents leakage of flag_disabled items, admin-only writes

### Input Validation

- **Point Coordinates:** Checked in RLS, bounds [lon: -180..180, lat: -90..90]
- **Point Title:** 3–99 chars (RLS)
- **Route Coordinates:** Min 2 points (RLS)
- **Telegram Avatar:** Stripped of bot token before storage
- **User Input:** No HTML allowed (React escapes by default)

### Secrets Management

- **Mapbox Token:** Public (design-time limit in Mapbox dashboard)
- **Supabase Keys:** Anon key public-safe (RLS enforced), service role server-only
- **Telegram Secrets:** GitHub Actions secrets (encrypted), Supabase secrets (encrypted)

### Audit Recommendations

1. Rotate Telegram backfill secret monthly
2. Review map_admin_users access log (if available)
3. Monitor for unusual telegram_locations volume (potential spam)
4. Test RLS policies quarterly

---

## DEBUGGING GUIDE

### Service Worker Issues

**Symptom:** Changes not appearing after deploy

```bash
# Clear all caches & reload
- Open DevTools → Application → Service Workers
- Click "Unregister"
- Clear all storage (IndexedDB, localStorage, Cache Storage)
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
```

**Alternative:** Use app's reset button (clears cache programmatically).

### Mapbox Rendering Issues

**Symptom:** Blank map or missing layers

```javascript
// In DevTools console:
map.getStyle()           // Check loaded style
map.getSources()         // List all sources
map.getLayers()          // List all layers
map.querySourceFeatures(sourceId)  // Check source data
map.getFeatureState({source: sourceId, id: featureId})  // Check feature state
```

### Supabase Connection Issues

**Symptom:** "Supabase not configured" error

- Verify `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Check Supabase project is active (not paused)
- Test anon key in Supabase dashboard → SQL editor

```sql
SELECT 1; -- Should execute as anon user
```

### Telegram Webhook Debugging

**Symptom:** Locations not appearing on map

1. Check Edge Function logs (Supabase dashboard → Edge Functions)
2. Verify webhook secret matches Telegram API setting
3. Test webhook manually:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/telegram-location-bot \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <your_secret>" \
  -d '{
    "update_id": 123,
    "message": {
      "chat": {"id": 456},
      "from": {"id": 789},
      "location": {"latitude": 43.2, "longitude": 76.9}
    }
  }'
```

### Data Fetch Issues

**Symptom:** "Не удалось загрузить точки" error

1. Open DevTools → Network
2. Look for failed requests to `supabase.co`
3. Check response status (403 = RLS deny, 500 = server error)
4. Inspect RLS policies:

```sql
SELECT * FROM public.map_points LIMIT 1; -- As anon user
```

### Realtime Subscription Issues

**Symptom:** Telegram updates not appearing

1. DevTools → Application → Storage → IndexedDB
2. Check if Supabase realtime database exists
3. Listen for errors in console: `supabase.channel().subscribe()`
4. Verify postgres_changes are enabled in Supabase project settings

---

## LOCAL DEVELOPMENT

### Prerequisites

- Node.js 20+ (check `node --version`)
- npm 10+ (included with Node)
- Git
- Text editor (VS Code recommended)

### Setup

```bash
# Clone repository
git clone https://github.com/tonybantry/map.euc
cd map.euc

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Open .env.local and fill in:
# VITE_MAPBOX_TOKEN=<your_token_from_mapbox.com>
# VITE_SUPABASE_URL=<your_project_url>
# VITE_SUPABASE_PUBLISHABLE_KEY=<your_anon_key>
# (Leave VITE_YANDEX_METRIKA_ID empty if no analytics)
```

### Running

```bash
# Start dev server (http://localhost:5173)
npm run dev

# In another terminal, watch for type errors
npx tsc --watch

# Open browser to http://localhost:5173
```

### Building

```bash
# Build for production
npm run build

# Preview locally
npm run preview
# Visit http://localhost:4173
```

### Testing

```bash
# Run all unit tests
npm test

# Run single test file
npx vitest run src/utils/hashNav.test.ts

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test -- --watch
```

### Linting & Formatting

```bash
# Check linting
npm run lint

# Format code (uses Prettier config)
npx prettier --write .
```

### Supabase Local (Advanced)

If you want to test Edge Functions locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (requires Docker)
supabase start

# Deploy function locally
supabase functions deploy telegram-location-bot --no-verify-jwt

# Test locally
curl -X POST http://localhost:54321/functions/v1/telegram-location-bot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_anon_key>" \
  -d '{...}'
```

---

## TESTING

### Unit Tests

**Location:** `src/**/*.test.ts` (Vitest)

**Examples:**
- `utils/geoMath.test.ts` — Haversine distance, bearing
- `utils/hashNav.test.ts` — URL deep link parsing
- `utils/supabaseToGeojson.test.ts` — Data normalization
- `constants/mapLayerRegistry.test.ts` — Layer registry

**Coverage:** ~60% (Utils well-covered, components/hooks not)

**Run:**

```bash
npm test                          # Run all, exit
npm test -- --watch              # Watch mode
npm test -- --coverage           # Coverage report
```

### E2E Tests

**Location:** `e2e/` (Playwright)

**Scope:**
- Navigation (routing)
- Map rendering (Mapbox loads)
- Layer toggling
- Point submission flow
- Admin login

**Config:** `playwright.config.ts`

**Run:**

```bash
npm run test:e2e              # Headless
npm run test:e2e:ui          # Browser UI
npx playwright test --debug   # Step through
```

### Type Checking

```bash
# One-time check
npm run build  # Includes tsc -b

# Watch
npx tsc --watch
```

### Manual Testing Checklist

- [ ] Map loads in <2s on slow network (DevTools throttling)
- [ ] Layers toggle correctly
- [ ] Clicking point shows sidebar with photos
- [ ] Adding point flow works (validation, submission)
- [ ] Radar mode shows Telegram tracks
- [ ] Deep link works (/m/point/123)
- [ ] Offline mode (DevTools → Offline)
  - [ ] App shell loads
  - [ ] Cached data visible
  - [ ] Submission blocked with error message
- [ ] PWA install (Android: Add to Home Screen; iOS: Share → Add to Home Screen)
- [ ] Admin login/CRUD works

---

## GLOSSARY

- **EUC** — Electric Unicycle
- **PWA** — Progressive Web App (installable, works offline)
- **RLS** — Row Level Security (Supabase PostgreSQL policy)
- **GeoJSON** — Standard geographic data format (RFC 7946)
- **Feature State** — Transient Mapbox layer state (hover, selected) for paint expressions
- **Edge Function** — Supabase serverless function (Deno runtime)
- **TTL** — Time-to-Live (data expiration window)
- **Velojol** — Almaty bike lane dataset / project
- **Realtime** — Supabase PostgreSQL broadcast subscription
- **Service Worker** — Browser background script for caching/offline support
- **Source ID** — Mapbox identifier for data source (e.g., 'points-source')
- **Layer ID** — Mapbox identifier for visual layer (e.g., 'points-layer')
- **Feature ID** — GeoJSON feature property `id` (used for feature-state mapping)
- **PromoteId** — Mapbox option to use feature property as unique ID

---

## OPEN QUESTIONS

1. **Scalability:** How will map perform with 100K+ Telegram locations?
   - **Investigation:** Vector tiles, clustering, server-side pagination
   - **Impact:** Major refactor, significant perf gain

2. **Analytics:** Is Yandex.Metrika capturing useful metrics (abandoned carts, etc.)?
   - **Investigation:** Review Metrika dashboard for drop-off funnels
   - **Impact:** May adjust CTAs, onboarding

3. **Admin Workflow:** Is moderation queue keeping up with submissions?
   - **Investigation:** Monitor submissions table growth, response time
   - **Impact:** Automation, bulk approval, or delegate to community

4. **Offline Capabilities:** Should draft submissions persist offline?
   - **Investigation:** IndexedDB backup, sync on reconnect
   - **Impact:** Better UX for unreliable networks

5. **Mobile App:** Worth building native iOS/Android app, or PWA sufficient?
   - **Investigation:** Analyze PWA adoption metrics, user feedback
   - **Impact:** Resources, platform-specific features (background location)

---

## HOW THIS SYSTEM ACTUALLY WORKS

### Mental Model

Think of **map.euc** as a **real-time collaborative map** with two main data feeds:

1. **Static curated content** (map_points, map_routes) — edited by admins, shown instantly
2. **Live user locations** (telegram_locations) — streamed from Telegram users in real-time, TTL'd

**Frontend:**

- React hooks orchestrate data fetching and Mapbox lifecycle
- Mapbox GL renders visual layers (features are never re-created, only paint properties updated)
- Service Worker caches aggressively (offline app shell, cached tiles, lazy API calls)
- Realtime subscriptions trigger refresh of Telegram layer only

**Backend:**

- Supabase = managed PostgreSQL + REST + Storage + Edge Functions
- Telegram bot sends webhooks to Edge Function (Deno) → saves to telegram_locations
- RLS policies enforce: anon read (non-disabled), admin write

**The key insight:** This system prioritizes **read performance** (cached, offline) over write latency. The Telegram realtime feed is the only "live" component; everything else is eventually consistent.

---

## MENTAL MODEL FOR NEW ENGINEERS

**Shortest mental model:**

1. **User opens map** → Vite SPA downloads, service worker caches
2. **EucMap component mounts** → 10 hooks fire in sequence
3. **useMapData fetches in parallel** → Supabase REST API (with timeout + retry)
4. **Hooks render GeoJSON to Mapbox** → Sources added, layers painted
5. **useTelegramRealtime subscribes** → Realtime events trigger refresh
6. **User interacts** → Click/hover → feature-state → paint update (no DOM change)
7. **Admin edits something** → Admin API call → Update Supabase → Refresh frontend
8. **Telegram bot sends location** → Edge Function → INSERT → Realtime broadcast → Frontend refresh

---

## TOP 10 MOST IMPORTANT FILES

1. **src/components/EucMap.tsx** — The orchestrator; everything flows through here
2. **src/hooks/useMapData.ts** — Parallel data fetching; the bottleneck for "ready" state
3. **src/hooks/useMapbox.ts** — Mapbox instance lifecycle; easy to break if changed
4. **src/lib/supabase.ts** — All Supabase calls; error handling, retry logic
5. **src/lib/mapLayers.ts** — Layer definitions, paint expressions; maps data to visuals
6. **src/utils/supabaseToGeojson.ts** — Data normalization; gate-keeping for type safety
7. **supabase/functions/telegram-location-bot/index.ts** — Webhook handler; security-critical
8. **.github/workflows/deploy.yml** — CI/CD pipeline; controls deployments
9. **src/hooks/useLayerVisibilityStore.ts** — User preferences; localStorage sync
10. **src/constants/index.ts** — All layer/source IDs, colors, MAP_CENTER; adding a new layer requires changes here

---

## TOP 10 ARCHITECTURAL DECISIONS

1. **Mapbox GL (not Leaflet, not custom)** — Raster tiles + vector layers, industry standard
   - **Trade-off:** Large bundle (600KB), but mature ecosystem

2. **Supabase (not Firebase, not custom)** — PostgreSQL + RLS + Realtime + Storage bundled
   - **Trade-off:** Vendor lock, but simpler than managing separate services

3. **React Hooks (not Redux, not Zustand, not Jotai)** — plain useState + useCallback для хранения состояния
   - **Trade-off:** Prop drilling, but fewer abstractions

4. **Feature-state for interactivity (not DOM updates)** — Mapbox paint expressions reflect feature state
   - **Trade-off:** Mapbox-specific, but zero React re-renders during hover/select

5. **Realtime-only for Telegram (batch refresh for other data)** — Only telegram_locations live
   - **Trade-off:** Stale data for 30+ minutes for points/routes, but simpler architecture

6. **Service Worker caching (not server-side)** — Browser manages all cache logic
   - **Trade-off:** Cache invalidation complexity, but works offline

7. **useState + localStorage для visibility (not Zustand, not useReducer)** — минимальный стейт без внешних зависимостей
   - **Trade-off:** Нет реактивности между компонентами, но достаточно для одного подписчика

8. **GitHub Pages (not Netlify, not Vercel)** — Static hosting with custom domain via CNAME
   - **Trade-off:** No serverless functions on frontend (use Edge Functions instead), but free

9. **Deno Edge Functions (not Node.js)** — Supabase-native, bundled TypeScript
   - **Trade-off:** Smaller ecosystem, but integrated auth, secrets, Realtime

10. **Normalize-first data pipeline** — All data normalized to GeoJSON in usableToGeojson before state
   - **Trade-off:** Extra memory copies, but guarantees type safety at Mapbox boundaries

---

## MOST DANGEROUS AREAS TO MODIFY

### 1. Mapbox Layer Rendering (src/lib/mapLayers.ts)

**Risk:** Wrong paint expressions → invisible/malformed features, flickering

**Safety:**

- Always test layer visibility toggle
- Check feature-state hover/selected still works
- Validate paint property types (e.g., circle-radius expects number, not string)

### 2. RLS Policies (supabase/migrations/)

**Risk:** Data leak (exposing disabled items to anon) or write bypass (anon inserting admin data)

**Safety:**

- Review EVERY new RLS policy
- Test as anon user before deploying
- Document the policy intent in comment

### 3. useMapData Fetch Logic (src/hooks/useMapData.ts)

**Risk:** Race condition, stale data override, missing error handling

**Safety:**

- Keep seq counters for async operations
- Use `Promise.allSettled` (not `Promise.all`)
- Test with slow network (DevTools throttling)

### 4. Telegram Avatar Sanitization (supabase/functions/telegram-location-bot/index.ts)

**Risk:** Leaked bot token in avatar URL

**Safety:**

- All URLs from Telegram API must strip `/file/bot<TOKEN>/`
- Test with real Telegram bot token visible
- Backfill endpoint available if breach suspected

### 5. Feature-State Synchronization (useMapFeatureSelection + useMapClick)

**Risk:** Mapbox feature-state out of sync with React state → ghost highlights

**Safety:**

- Always clear old feature-state before setting new one
- Test deep links (/m/point/123) load with correct selection
- Check map.setFeatureState is called AFTER source created

### 6. URL Hash Sync (useMapSelectionSync + hashNav)

**Risk:** Browser back button broken, history pollution

**Safety:**

- Test back/forward buttons navigate correctly
- Verify hash cleared when sidebar closes
- Watch for useEffect infinite loops (deps list)

### 7. Service Worker Cache Strategy (public/sw.js)

**Risk:** Stale cached data shown as fresh, or offline breakage

**Safety:**

- Test hard refresh after deploy (Ctrl+Shift+R)
- Verify RUNTIME_CACHE max entries not too small
- Check HOME_FALLBACK path matches BASE_URL

### 8. Admin Auth Gate (src/admin/hooks/useAdminAuth.ts)

**Risk:** Unauthorized users can view/edit data

**Safety:**

- Always check RLS policies protect writes
- Verify session refresh on tab switch
- Test logout redirects to login

### 9. Supabase Client Initialization (src/lib/supabase.ts)

**Risk:** Missing/wrong credentials → no data loads

**Safety:**

- Verify VITE_SUPABASE_* env vars in build logs
- Test anon key in Supabase dashboard SQL editor
- Check for console warnings about missing config

### 10. Build & Deploy Pipeline (vite.config.ts, .github/workflows/)

**Risk:** Wrong base path, missing env vars, failed migrations

**Safety:**

- Always test `GITHUB_PAGES=true npm run build` locally
- Verify SPA fallback: check dist/404.html exists and equals index.html
- Review GitHub Actions secrets after each member added

---

## FASTEST WAY TO BECOME PRODUCTIVE IN THIS CODEBASE

**30-minute sprint:**

1. **Read this document** (you're doing it!)
2. **Clone & run locally** (`npm install`, `npm run dev`)
3. **Open DevTools** → Network, Console, Application
4. **Click a point on map** → trace the flow (useMapClick → useMapFeatureSelection → FeatureSidebar)
5. **Toggle a layer** → watch localStorage update, Mapbox paint change
6. **Add a breakpoint** in useMapData fetch, see network call
7. **Inspect Supabase schema** → Login to project dashboard, review table structure

**1-hour sprint:**

8. **Read top 3 important files** (EucMap, useMapData, useMapbox)
9. **Write a failing test** (`npm test -- --watch`, pick a utils function)
10. **Make it pass** (edit the util)
11. **Run the full test suite** (`npm test`)
12. **Build for production** (`npm run build`) → explore dist/

**First task recommendations:**

- **Low risk:** Add a new layer visibility toggle (copy existing pattern)
- **Medium risk:** Adjust Telegram location TTL or max accuracy filtering
- **High risk:** Modify RLS policy or Mapbox paint expressions

---

**End of Knowledge Base**

This document is a snapshot of the system as of 2026-05-15. It will drift as the codebase evolves; prioritize reading the actual code for the ground truth. Use this as a navigation map, not a permanent spec.

For questions, refer to README.md, CLAUDE.md, or the source code itself.
