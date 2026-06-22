# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PWA-карта для райдеров на моноколёсах (EUC) в Алматы — live at **map.euc.kz**. Точки встреч, розетки, маршруты, велодорожки и live-геопозиции из Telegram-чатов.

## Stack

- **React 19** + **TypeScript 6** (strict) + **Vite 8** + **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Mapbox GL JS 3** — карта; **react-router-dom 7** — SPA-роутинг; **Font Awesome 7** — иконки
- **Supabase** — PostgreSQL + RLS + Realtime + Storage + Deno Edge Functions
- **Vitest 4** + **RTL 16** + **jsdom** — unit-тесты; **Playwright** — e2e
- **Husky 9** — pre-commit хук; **ESLint 10** + **Prettier** — качество кода

## Commands

```bash
npm run dev          # Vite dev server (localhost:5173; host: true — доступен по сети)
npm run build        # tsc -b && vite build (type-check + bundle)
npm run lint         # ESLint (TypeScript strict + React hooks)
npm run test         # Vitest (run once)
npm run preview      # Preview production build locally
```

Запуск одного теста:

```bash
npx vitest run src/utils/hashNav.test.ts
```

**Pre-commit хук** (`.husky/pre-commit`) запускает автоматически: `lint → tsc --noEmit → test → build`.

E2E тесты: `npm run test:e2e` / `npm run test:e2e:ui`

## Environment

Скопировать `.env.example` → `.env.local`:

```
VITE_MAPBOX_TOKEN=             # Mapbox public token
VITE_SUPABASE_URL=             # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Anon key (RLS-protected)
VITE_YANDEX_METRIKA_ID=        # Optional analytics
VITE_TELEGRAM_GEO_TTL_MINUTES=60
VITE_TELEGRAM_TRACK_TAIL_MINUTES=30
VITE_TELEGRAM_MAX_ACCURACY_METERS=100
```

При добавлении переменной синхронизировать в четырёх местах: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md`.

Предлагать команды из `.env.local`:

- чувствительные → `gh secret set NAME --body "$NAME"`
- некритичные → `gh variable set NAME --body "$NAME"`

## Language

UI-тексты, сообщения пользователю, комментарии в коде — **русский**.

## Code Style

- **Prettier**: 4-space tabs, 120-char line width, single quotes, no semicolons, trailing commas
- **TypeScript**: strict, `noUnusedLocals`, `noUnusedParameters`. Избегать `any`; при необходимости — явный `eslint-disable` с обоснованием.
- **ESLint**: flat config, `typescript-eslint/configs.strictTypeChecked` + React hooks rules.
- Импорты: сначала внешние библиотеки, затем внутренние по пути, в конце `type`-импорты.
- Именование: PascalCase — компоненты/типы; camelCase — функции/хуки/переменные; UPPER_SNAKE — глобальные константы.
- Только функциональные компоненты, именованный экспорт: `export function ComponentName()`.
- Пропсы — отдельный интерфейс `ComponentNameProps`, не инлайнить в `FC<...>`.
- Для отключения правил хуков — `// eslint-disable-next-line react-hooks/... -- краткое обоснование`.
- В эффектах с подписками — ref для актуального колбэка, чтобы не переподписываться на каждый рендер.

### Styles & UI

- Стилизация только через классы Tailwind. Глобальные стили — в `src/index.css`.
- Цвета интерфейса — из палитры Tailwind (neutral, white). Цвета слоёв карты — из `COLORS` в `src/constants/index.ts`.
- Инлайн `style` — только для динамических значений (цвет по типу фичи, позиционирование попапа).
- Карта и оверлеи: `fixed`/`absolute` с `inset-0`. Safe area (`safe-area-padding`, `control-inset-*`) — глобально в `src/index.css` на `.mapboxgl-ctrl-*`, `.mapboxgl-popup`.
- Адаптив: `sm:` breakpoints. Кнопки: `type="button"`, `aria-label` где нужно, декоративные иконки — `aria-hidden`.

## Architecture

### Directory Structure

```
src/
├── components/    # UI только — никакой бизнес-логики
├── hooks/         # Состояние, эффекты, загрузка данных
├── lib/           # env.ts, supabase.ts, mapLayers.ts
├── utils/         # Чистые функции без React/Mapbox (все покрыты тестами)
├── constants/     # Единственный источник LAYER_IDS, SOURCE_IDS, COLORS, MAP_CENTER
├── types/         # geojson.ts, supabase.ts, velojol.ts — реэкспорт через index.ts
├── data/          # almaty.json — статичный GeoJSON велодорожек (Velojol)
├── test/          # setup.ts для Vitest + jsdom
└── admin/         # Lazy-loaded по /admin, Supabase Auth + map_admin_users
    ├── pages/         # PointEditPage, RouteEditPage, SubmissionsPage, GeoPage, PointsPage, RoutesPage
    ├── components/    # PointForm, PhotoManager, AdminRoutePolylineMap, ConfirmDialog, ...
    ├── hooks/         # useAdminAuth, useCoordinateHistory, useUndoRedoHotkeys, useAdminListLoader
    ├── lib/adminApi/  # CRUD: points, routes, photos, submissions, geo; types, parsers, query
    └── route-editor/  # routeGeometry.ts, routeValidation.ts (геометрия и валидация маршрута)
supabase/
├── migrations/    # 16 PostgreSQL-миграций (все таблицы + RLS + индексы)
├── functions/     # telegram-location-bot (Deno, webhook-обработчик)
└── schema.sql     # Полный экспорт схемы БД
```

### Data Flow

```
useMapData.ts
  ├─ fetchMapPoints()      → mapPointsToFeatureCollection()    → pointsGeo
  ├─ fetchMapRoutes()      → mapRoutesToFeatureCollection()    → routesGeo
  ├─ velojolToFeatureCollection(almaty.json)                   → bikeLanesGeo
  └─ fetchTelegramLocations()
       ├─ telegramLocationsToUsersFeatureCollection()          → telegramUsersGeo
       └─ telegramLocationsToRecentTracksFeatureCollection()   → telegramTracksGeo

Все запросы — через Promise.allSettled (один упавший не блокирует остальные).
Каждый запрос обёрнут withTimeoutAndRetry() — 10с таймаут, 2 повтора, экспоненциальный backoff.

useLayers.ts
  └─ lib/mapLayers.ts → добавляет/обновляет GeoJSON sources + paint layers в Mapbox

Telegram realtime:
  useTelegramRealtime.ts → postgres_changes → 300ms debounce → fetchTelegramLocations() → source.setData()
```

### Main Component (`EucMap.tsx`)

Оркестрирует хуки в порядке зависимостей:

1. `useMapbox(containerRef)` — создаёт Mapbox-инстанс (один раз)
2. `useMapData` — загружает данные, управляет realtime
3. `useLayers` — добавляет слои, управляет видимостью
4. `useMapClick`, `useMapHover` — attach listeners, обновляют feature-state
5. `useMapSelectionSync` — синхронизирует URL ↔ выбранная фича
6. `useMapPopup` — управляет Mapbox popup
7. `useGeolocateControl`, `useUserGeolocation`, `useDeviceCompassHeading` — геолокация

Рендерит: `LayerControls`, `FeatureSidebar`, `PopupContent`, `AddPointPanel`, `MapOverlayButtons`, `MapNotificationModals`, `PwaPrompts`.

### Feature State (нет DOM-ререндеров)

Hover/select реализованы через Mapbox feature-state — нулевые React-ререндеры:

```javascript
map.setFeatureState({ source, id }, { selected: true })
// Paint: ["case", ["feature-state", "selected"], selectedColor, defaultColor]
```

### URL Deep Links

- Формат: `/m/point/11`, `/m/route/5`, `/m/socket/3`, `/m/bikelane/alm1`, `/m/telegramuser/123`
- Старый hash `#point=11` → автоматически редиректит на путь
- При построении ссылок: `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(type, id)}` — иначе сломается в prod (`base = /map.euc/`)

### Constants (`src/constants/index.ts`)

Единственный источник истины — не дублировать строковые ID в коде:

- `LAYER_IDS`, `SOURCE_IDS`, `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `LAYER_ID_TO_SOURCE`
- `COLORS` — цвета по типу фичи для paint-выражений
- `FEATURE_TYPE_LABELS`, `POINT_FLAG_LABELS` — русские подписи
- `MAPBOX_STYLES` (`streets`, `satellite`), тип `BaseMapStyle`, тип `LayerKey`
- `MAP_CENTER` (`[76.904848, 43.226807]`), `MAP_ZOOM_DEFAULT` (12), `MAP_ZOOM_FOCUS` (15)

### GeoJSON & Types (`src/types/`)

- `FeatureType = 'point' | 'socket' | 'route' | 'bikeLane' | 'telegramUser'`
- `FeatureProperties` — union: `PointProperties | SocketProperties | RouteProperties | BikeLaneProperties | TelegramUserProperties`
- Координаты: `[lon, lat]` или `[lon, lat, elevation]` (тип `Position`)
- `PointFeature`, `RouteFeature`, `BikeLaneFeature`, `LineStringFeature` — типизированные обёртки

### Mapbox

- Инициализация — `useMapbox(containerRef)`. Один инстанс; при `setStyle(...)` — пересоздание слоёв через `style.load`.
- Перед добавлением слоёв: `if (map.getStyle() === undefined) return`
- Popup: `createRoot` + React-компонент, при закрытии — `root.unmount()`
- Токен: `import.meta.env.VITE_MAPBOX_TOKEN`. Телеметрия отключена через `transformRequest` (пустой ответ на `events.mapbox.com`)
- Map controls: только через `map.addControl(...)`, кнопка без текста, без кастомных классов/стилей. Позиции: `top-left`, `top-right`, `bottom-left`, `bottom-right`.

### Supabase Backend

- **Таблицы**: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions`, `telegram_locations`, `telegram_profiles`, `map_admin_users`
- **Storage**: бакеты `map-point-photos/` и `telegram-avatars/` (публичные URL, без bot-токенов)
- **RLS**: публичное чтение (кроме disabled/draft); запись требует auth или Edge Function
- **Resilience**: `withTimeoutAndRetry()` в `lib/supabase.ts`; при отсутствии URL/ключа — fallback на Cache API, предупреждение в консоль, не бросать ошибку при старте
- **Миграции**: 16 файлов в `supabase/migrations/`

### Telegram Bot (Edge Function)

`supabase/functions/telegram-location-bot/index.ts` — Deno runtime. Принимает webhook `POST`, валидирует secret-токен, сохраняет геопозицию в `telegram_locations`, кеширует аватар в `telegram_profiles` + Storage. URL аватара санируется (bot-токен вырезается перед записью).

### Admin Section (`/admin`)

Lazy-loaded, доступ — Supabase Auth + запись в `map_admin_users`. Структура:

- **adminApi**: `listPoints/getPoint/createPoint/updatePoint/togglePointDisabled/deletePoint`, аналогично для routes; `listSubmissions/approveSubmission/rejectSubmission`; `getAdminGeoData`; `uploadPhoto/deletePhoto`
- **route-editor**: геометрия и валидация вершин маршрута
- Undo/redo координат: `useCoordinateHistory` + `useUndoRedoHotkeys`
- Кнопка «Открыть на сайте» в edit-страницах: `${import.meta.env.BASE_URL}${buildMapDeepLinkPath(...)}`

### Deployment

- **GitHub Pages** (`map.euc.kz`) — static SPA; `GITHUB_PAGES=true` → Vite `base = /map.euc/`
- **CI/CD**: `.github/workflows/deploy.yml` — Supabase migrate → build → deploy → Telegram notification
- **Локально**: Valet proxy `map.euc.test` → `localhost:5173`

### PWA

- Service worker `public/sw.js` — app shell cache + stale-while-revalidate для Supabase API, offline fallback
- Иконки/сплэши: `npm run generate:pwa-icons` / `npm run generate:pwa-startup`

## Workflow

- Слои/источники/цвета — только через константы из `src/constants/index.ts`.
- Для публичных функций/хуков/утилит/edge functions — краткий JSDoc с назначением и ключевыми эффектами.
- Vitest-конфиг встроен в `vite.config.ts` (environment: jsdom, globals: true, setupFiles: `src/test/setup.ts`).
