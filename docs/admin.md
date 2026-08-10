# Admin panel (`/admin`)

A lazy-loaded section of the SPA. Access requires Supabase Auth (passkey by default, email/password as a fallback) plus a row in `map_admin_users`. Yandex.Metrika is fully disabled under `/admin/*` (`isAdminPath`).

## Shell

- `AdminShell.tsx` — `<AdminAuthGate><AdminLayout/></AdminAuthGate>`;
- `AdminAuthGate.tsx` — states `loading → misconfigured | unauthenticated (login form) | forbidden | ready`;
- `AdminLayout.tsx` — side menu plus an `Outlet` inside `Suspense`;
- `lazyAdminPages.ts` — `React.lazy()` for every page.

`useAdminAuth` listens to `onAuthStateChange` and checks `SELECT user_id FROM map_admin_users WHERE user_id = auth.uid()`. The session lives in localStorage (SDK-managed); the service-role key never reaches the browser.

### Passkeys (WebAuthn)

The primary sign-in method. The client is created with the opt-in `auth.experimental.passkey: true` (`src/lib/supabase.ts`) — without it the passkey methods throw. Wrappers live in `src/admin/lib/passkeys.ts`:

- `signInWithPasskey()` — `auth.signInWithPasskey()`: challenge → `navigator.credentials.get()` → verify; the SDK persists the session and emits `SIGNED_IN`, so `AdminAuthGate` re-renders on its own (no redirect needed). The passkey is discoverable, so no email is required;
- `listPasskeys()` / `registerPasskey(name?)` / `renamePasskey(id, name)` / `deletePasskey(id)` — `auth.passkey.*`. The SDK does not accept a name at registration time, so a non-empty name is applied by a second request (`passkey.update`);
- `isPasskeySupported()` — checks `PublicKeyCredential` + `navigator.credentials`; without support the UI shows a hint instead of the buttons;
- `passkeyErrorMessage()` — Russian messages keyed by `WebAuthnError` codes (`ERROR_CEREMONY_ABORTED` and similar).

The login page (`AdminLoginPage`) shows «Войти по пасскею» as the default action; the email+password form expands from the «Войти по email и паролю» link. The Telegram sign-in button is temporarily removed — the provider does not work; bring it back together with a working Supabase Auth configuration.

Passkey management lives at `/admin/settings` (`SettingsPage`): the list (name, created, last used), plus add, rename and delete.

## Routes

| Path                           | Page                          | Purpose                                                                                                                                |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                       | `DashboardPage`               | Dashboard: riders per period, a 30-day sparkline, content (+ route kilometers), alerts (pending, broadcast errors, bot webhook health) |
| `/admin/submissions`           | `SubmissionsPage`             | Submission moderation (status filter, approve → creates a point, reject)                                                               |
| `/admin/point`, `/new`, `/:id` | `PointsPage`, `PointEditPage` | Point CRUD: map + form + `PhotoManager`; disabled toggle                                                                               |
| `/admin/route`, `/new`, `/:id` | `RoutesPage`, `RouteEditPage` | Route CRUD: polyline + vertex list + elevations                                                                                        |
| `/admin/event`, `/new`, `/:id` | `EventsPage`, `EventEditPage` | Events + dates + announcements (see [events-news.md](events-news.md))                                                                  |
| `/admin/news`, `/new`, `/:id`  | `NewsPage`, `NewsEditPage`    | News + broadcast                                                                                                                       |
| `/admin/telegram-chats`        | `TelegramChatsPage`           | Broadcast chats/topics (enabled, sort_order, thread)                                                                                   |
| `/admin/geo`                   | `GeoPage`                     | Rider tracks over a period (30 min … all), `AdminGeoMap`                                                                               |
| `/admin/settings`              | `SettingsPage`                | The current admin's passkeys: list, add, rename, delete                                                                                |

The «Открыть на сайте» button on edit pages uses `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}`.

### Dashboard

- The data arrives in one `get_admin_dashboard_stats()` RPC call (see [database.md](database.md)); route mileage is computed client-side from `listRoutes()` (`src/admin/utils/routeDistance.ts`), best-effort.
- The today / 7 days / 30 days / year boundaries are Almaty midnights (Asia/Almaty), computed inside the RPC.
- Bot health check: `isBotStale()` (`src/admin/utils/adminTime.ts`) — alerts when the last geolocation is older than 48 hours.
- The side menu (`AdminLayout`) carries a pending-submission badge (`countPendingSubmissions()`), refreshed on navigation between sections.

## adminApi (`src/admin/lib/adminApi/`)

Infrastructure:

- `query.ts` — `db()` (a client carrying the user session, so RLS applies), `runOneRaw/runManyRaw/runOneParsed/runManyParsed` (an error label plus runtime validation);
- `parsers.ts` — runtime validators for every model (`parseAdminMapPoint`, `parseAdminEvent`, …);
- `types.ts` — `AdminMapPoint`, `AdminMapRoute`, `AdminSubmission`, `AdminEvent(+Date,+Participant,+Announcement)`, `AdminNews(+Announcement)`, `AdminTelegramChat`, plus Input/Patch types;
- `constants.ts` — bucket names (`PHOTOS_BUCKET`, `EVENT_PHOTOS_BUCKET`, `NEWS_PHOTOS_BUCKET`);
- `announceClient.ts` — `invokeAnnounce(subroute, body)` → `functions.invoke('telegram-location-bot/<subroute>')` with the session JWT.

Domains:

| Module                  | Functions                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `points.ts`             | `listPoints/getPoint/createPoint/updatePoint/togglePointDisabled/deletePoint` (cleaning up photos)                                                                                   |
| `routes.ts`             | the equivalent CRUD for routes                                                                                                                                                       |
| `submissions.ts`        | `listSubmissions(status?)`, `approveSubmission` (creates a `map_points` row), `rejectSubmission`, `countPendingSubmissions`                                                          |
| `photos.ts`             | `listPhotos/uploadPhoto/updatePhoto/deletePhoto` (Storage + DB with rollback on failure)                                                                                             |
| `events.ts`             | CRUD over events, dates (`listEventDates/addEventDate/updateEventDate/deleteEventDate`) and photos                                                                                   |
| `eventAnnouncements.ts` | `announceEventDate/editEventDateAnnouncements/cancelEventDateAnnouncements/deleteEventDateAnnouncements/pinEventAnnouncement/listEventParticipants/listEventAnnouncements(ForDates)` |
| `news.ts`               | CRUD over news (soft delete) and photos                                                                                                                                              |
| `newsAnnouncements.ts`  | `announceNews/editNewsAnnouncements/deleteNewsAnnouncements/listNewsAnnouncements`                                                                                                   |
| `telegramChats.ts`      | CRUD over broadcast destinations                                                                                                                                                     |
| `dashboard.ts`          | `getDashboardStats` — the `get_admin_dashboard_stats` RPC (dashboard aggregates)                                                                                                     |
| `geo.ts`                | `fetchTelegramLocations(periodMinutes)` (paginated by 1000), `buildRiderTracks` (grouped per rider, 10 colors)                                                                       |
| `aiAssist.ts`           | `improveWithAi` — calls the `ai-assist` edge function                                                                                                                                |

## Route editor (`src/admin/route-editor/`)

- `routeGeometry.ts` — the `RouteEditorCoordinates` type (`[lng, lat]` | `[lng, lat, z]`), projecting a point onto a segment (`closestOnSegment2D`), inserting/removing/moving vertices, and conversion to LineString/FeatureCollection;
- `routeValidation.ts` — a 4–99 character title and at least 2 vertices.

`RouteEditPage` combines `AdminRoutePolylineMap` (vertex dragging, click-to-insert, hover highlighting) + `RouteVertexEditorList` (vertex table, `simplifyRouteCollinear` simplification, elevation filling via `fetchMissingRouteElevations`) + undo/redo.

## Coordinate undo/redo

- `useCoordinateHistory` — undo/redo stacks (JSON serialization), `prepareCommit/undo/redo/reset`;
- `useUndoRedoHotkeys` — global Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, ignored while focus is in an input/textarea/contenteditable.

## Components (`src/admin/components/`)

| Component                                                                                               | Role                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PointForm`                                                                                             | The point form (type, flags, coordinates parsed from a string, undo)   |
| `PhotoManager`                                                                                          | Point photos: drag & drop, Ctrl+V, ordering, lightbox (16 unit tests)  |
| `AdminPointLocationMap`                                                                                 | A mini map with a draggable point marker                               |
| `AdminRoutePolylineMap`                                                                                 | The interactive route polyline                                         |
| `AdminGeoMap`                                                                                           | Rider tracks; a segment breaks at > 1 km or > 5 min                    |
| `RouteVertexEditorList`                                                                                 | The vertex table with auto-scroll to the highlighted row               |
| `ConfirmDialog`                                                                                         | Confirmation (danger / regular)                                        |
| `AiAssistPanel`                                                                                         | Title/description improvement: a copyable prompt plus a direct AI call |
| `EventForm`, `EventDatesManager`, `EventPhotoManager`, `EventAnnounceModal`, `AnnouncementMessagesList` | Events                                                                 |
| `NewsPhotoManager`, `NewsAnnounceManager`, `NewsMessagesList`                                           | News                                                                   |

`useAdminListLoader<T>` — the shared list loader (items/loading/error/reload) used by every list page.

### AI assistant (`AiAssistPanel`)

At the bottom of the point form (`PointForm`) and the route editor (`RouteEditPage`) sits a panel with an automatically assembled prompt for improving `title`/`description`: the live field values plus context (type, coordinates, flags) and a requirement to answer with strict JSON `{"title", "description", "pois"}` (`pois` are 2–3 nearby points of interest, informational for the admin). Two scenarios:

- **«Скопировать промпт»** — the admin pastes the prompt into ChatGPT/Claude manually;
- **«Улучшить с ИИ»** — calls the `ai-assist` edge function (`improveWithAi` in `src/admin/lib/adminApi/aiAssist.ts` via `functions.invoke`); the suggestion appears in the panel and «Применить» fills `title`/`description` into the form, scrolls to the title field and reminds the admin to save. The «Искать в интернете» checkbox (on by default) controls the `webSearch` flag: with it the model verifies facts and looks up points of interest through web search (slower, ~45 s); without it the call is fast and returns no POIs.

The builder is the pure function `buildAiAssistPrompt` in `src/admin/utils/aiAssistPrompt.ts`, deliberately import-free: a copy of it lives in `supabase/functions/ai-assist/_pure.ts` (Deno cannot import from `src/`), so edits must be applied to both copies.

The `supabase/functions/ai-assist/` edge function: authorization is the admin JWT + `map_admin_users` (same as the bot's announce subroutes), with CORS for the browser, calling the OpenAI **Responses API** with the `web_search` tool — the model verifies facts and looks up points of interest online; JSON mode is not forced (it conflicts with search) and the parser tolerates markdown fences. Secrets: `OPENAI_API_KEY` (required) and `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`) — filled in `.env.local` and uploaded with `npm run secrets:sync` (`scripts/set-supabase-secrets.sh`, which uploads every populated edge-function secret). Deployment is a separate line in `.github/workflows/deploy.yml` with `--no-verify-jwt` (the browser preflight carries no Authorization header). Input/response validation lives in `parseAiAssistEntity`/`parseAiSuggestion`/`extractResponsesOutputText` in `_pure.ts` (Deno tests in `_pure.test.ts`).

## First-time administrator setup

1. Supabase → Authentication → enable the Email provider and create a user.
2. `INSERT INTO public.map_admin_users (user_id) VALUES ('<uuid>') ON CONFLICT DO NOTHING;`
3. Sign in at `/admin` with email and password (the «Войти по email и паролю» link).
4. Supabase → Authentication → enable Passkeys (WebAuthn); in the admin panel open «Настройки» → «Добавить пасскей». From then on, sign in with the passkey.
