# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PWA-карта для райдеров на моноколёсах (EUC) в Алматы — live at **map.euc.kz**. Точки встреч, розетки, маршруты, велодорожки и геопозиции из Telegram-чатов.

## Stack

- **React 19** + **TypeScript** (strict)
- **Vite 8** — сборка и dev-сервер
- **Tailwind CSS 4** — стили (`@tailwindcss/vite`)
- **Mapbox GL JS 3** — карта
- **Supabase** — PostgreSQL + RLS + Storage + Edge Functions
- **Vitest + ESLint + Prettier** — качество кода

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

При добавлении любой новой переменной окружения синхронизировать во всех четырёх местах: `.github/workflows/deploy.yml`, `.env.example`, `.env.local`, `README.md`.

После добавления предлагать команды `gh secret set` / `gh variable set` из `.env.local`:
- чувствительные значения → `gh secret set SECRET_NAME --body "$SECRET_NAME"`
- некритичные значения → `gh variable set VARIABLE_NAME --body "$VARIABLE_NAME"`

## Language

UI-тексты, пользовательские сообщения и комментарии в коде — **русский**.

## Code Style

- **Prettier**: 4-space tabs, 120-char line width, single quotes, no semicolons, trailing commas
- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters` — no unused variables allowed
- **ESLint**: flat config (v10), TypeScript strict + React hooks rules enforced

### TypeScript & React

- Строгий TypeScript (`typescript-eslint/configs.strictTypeChecked`). Избегать `any`; при необходимости — явный `eslint-disable` с обоснованием.
- Импорты: сначала внешние библиотеки, затем внутренние по пути, в конце `type`-импорты.
- Именование: PascalCase для компонентов и типов, camelCase для функций/хуков/переменных, UPPER_SNAKE для глобальных констант.
- Только функциональные компоненты. Именованный экспорт: `export function ComponentName()`.
- Пропсы — отдельный интерфейс `ComponentNameProps`, не инлайнить в `FC<...>`.
- Логику карты/слоёв держать в хуках. Хуки возвращают объект с нужными полями и функциями.
- В эффектах с подписками использовать ref для актуального значения колбэка, чтобы не переподписываться на каждый рендер.
- Для отключения правил хуков — `// eslint-disable-next-line react-hooks/... -- краткое обоснование`.

### Styles & UI

- Стилизация только через классы Tailwind. Глобальные стили — в `src/index.css`.
- Цвета интерфейса — из палитры Tailwind (neutral, white). Цвета слоёв карты — из `constants` (`COLORS`).
- Инлайн `style` — только для динамических значений (цвет по типу фичи, позиционирование попапа).
- Карта и оверлеи: `fixed`/`absolute` с `inset-0` для полного покрытия. Учитывать safe area (`safe-area-padding`, `control-inset-*`) на мобильных.
- Адаптив: использовать `sm:` breakpoints (например `text-xs sm:text-sm`).
- Кнопки/переключатели: `type="button"`, `aria-label` где нужно. Декоративные иконки — `aria-hidden`.
- Весь текст интерфейса — на русском.

## Architecture

### Directory Structure

```
src/
├── components/    # UI rendering only — no business logic
│   └── admin/     # Админка /admin в проде (Supabase Auth + map_admin_users)
├── hooks/         # State management, side effects, data fetching
├── lib/           # Initialization wrappers (Supabase client, Mapbox layer definitions)
├── utils/         # Pure functions, no React/Mapbox dependencies (all tested)
├── constants/     # LAYER_IDS, SOURCE_IDS, COLORS, MAP_CENTER
├── types/         # TypeScript types: GeoJSON features, DB row shapes, Velojol
└── data/          # Static Velojol bike lane GeoJSON (almaty.json)
supabase/
├── migrations/    # PostgreSQL migrations (8 tables)
├── functions/     # Deno Edge Functions (Telegram webhook bot)
└── schema.sql     # Full DB schema export
```

### Data Flow

1. `hooks/useLayers.ts` — координирует все Supabase-запросы через `Promise.allSettled` (resilient)
2. `utils/supabaseToGeojson.ts` — трансформирует строки БД → Mapbox-ready GeoJSON FeatureCollections
3. `lib/mapLayers.ts` — определяет paint/layout-выражения слоёв, добавляет/обновляет sources+layers в Mapbox
4. Click/hover-обработчики (`useMapClick`, `useMapHover`) обновляют Mapbox **feature-state** (`hover`, `selected`) — без DOM-ререндеров
5. URL-путь `…/m/{тип}/{id}` синхронизируется с выбранной фичей через `useMapSelectionSync`; устаревший hash `#point=…` редиректится на путь

### Main Component (`EucMap.tsx`)

Оркестрирует 10+ хуков; владеет `<div ref={containerRef}>` — точкой монтирования Mapbox. Компонует:
- `LayerControls` — переключение видимости слоёв (localStorage через `useLayerVisibilityStore`)
- `FeatureSidebar` / `PopupContent` — детали выбранной фичи + фотогалерея
- `AddPointPanel` — форма добавления точки (`useDraftPointFlow`)

### Mapbox

- Инициализация — в хуке `useMapbox(containerRef)`. Один инстанс на контейнер; при смене базового стиля — `map.setStyle(...)`, пересоздание слоёв через событие `style.load`.
- Проверка перед добавлением слоёв: `if (map.getStyle() === undefined) return;`
- Popup: контент рендерить через `createRoot` + React-компонент, при закрытии — `root.unmount()`.
- Токен: `import.meta.env.VITE_MAPBOX_TOKEN`. Отключать телеметрию через `transformRequest` (пустой ответ на `events.mapbox.com`).

#### Map Controls

- UI-элементы управления картой добавлять только через `mapbox-gl` controls (`map.addControl(...)`), не как overlay.
- Контрол — кнопка только с иконкой (без текста), иконка выровнена по центру. Допустимы стандартные иконки Mapbox или Font Awesome.
- Не добавлять кастомные стили/классы к контролу — никаких `className`, inline-стилей, кастомных CSS-классов.
- Safe area для контролов и попапов — **глобально** в `src/index.css` на `.mapboxgl-ctrl-*`, `.mapboxgl-popup`.
- Если control рендерится из React-компонента, монтировать в контейнер из `IControl.onAdd`.
- Позиционирование через стандартные позиции `mapbox-gl` (`top-left`, `top-right`, `bottom-left`, `bottom-right`).

### Constants

- ID слоёв, источников, цвета, центр и зум — только в `src/constants/index.ts`. Не дублировать строковые ID по коду.
- Экспорты: `LAYER_IDS`, `SOURCE_IDS`, `CLICKABLE_LAYER_IDS`, `LAYER_ID_TO_KEY`, `COLORS`, `MAPBOX_STYLES`, тип `BaseMapStyle`, тип `LayerKey`.

### GeoJSON & Types

- Типы фич — из `src/types/geojson.ts`: `Feature`, `FeatureCollection`, `PointFeature`, `LineStringFeature`, `FeatureProperties`, `FeatureType`.
- Координаты — `[lon, lat]` или `[lon, lat, elevation]`. Работа с bounds/центром — в `src/utils/bounds.ts`.
- Данные слоёв: точки и маршруты из Supabase (`mapPointsToFeatureCollection`, `mapRoutesToFeatureCollection`); велодорожки — `data/almaty.json`.
- Общие типы — в `src/types/` (geojson, supabase, velojol). Реэкспорт через `src/types/index.ts`.

### Supabase Backend

- **Tables**: `map_points`, `map_routes`, `map_point_photos`, `map_points_submissions` (moderation queue), `telegram_locations`, `telegram_profiles`
- **Storage**: `map-point-photos/` and `telegram-avatars/` buckets (public URLs, no bot tokens)
- **RLS**: All tables publicly readable (except disabled/draft items); writes require auth or Edge Function
- **Resilience**: `withTimeoutAndRetry()` in `lib/supabase.ts` — 10s timeout, up to 2 retries, exponential backoff, transient error detection
- При отсутствии URL/ключа — fallback на Cache API и предупреждение в консоль. Не бросать ошибки при старте.

### Telegram Bot (Edge Function)

`supabase/functions/telegram-location-bot/index.ts` — Deno runtime. Receives Telegram webhook `POST`, extracts location + user, saves to `telegram_locations`, fetches and caches avatar in `telegram_profiles` + Storage. Avatar URLs are sanitized (bot tokens stripped before storage).

### Deployment

- **GitHub Pages** at `map.euc.kz` — static SPA
- **CI/CD**: `.github/workflows/deploy.yml` on push to `main`; build with `GITHUB_PAGES=true` (sets Vite `base` to `/map.euc/`)
- Telegram notification on deploy success/failure
- Локальный тест: Valet proxy на `map.euc.test` → `127.0.0.1:5173`

### PWA

- Service worker at `public/sw.js` — app shell + static asset caching, stale-while-revalidate for Supabase API calls, offline fallback
- `PwaPrompts.tsx` handles install prompts
- Icons/splash screens generated via `npm run generate:pwa-icons`

## Workflow

- При правках слоёв/источников/цветов использовать константы из `src/constants`, не дублировать строковые ID.
- Для публичных методов/функций (хуки, utils, API-слой, edge functions) добавлять краткий JSDoc с назначением и ключевыми эффектами.
- Перед завершением задачи запускать: `npm run lint`, `npm test`; при необходимости `npm run build`.
